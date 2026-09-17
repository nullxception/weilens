use chrono::{DateTime, Utc};
use serde::Deserialize;
use std::collections::HashMap;
use std::fs::{create_dir_all, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tokio::sync::{broadcast, Semaphore};
use tokio::task::spawn_blocking;
use tokio::time::{sleep, Duration};
use tokio_util::sync::CancellationToken;
use url::Url;

use crate::dates;
use crate::exif;
use crate::image;
use crate::image::WmPosition;
use crate::motion;
use crate::types::{DownloadConfig, DownloadError, DownloadItem, DownloadProgressPayload, GpsData};
use crate::util;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadPostRequest {
    pub uid: String,
    pub blog_id: String,
    pub date: String,
    pub dewatermark: String,
    pub items: Vec<DownloadItem>,
    pub target: Option<String>,
    pub gps: Option<GpsData>,
}

pub struct DownloadTask {
    pub progress_tx: broadcast::Sender<DownloadProgressPayload>,
    pub post_id: String,
    pub created_at_dt: DateTime<Utc>,
    pub dewatermark: String,
    pub item_url: String,
    pub item_video_url: Option<String>,
    pub index: usize,
    pub total: usize,
    pub target_dir: PathBuf,
    pub gps_loc: Option<GpsData>,
    pub client: reqwest::Client,
    pub config: DownloadConfig,
    pub user_agent: String,
    pub cancellation_token: CancellationToken,
}

fn emit_cancelled(
    tx: &broadcast::Sender<DownloadProgressPayload>,
    post_id: &str,
    index: usize,
    total: usize,
    url: &str,
) {
    let _ = tx.send(DownloadProgressPayload {
        post_id: post_id.to_string(),
        index,
        total,
        status: "cancelled".to_string(),
        url: url.to_string(),
        saved_path: None,
        warning: None,
    });
}

fn emit_progress(
    tx: &broadcast::Sender<DownloadProgressPayload>,
    payload: DownloadProgressPayload,
) {
    let _ = tx.send(payload);
}
async fn cancellable_send(
    request: reqwest::RequestBuilder,
    token: &CancellationToken,
) -> Result<reqwest::Response, DownloadError> {
    tokio::select! {
        res = request.send() => res.map_err(|e| DownloadError::Request(format!("request failed: {e}"))),
        _ = token.cancelled() => Err(DownloadError::Cancelled),
    }
}

async fn cancellable_bytes(
    response: reqwest::Response,
    token: &CancellationToken,
) -> Result<Vec<u8>, DownloadError> {
    tokio::select! {
        bytes = response.bytes() => bytes.map(|b| b.to_vec()).map_err(|e| DownloadError::Request(format!("failed to read response bytes: {e}"))),
        _ = token.cancelled() => Err(DownloadError::Cancelled),
    }
}
fn log_download_error(task: &DownloadTask, err: &DownloadError) {
    log::error!(
        "[{}/{}] Post {} - {}",
        task.index + 1,
        task.total,
        task.post_id,
        err
    );
}

fn fetch_request(task: &DownloadTask, url: &str) -> reqwest::RequestBuilder {
    task.client
        .get(url)
        .timeout(Duration::from_secs(task.config.request_timeout_secs))
        .header("Referer", &task.config.referer)
        .header("User-Agent", &task.user_agent)
}

fn check_cancelled(token: &CancellationToken) -> Result<(), DownloadError> {
    if token.is_cancelled() {
        return Err(DownloadError::Cancelled);
    }
    Ok(())
}

async fn try_merge_watermark_free(task: &DownloadTask, buffer: &mut Vec<u8>) {
    let Some(no_wm_url) = util::get_no_watermark_url(&task.item_url) else {
        return;
    };
    if no_wm_url == task.item_url || task.item_video_url.is_some() {
        return;
    }
    if check_cancelled(&task.cancellation_token).is_err() {
        return;
    }
    let request = fetch_request(task, &no_wm_url);
    let res_no_wm = match cancellable_send(request, &task.cancellation_token).await {
        Ok(res) => res,
        Err(DownloadError::Cancelled) => return,
        Err(_) => {
            log::warn!(
                "[Post {}:{}/{}] Failed to request watermark-free image",
                task.post_id,
                task.index + 1,
                task.total
            );
            return;
        }
    };
    if !res_no_wm.status().is_success() {
        log::warn!(
            "[Post {}:{}/{}] Watermark-free request returned status: {}",
            task.post_id,
            task.index + 1,
            task.total,
            res_no_wm.status()
        );
        return;
    }
    let no_wm_bytes = match cancellable_bytes(res_no_wm, &task.cancellation_token).await {
        Ok(bytes) => bytes,
        Err(_) => return,
    };
    if check_cancelled(&task.cancellation_token).is_err() {
        return;
    }
    let pos = WmPosition::from(task.dewatermark.as_str());
    if image::dewatermark(buffer, &no_wm_bytes, pos)
        .map(|merged| *buffer = merged)
        .is_err()
    {
        log::warn!(
            "[Post {}:{}/{}] Failed to merge watermark-free version",
            task.post_id,
            task.index + 1,
            task.total
        );
    }
}

async fn process_motion(
    task: &DownloadTask,
    video_url: &str,
    image_bytes: &[u8],
) -> Result<Vec<u8>, DownloadError> {
    log::info!(
        "[Post {}:{}/{}] Fetching video from {}",
        task.post_id,
        task.index + 1,
        task.total,
        video_url
    );

    let res = cancellable_send(fetch_request(task, video_url), &task.cancellation_token).await?;

    if !res.status().is_success() {
        return Err(DownloadError::Http(format!(
            "video HTTP error: {}",
            res.status()
        )));
    }

    let video_bytes = cancellable_bytes(res, &task.cancellation_token).await?;

    let url = Url::parse(video_url).map_err(|e| DownloadError::VideoUrl(e.to_string()))?;
    let mime = match Path::new(url.path())
        .extension()
        .and_then(|ext| ext.to_str())
    {
        Some("mp4") | Some("MP4") => "video/mp4",
        Some("mov") | Some("MOV") => "video/quicktime",
        _ => return Err(DownloadError::VideoFormat),
    };

    log::info!(
        "[Post {}:{}/{}] Muxing video ({} bytes) in memory",
        task.post_id,
        task.index + 1,
        task.total,
        video_bytes.len()
    );

    check_cancelled(&task.cancellation_token)?;

    motion::mux(image_bytes, &video_bytes, mime).map_err(|e| DownloadError::Mux(e.to_string()))
}

pub async fn download(task: DownloadTask) -> Result<(Vec<String>, Option<String>), DownloadError> {
    let mut saved_paths = Vec::new();
    let mut warning = None;

    check_cancelled(&task.cancellation_token)?;

    let response = cancellable_send(
        fetch_request(&task, &task.item_url),
        &task.cancellation_token,
    )
    .await
    .inspect_err(|err| log_download_error(&task, err))?;

    if !response.status().is_success() {
        let err = DownloadError::Http(format!("HTTP error: {}", response.status()));
        log_download_error(&task, &err);
        return Err(err);
    }

    let mut buffer = cancellable_bytes(response, &task.cancellation_token)
        .await
        .inspect_err(|err| log_download_error(&task, err))?;

    try_merge_watermark_free(&task, &mut buffer).await;

    let extension = Path::new(&task.item_url)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| format!(".{}", ext))
        .unwrap_or_else(|| ".jpg".to_string());

    let formatted_date = dates::get_formatted_date(&task.created_at_dt, task.index as i64);
    let image_filename = format!("{}{}", formatted_date, extension);
    let target_path = task.target_dir.join(&image_filename);

    let exif_date_str = dates::get_exif_date_string(&task.created_at_dt, task.index as i64);
    check_cancelled(&task.cancellation_token)?;
    if let Err(e) = exif::write_exif(
        &mut buffer,
        &exif_date_str,
        task.gps_loc.as_ref(),
        &extension,
    ) {
        log::warn!(
            "[Post {}:{}/{}] Failed to write EXIF metadata in memory: {}",
            task.post_id,
            task.index + 1,
            task.total,
            e
        );
    }

    // Mux in memory so the later file write stays single-shot.
    if let Some(video_url) = &task.item_video_url {
        check_cancelled(&task.cancellation_token)?;
        match process_motion(&task, video_url, &buffer).await {
            Ok(muxed) => {
                buffer = muxed;
                log::info!(
                    "[Post {}:{}/{}] muxed successfully, new size: {} bytes",
                    task.post_id,
                    task.index + 1,
                    task.total,
                    buffer.len()
                );
            }
            Err(e) => {
                log::error!(
                    "[Post {}:{}/{}] mux failed, writing plain image: {}",
                    task.post_id,
                    task.index + 1,
                    task.total,
                    e
                );
                warning = Some(format!(
                    "motion photo mux failed: {e}, saved as still image"
                ));
            }
        }
    }

    check_cancelled(&task.cancellation_token)?;
    let target_path_str = target_path.to_string_lossy().to_string();
    tokio::select! {
        result = spawn_blocking(move || -> Result<(), DownloadError> {
            File::create(&target_path)?.write_all(&buffer)?;
            Ok(())
        }) => {
            result.map_err(|e| DownloadError::Request(format!("Join error: {}", e)))??;
        },
        _ = task.cancellation_token.cancelled() => return Err(DownloadError::Cancelled),
    }

    log::info!(
        "[Post {}:{}/{}] Wrote image to {}",
        task.post_id,
        task.index + 1,
        task.total,
        target_path_str
    );

    emit_progress(
        &task.progress_tx,
        DownloadProgressPayload {
            post_id: task.post_id.clone(),
            index: task.index,
            total: task.total,
            status: "completed".to_string(),
            url: task.item_url.clone(),
            saved_path: Some(target_path_str.clone()),
            warning: warning.clone(),
        },
    );

    saved_paths.push(target_path_str);

    log::info!(
        "[Post {}:{}/{}] Completed",
        task.post_id,
        task.index + 1,
        task.total
    );

    Ok((saved_paths, warning))
}

