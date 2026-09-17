use chrono::{DateTime, Utc};
use serde::Deserialize;
use std::collections::HashMap;
use std::fs::{create_dir_all, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tokio::sync::{broadcast, Semaphore};
use tokio::task::{spawn_blocking, JoinError, JoinSet};
use tokio::time::{sleep, Duration};
use tokio_util::sync::CancellationToken;
use url::Url;

use crate::dates;
use crate::exif;
use crate::image;
use crate::image::WmPosition;
use crate::motion;
use crate::types::{
    BlogId, DownloadConfig, DownloadError, DownloadItem, DownloadProgressPayload, DownloadStatus,
    GpsData, UserId,
};
use crate::util;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadPostRequest {
    pub uid: UserId,
    pub blog_id: BlogId,
    pub date: String,
    pub dewatermark: String,
    pub items: Vec<DownloadItem>,
    pub target: Option<String>,
    pub gps: Option<GpsData>,
}

pub struct DownloadTask {
    pub progress_tx: broadcast::Sender<DownloadProgressPayload>,
    pub post_id: BlogId,
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
        status: DownloadStatus::Cancelled,
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
    let pos: WmPosition = task.dewatermark.parse().unwrap_or_default();
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

pub async fn download(task: &DownloadTask) -> Result<(Vec<String>, Option<String>), DownloadError> {
    let mut saved_paths = Vec::new();
    let mut warning = None;

    check_cancelled(&task.cancellation_token)?;

    let response = cancellable_send(
        fetch_request(task, &task.item_url),
        &task.cancellation_token,
    )
    .await
    .inspect_err(|err| log_download_error(task, err))?;

    if !response.status().is_success() {
        let err = DownloadError::Http(format!("HTTP error: {}", response.status()));
        log_download_error(task, &err);
        return Err(err);
    }

    let mut buffer = cancellable_bytes(response, &task.cancellation_token)
        .await
        .inspect_err(|err| log_download_error(task, err))?;

    try_merge_watermark_free(task, &mut buffer).await;

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
        match process_motion(task, video_url, &buffer).await {
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
    let mut write_task = spawn_blocking(move || -> Result<(), DownloadError> {
        File::create(&target_path)?.write_all(&buffer)?;
        Ok(())
    });
    tokio::select! {
        result = &mut write_task => {
            result.map_err(|e| DownloadError::Request(format!("Join error: {e}")))??;
        }
        _ = task.cancellation_token.cancelled() => {
            // Detaching would let the write land after "cancelled"; abort instead and best-effort remove a partially written file.
            write_task.abort();
            let _ = std::fs::remove_file(&target_path_str);
            return Err(DownloadError::Cancelled);
        }
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
            post_id: task.post_id.to_string(),
            index: task.index,
            total: task.total,
            status: DownloadStatus::Completed,
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

struct ItemOutcome {
    index: usize,
    result: Result<(Vec<String>, Option<String>), DownloadError>,
}

// Shared per-item attempt state is built once by the caller; retries borrow it.
async fn run_item_with_retries(
    task: &DownloadTask,
    semaphore: &Semaphore,
) -> Result<(Vec<String>, Option<String>), DownloadError> {
    if task.cancellation_token.is_cancelled() {
        emit_cancelled(
            &task.progress_tx,
            task.post_id.as_ref(),
            task.index,
            task.total,
            &task.item_url,
        );
        return Err(DownloadError::Cancelled);
    }
    let permit_result = tokio::select! {
        permit = semaphore.acquire() => permit.map_err(|_| DownloadError::Cancelled),
        _ = task.cancellation_token.cancelled() => Err(DownloadError::Cancelled),
    };
    let Ok(_permit) = permit_result else {
        emit_cancelled(
            &task.progress_tx,
            task.post_id.as_ref(),
            task.index,
            task.total,
            &task.item_url,
        );
        return Err(DownloadError::Cancelled);
    };
    let mut attempt = 0u32;
    loop {
        if task.cancellation_token.is_cancelled() {
            emit_cancelled(
                &task.progress_tx,
                task.post_id.as_ref(),
                task.index,
                task.total,
                &task.item_url,
            );
            return Err(DownloadError::Cancelled);
        }
        match download(task).await {
            Ok(paths) => break Ok(paths),
            Err(DownloadError::Cancelled) => {
                emit_cancelled(
                    &task.progress_tx,
                    task.post_id.as_ref(),
                    task.index,
                    task.total,
                    &task.item_url,
                );
                break Err(DownloadError::Cancelled);
            }
            Err(e) if attempt < task.config.max_retries => {
                attempt += 1;
                let delay_ms = task
                    .config
                    .retry_base_delay_ms
                    .saturating_mul(1u64 << attempt.min(10))
                    .min(task.config.retry_max_delay_ms);
                log::warn!(
                    "[Post {}:{}/{}] Attempt {}/{} failed ({}). Retrying in {}ms…",
                    task.post_id,
                    task.index + 1,
                    task.total,
                    attempt,
                    task.config.max_retries,
                    e,
                    delay_ms
                );
                tokio::select! {
                    _ = sleep(Duration::from_millis(delay_ms)) => {}
                    _ = task.cancellation_token.cancelled() => {
                        emit_cancelled(
                            &task.progress_tx,
                            task.post_id.as_ref(),
                            task.index,
                            task.total,
                            &task.item_url,
                        );
                        return Err(DownloadError::Cancelled);
                    }
                }
            }
            Err(e) => {
                log::error!(
                    "[Post {}:{}/{}] All {} retries exhausted: {}",
                    task.post_id,
                    task.index + 1,
                    task.total,
                    task.config.max_retries,
                    e
                );
                emit_progress(
                    &task.progress_tx,
                    DownloadProgressPayload {
                        post_id: task.post_id.to_string(),
                        index: task.index,
                        total: task.total,
                        status: DownloadStatus::Failed,
                        url: task.item_url.clone(),
                        saved_path: None,
                        warning: None,
                    },
                );
                break Err(e);
            }
        }
    }
}

fn collect_outcome(
    res: Result<ItemOutcome, JoinError>,
    saved_paths: &mut Vec<String>,
    reported: &mut [bool],
) {
    match res {
        Ok(outcome) => {
            if let Some(seen) = reported.get_mut(outcome.index) {
                *seen = true;
            }
            match outcome.result {
                Ok((paths, _)) => saved_paths.extend(paths),
                Err(DownloadError::Cancelled) => log::info!("Download item cancelled"),
                Err(e) => log::error!("Error downloading item: {e}"),
            }
        }
        Err(e) if e.is_cancelled() => log::info!("Download item cancelled"),
        Err(e) => {
            // Panics and other join failures never retry; surface them as request errors.
            let e = DownloadError::Request(format!("task panicked: {e}"));
            log::error!("Error downloading item: {e}");
        }
    }
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
    let uid_segment = if request.uid.as_ref().trim().is_empty() {
        "unknown_user"
    } else {
        request.uid.as_ref()
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
        .insert(request.blog_id.to_string(), cancellation_token.clone());
    let mut tasks = JoinSet::new();
    for (index, item) in request.items.iter().enumerate() {
        let semaphore = semaphore.clone();
        let progress_tx = progress_tx.clone();
        // Single task value per item; retries borrow it instead of rebuilding.
        let task = DownloadTask {
            progress_tx: progress_tx.clone(),
            post_id: request.blog_id.clone(),
            created_at_dt,
            dewatermark: request.dewatermark.clone(),
            item_url: item.url.clone(),
            item_video_url: item.video_url.clone(),
            index,
            total,
            target_dir: download_dir.clone(),
            gps_loc: request.gps,
            client: client.clone(),
            config: config.clone(),
            user_agent: user_agent.clone(),
            cancellation_token: cancellation_token.clone(),
        };
        tasks.spawn(async move {
            let result = run_item_with_retries(&task, &semaphore).await;
            ItemOutcome { index, result }
        });
    }
    let mut reported = vec![false; total];
    let mut saved_paths = Vec::new();
    while let Some(res) = tasks.join_next().await {
        let cancelled_before_drain = cancellation_token.is_cancelled();
        collect_outcome(res, &mut saved_paths, &mut reported);
        if cancelled_before_drain {
            tasks.abort_all();
            while let Some(res) = tasks.join_next().await {
                collect_outcome(res, &mut saved_paths, &mut reported);
            }
            break;
        }
    }
    let was_cancelled = cancellation_token.is_cancelled();
    for (index, seen) in reported.iter().enumerate() {
        if *seen {
            continue;
        }
        if let Some(item) = request.items.get(index) {
            // Aborted tasks after a cancel read cancelled, anything else reads failed.
            if was_cancelled {
                emit_cancelled(
                    &progress_tx,
                    request.blog_id.as_ref(),
                    index,
                    total,
                    &item.url,
                );
            } else {
                emit_progress(
                    &progress_tx,
                    DownloadProgressPayload {
                        post_id: request.blog_id.to_string(),
                        index,
                        total,
                        status: DownloadStatus::Failed,
                        url: item.url.clone(),
                        saved_path: None,
                        warning: None,
                    },
                );
            }
        }
    }
    {
        let mut map = cancel_map.lock().map_err(|e| e.to_string())?;
        map.remove(&request.blog_id.0);
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
        loop {
            match progress_rx.recv().await {
                Ok(payload) => {
                    let _ = app_for_forward.emit("download-progress", payload);
                }
                // Slow frontend consumer: keep the latest progress flowing, never stall.
                Err(tokio::sync::broadcast::error::RecvError::Lagged(skipped)) => {
                    log::warn!("download-progress forwarder lagged, skipped {skipped} events");
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
            }
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