pub async fn download_post_core(
    request: DownloadPostRequest,
    client: reqwest::Client,
    user_agent: String,
    config: DownloadConfig,
    cancel_map: Arc<Mutex<HashMap<String, CancellationToken>>>,
    progress_tx: broadcast::Sender<DownloadProgressPayload>,
) -> Result<serde_json::Value, String> {
    let base_dir = config.effective_download_root(request.target.as_deref());
    let uid_segment = if request.uid.trim().is_empty() {
        "unknown_user"
    } else {
        &request.uid
    };
    let created_at_dt = dates::parse_date(&request.date).unwrap_or_else(chrono::Utc::now);
    let date_segment = dates::get_date_folder(&created_at_dt);
    let download_dir = base_dir.join(uid_segment).join(date_segment);
    create_dir_all(&download_dir)
        .map_err(|e| DownloadError::CreateDir(e.to_string()))
        .map_err(|e| e.to_string())?;
    let total = request.items.len();
    let semaphore = Arc::new(Semaphore::new(config.effective_max_concurrency()));
    let cancellation_token = CancellationToken::new();
    cancel_map
        .lock()
        .map_err(|e| e.to_string())?
        .insert(request.blog_id.clone(), cancellation_token.clone());
    let mut handles = Vec::with_capacity(total);
    for (index, item) in request.items.iter().enumerate() {
        let sem = semaphore.clone();
        let token = cancellation_token.clone();
        let config_clone = config.clone();
        let post_id = request.blog_id.clone();
        let progress_tx_clone = progress_tx.clone();
        let item_url = item.url.clone();
        let item_video = item.video_url.clone();
        let dewatermark = request.dewatermark.clone();
        let gps_loc = request.gps;
        let resolved_dir = download_dir.clone();
        let client_clone = client.clone();
        let user_agent_clone = user_agent.clone();
        let created_at = created_at_dt;
        let handle = tokio::spawn(async move {
            if token.is_cancelled() {
                emit_cancelled(&progress_tx_clone, &post_id, index, total, &item_url);
                return Err(DownloadError::Cancelled);
            }
            let permit_result = tokio::select! {
                permit = sem.acquire() => permit.map_err(|_| DownloadError::Cancelled),
                _ = token.cancelled() => Err(DownloadError::Cancelled),
            };
            let Ok(_permit) = permit_result else {
                emit_cancelled(&progress_tx_clone, &post_id, index, total, &item_url);
                return Err(DownloadError::Cancelled);
            };
            let mut attempt = 0u32;
            loop {
                if token.is_cancelled() {
                    emit_cancelled(&progress_tx_clone, &post_id, index, total, &item_url);
                    return Err(DownloadError::Cancelled);
                }
                let task = DownloadTask {
                    progress_tx: progress_tx_clone.clone(),
                    post_id: post_id.clone(),
                    created_at_dt: created_at,
                    dewatermark: dewatermark.clone(),
                    item_url: item_url.clone(),
                    item_video_url: item_video.clone(),
                    index,
                    total,
                    target_dir: resolved_dir.clone(),
                    gps_loc,
                    client: client_clone.clone(),
                    config: config_clone.clone(),
                    user_agent: user_agent_clone.clone(),
                    cancellation_token: token.clone(),
                };
                match download(task).await {
                    Ok(paths) => break Ok(paths),
                    Err(DownloadError::Cancelled) => {
                        emit_cancelled(&progress_tx_clone, &post_id, index, total, &item_url);
                        break Err(DownloadError::Cancelled);
                    }
                    Err(e) if attempt < config_clone.max_retries => {
                        attempt += 1;
                        let delay_ms = config_clone
                            .retry_base_delay_ms
                            .saturating_mul(1u64 << attempt.min(10))
                            .min(config_clone.retry_max_delay_ms);
                        log::warn!(
                            "[Post {}:{}/{}] Attempt {}/{} failed ({}). Retrying in {}ms…",
                            post_id,
                            index + 1,
                            total,
                            attempt,
                            config_clone.max_retries,
                            e,
                            delay_ms
                        );
                        tokio::select! {
                            _ = sleep(Duration::from_millis(delay_ms)) => {},
                            _ = token.cancelled() => {
                                emit_cancelled(&progress_tx_clone, &post_id, index, total, &item_url);
                                return Err(DownloadError::Cancelled);
                            }
                        }
                    }
                    Err(e) => {
                        log::error!(
                            "[Post {}:{}/{}] All {} retries exhausted: {}",
                            post_id,
                            index + 1,
                            total,
                            config_clone.max_retries,
                            e
                        );
                        emit_progress(
                            &progress_tx_clone,
                            DownloadProgressPayload {
                                post_id: post_id.clone(),
                                index,
                                total,
                                status: "failed".to_string(),
                                url: item_url.clone(),
                                saved_path: None,
                                warning: None,
                            },
                        );
                        break Err(e);
                    }
                }
            }
        });
        handles.push(handle);
    }
    let mut saved_paths = Vec::new();
    for handle in handles {
        match handle.await {
            Ok(Ok((paths, _))) => saved_paths.extend(paths),
            Ok(Err(DownloadError::Cancelled)) => log::info!("Download item cancelled"),
            Ok(Err(e)) => log::error!("Error downloading item: {}", e),
            Err(e) => log::error!("Join error: {}", e),
        }
    }
    {
        let mut map = cancel_map.lock().map_err(|e| e.to_string())?;
        map.remove(&request.blog_id);
    }
    Ok(serde_json::json!({ "savedPaths": saved_paths, "count": saved_paths.len() }))
}

pub fn cancel_download_core(
    cancel_map: &Arc<Mutex<HashMap<String, CancellationToken>>>,
    post_id: &str,
) {
    if let Ok(map) = cancel_map.lock() {
        if let Some(token) = map.get(post_id) {
            token.cancel();
            log::info!("Cancelled download for post {}", post_id);
        }
    }
}

#[tauri::command]
pub async fn choose_download_dir(starting_folder: Option<String>) -> Result<String, String> {
    let mut dialog = rfd::FileDialog::new();
    if let Some(ref folder) = starting_folder {
        if !folder.is_empty() {
            dialog = dialog.set_directory(Path::new(folder));
        }
    }
    let result = dialog.pick_folder();
    Ok(result
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default())
}

#[tauri::command]
pub fn default_download_dir() -> String {
    DownloadConfig::default()
        .effective_download_root(None)
        .to_string_lossy()
        .into()
}

#[tauri::command]
pub async fn download_post(
    app_handle: tauri::AppHandle,
    request: DownloadPostRequest,
) -> Result<serde_json::Value, String> {
    use crate::types::{AppState, DownloadCancellationState, FALLBACK_USER_AGENT};
    use tauri::Manager;
    let config = DownloadConfig::default();
    let client = app_handle.state::<reqwest::Client>().inner().clone();
    let user_agent = app_handle
        .state::<AppState>()
        .user_agent
        .read()
        .map(|s| s.clone())
        .unwrap_or_else(|_| FALLBACK_USER_AGENT.to_string());
    let cancel_map = app_handle.state::<DownloadCancellationState>().0.clone();
    let (progress_tx, mut progress_rx) = broadcast::channel::<DownloadProgressPayload>(256);
    let app_for_forward = app_handle.clone();
    tokio::spawn(async move {
        use tauri::Emitter;
        while let Ok(payload) = progress_rx.recv().await {
            let _ = app_for_forward.emit("download-progress", payload);
        }
    });
    download_post_core(request, client, user_agent, config, cancel_map, progress_tx).await
}

#[tauri::command]
pub fn cancel_download_post(app_handle: tauri::AppHandle, post_id: String) -> Result<(), String> {
    use crate::types::DownloadCancellationState;
    use tauri::Manager;
    let state = app_handle.state::<DownloadCancellationState>();
    cancel_download_core(&state.0, &post_id);
    Ok(())
}
