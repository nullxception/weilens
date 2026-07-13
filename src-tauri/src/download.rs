use chrono::{DateTime, Utc};
use std::fs::File;
use std::io::Write;
use std::path::Path;
use std::sync::Arc;
use tauri::Emitter;
use tauri::Manager;
use tokio::sync::Semaphore;
use tokio::time::{sleep, Duration};
use tokio_util::sync::CancellationToken;
use url::Url;

use crate::dates::{get_date_folder, parse_date};
use crate::dates::{get_exif_date_string, get_formatted_date};
use crate::exif::write_exif;
use crate::image::dewatermark;
use crate::image::WmPosition;
use crate::motion::mux;
use crate::types::FALLBACK_USER_AGENT;
use crate::types::{
    DownloadCancellationState, DownloadConfig, DownloadError, DownloadItem,
    DownloadProgressPayload, GpsData,
};
use crate::util::get_no_watermark_url;

#[derive(serde::Deserialize)]
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
    pub app_handle: tauri::AppHandle,
    pub post_id: String,
    pub created_at_dt: DateTime<Utc>,
    pub dewatermark: String,
    pub item_url: String,
    pub item_video_url: Option<String>,
    pub index: usize,
    pub total: usize,
    pub target_dir: std::path::PathBuf,
    pub gps_loc: Option<GpsData>,
    pub client: reqwest::Client,
    pub config: DownloadConfig,
    pub user_agent: String,
    pub cancellation_token: CancellationToken,
}

fn emit_cancelled(app: &tauri::AppHandle, post_id: &str, index: usize, total: usize, url: &str) {
    let _ = app.emit(
        "download-progress",
        DownloadProgressPayload {
            post_id: post_id.to_string(),
            index,
            total,
            status: "cancelled".to_string(),
            url: url.to_string(),
            saved_path: None,
            warning: None,
        },
    );
}

async fn process_motion(
    task: &DownloadTask,
    video_url: &str,
    image_bytes: &[u8],
) -> Result<Vec<u8>, String> {
    log::info!(
        "[Post {}:{}/{}] Fetching video from {}",
        task.post_id,
        task.index + 1,
        task.total,
        video_url
    );

    if task.cancellation_token.is_cancelled() {
        return Err("cancelled".to_string());
    }

    let res = tokio::select! {
        res = task
            .client
            .get(video_url)
            .timeout(Duration::from_secs(task.config.request_timeout_secs))
            .header("Referer", &task.config.referer)
            .header("User-Agent", &task.user_agent)
            .send() => res.map_err(|e| format!("Video request failed: {}", e)),
        _ = task.cancellation_token.cancelled() => return Err("cancelled".to_string()),
    }?;

    if !res.status().is_success() {
        return Err(format!("Video HTTP error: {}", res.status()));
    }

    let video_bytes = tokio::select! {
        bytes = res.bytes() => bytes.map_err(|e| format!("Failed to read video bytes: {}", e)),
        _ = task.cancellation_token.cancelled() => return Err("cancelled".to_string()),
    }?;

    let url = Url::parse(video_url).map_err(|e| format!("Failed to parse video URL: {}", e))?;
    let mime = match Path::new(url.path())
        .extension()
        .and_then(|ext| ext.to_str())
    {
        Some("mp4") | Some("MP4") => "video/mp4",
        Some("mov") | Some("MOV") => "video/quicktime",
        _ => return Err("Unsupported url video format! Must be mp4 or mov".into()),
    };

    log::info!(
        "[Post {}:{}/{}] Muxing video ({} bytes) in memory",
        task.post_id,
        task.index + 1,
        task.total,
        video_bytes.len()
    );

    if task.cancellation_token.is_cancelled() {
        return Err("cancelled".to_string());
    }

    mux(image_bytes, &video_bytes, mime).map_err(|e| format!("Mux failed: {}", e))
}

pub async fn download(task: DownloadTask) -> Result<(Vec<String>, Option<String>), DownloadError> {
    let mut saved_paths = Vec::new();
    let is_motion = task.item_video_url.is_some();
    let no_watermark_url = get_no_watermark_url(&task.item_url);
    let mut warning = None;

    log::info!(
        "[Post {}:{}/{}] Starting download. URL: {}",
        task.post_id,
        task.index + 1,
        task.total,
        task.item_url
    );

    let _ = task.app_handle.emit(
        "download-progress",
        DownloadProgressPayload {
            post_id: task.post_id.clone(),
            index: task.index,
            total: task.total,
            status: "downloading".to_string(),
            url: task.item_url.clone(),
            saved_path: None,
            warning: None,
        },
    );

    if task.cancellation_token.is_cancelled() {
        return Err(DownloadError::Cancelled);
    }

    let req = task
        .client
        .get(&task.item_url)
        .timeout(Duration::from_secs(task.config.request_timeout_secs))
        .header("Referer", &task.config.referer)
        .header("User-Agent", &task.user_agent);
    let response = tokio::select! {
        res = req.send() => res.map_err(|e| {
            let err = DownloadError::Request(format!("Request failed: {}", e));
            log::error!("[{}/{}] Post {} - {}", task.index + 1, task.total, task.post_id, err);
            err
        })?,
        _ = task.cancellation_token.cancelled() => return Err(DownloadError::Cancelled),
    };

    if !response.status().is_success() {
        let err = DownloadError::Http(format!("HTTP error: {}", response.status()));
        log::error!(
            "[{}/{}] Post {} - {}",
            task.index + 1,
            task.total,
            task.post_id,
            err
        );
        return Err(err);
    }

    let mut buffer = tokio::select! {
        bytes = response.bytes() => bytes.map_err(|e| {
            let err = DownloadError::Request(format!("Failed to read response bytes: {}", e));
            log::error!("[{}/{}] Post {} - {}", task.index + 1, task.total, task.post_id, err);
            err
        })?.to_vec(),
        _ = task.cancellation_token.cancelled() => return Err(DownloadError::Cancelled),
    };

    if let Some(ref no_wm_url) = no_watermark_url {
        if no_wm_url != &task.item_url && !is_motion {
            if task.cancellation_token.is_cancelled() {
                return Err(DownloadError::Cancelled);
            }
            let req_no_wm = task
                .client
                .get(no_wm_url)
                .timeout(Duration::from_secs(task.config.request_timeout_secs))
                .header("Referer", &task.config.referer)
                .header("User-Agent", &task.user_agent);
            let res_no_wm = tokio::select! {
                res = req_no_wm.send() => res,
                _ = task.cancellation_token.cancelled() => return Err(DownloadError::Cancelled),
            };
            if let Ok(res_no_wm) = res_no_wm {
                if res_no_wm.status().is_success() {
                    let no_wm_bytes = tokio::select! {
                        bytes = res_no_wm.bytes() => bytes,
                        _ = task.cancellation_token.cancelled() => return Err(DownloadError::Cancelled),
                    };
                    if let Ok(no_wm_bytes) = no_wm_bytes {
                        if task.cancellation_token.is_cancelled() {
                            return Err(DownloadError::Cancelled);
                        }
                        let pos = match task.dewatermark.as_str() {
                            "top" => WmPosition::Top,
                            "center" => WmPosition::Center,
                            "bottom" => WmPosition::Bottom,
                            _ => WmPosition::Bottom,
                        };
                        if let Ok(merged) = dewatermark(&buffer, &no_wm_bytes, pos) {
                            buffer = merged;
                        } else {
                            log::warn!(
                                "[Post {}:{}/{}] Failed to merge watermark-free version",
                                task.post_id,
                                task.index + 1,
                                task.total
                            );
                        }
                    }
                } else {
                    log::warn!(
                        "[Post {}:{}/{}] Watermark-free request returned status: {}",
                        task.post_id,
                        task.index + 1,
                        task.total,
                        res_no_wm.status()
                    );
                }
            } else {
                log::warn!(
                    "[Post {}:{}/{}] Failed to request watermark-free image",
                    task.post_id,
                    task.index + 1,
                    task.total
                );
            }
        }
    }

    let extension = Path::new(&task.item_url)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| format!(".{}", ext))
        .unwrap_or_else(|| ".jpg".to_string());

    let formatted_date = get_formatted_date(&task.created_at_dt, task.index as i64);
    let image_filename = format!("{}{}", formatted_date, extension);
    let target_path = task.target_dir.join(&image_filename);

    let exif_date_str = get_exif_date_string(&task.created_at_dt, task.index as i64);
    if task.cancellation_token.is_cancelled() {
        return Err(DownloadError::Cancelled);
    }
    if let Err(e) = write_exif(
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

    // For motion, mux the video into the image bytes in memory before
    // writing to disk so we only need a single file write.
    if is_motion {
        if let Some(ref video_url) = task.item_video_url {
            if task.cancellation_token.is_cancelled() {
                return Err(DownloadError::Cancelled);
            }
            match process_motion(&task, video_url, &buffer).await {
                Ok(muxed) => buffer = muxed,
                Err(e) => {
                    log::error!(
                        "[Post {}:{}/{}] mux failed, writing plain image: {}",
                        task.post_id,
                        task.index + 1,
                        task.total,
                        e
                    );
                    warning = Some(format!(
                        "Motion photo mux failed: {}, saved as still image",
                        e
                    ));
                }
            }
            log::info!(
                "[Post {}:{}/{}] muxed successfully, new size: {} bytes",
                task.post_id,
                task.index + 1,
                task.total,
                buffer.len()
            );
        }
    }

    if task.cancellation_token.is_cancelled() {
        return Err(DownloadError::Cancelled);
    }
    let target_path_str = target_path.to_string_lossy().to_string();
    tokio::select! {
        result = tokio::task::spawn_blocking(move || -> Result<(), DownloadError> {
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

    let _ = task.app_handle.emit(
        "download-progress",
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
    let config = DownloadConfig::default();
    let base_dir = config.effective_download_root(request.target);

    let uid_segment = if request.uid.trim().is_empty() {
        "unknown_user"
    } else {
        &request.uid
    };

    let created_at_dt = parse_date(&request.date).unwrap_or_else(chrono::Utc::now);
    let date_segment = get_date_folder(&created_at_dt);

    let download_dir = base_dir.join(uid_segment).join(date_segment);
    std::fs::create_dir_all(&download_dir)
        .map_err(|e| DownloadError::CreateDir(e.to_string()))
        .map_err(|e| e.to_string())?;

    let mut saved_paths = Vec::new();
    let total = request.items.len();

    let client = app_handle.state::<reqwest::Client>().inner().clone();
    let user_agent = app_handle
        .state::<crate::types::AppState>()
        .user_agent
        .read()
        .map(|s| s.clone())
        .unwrap_or_else(|_| FALLBACK_USER_AGENT.to_string());
    let semaphore = Arc::new(Semaphore::new(config.effective_max_concurrency()));

    let cancellation_token = CancellationToken::new();
    {
        let state = app_handle.state::<DownloadCancellationState>();
        let mut map = state.0.lock().map_err(|e| e.to_string())?;
        map.insert(request.blog_id.clone(), cancellation_token.clone());
    }

    let mut handles = Vec::new();
    for (index, item) in request.items.iter().enumerate() {
        let sem = semaphore.clone();
        let token = cancellation_token.clone();
        let config_clone = config.clone();
        let post_id = request.blog_id.clone();
        let app = app_handle.clone();
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
                emit_cancelled(&app, &post_id, index, total, &item_url);
                return Err(DownloadError::Cancelled);
            }

            let _permit = tokio::select! {
                permit = sem.acquire() => permit,
                _ = token.cancelled() => {
                    emit_cancelled(&app, &post_id, index, total, &item_url);
                    return Err(DownloadError::Cancelled);
                }
            };

            let mut attempt = 0u32;
            loop {
                if token.is_cancelled() {
                    emit_cancelled(&app, &post_id, index, total, &item_url);
                    return Err(DownloadError::Cancelled);
                }

                let task = DownloadTask {
                    app_handle: app.clone(),
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
                        emit_cancelled(&app, &post_id, index, total, &item_url);
                        break Err(DownloadError::Cancelled);
                    }
                    Err(ref e) if attempt < config_clone.max_retries => {
                        attempt += 1;
                        let delay_ms = config_clone
                            .retry_base_delay_ms
                            .saturating_mul(1u64 << attempt.min(10))
                            .min(config_clone.retry_max_delay_ms);
                        log::warn!(
                            "[Post {}:{}/{}] Attempt {}/{} failed ({}). Retrying in {}ms…",
                            &post_id,
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
                                emit_cancelled(&app, &post_id, index, total, &item_url);
                                return Err(DownloadError::Cancelled);
                            }
                        }
                    }
                    Err(e) => {
                        log::error!(
                            "[Post {}:{}/{}] All {} retries exhausted: {}",
                            &post_id,
                            index + 1,
                            total,
                            config_clone.max_retries,
                            e
                        );
                        let _ = app.emit(
                            "download-progress",
                            crate::types::DownloadProgressPayload {
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

    for handle in handles {
        match handle.await {
            Ok(Ok((paths, _))) => saved_paths.extend(paths),
            Ok(Err(DownloadError::Cancelled)) => {
                log::info!("Download item cancelled");
            }
            Ok(Err(e)) => log::error!("Error downloading item: {}", e),
            Err(e) => log::error!("Join error: {}", e),
        }
    }

    {
        let state = app_handle.state::<DownloadCancellationState>();
        let mut map = state.0.lock().map_err(|e| e.to_string())?;
        map.remove(&request.blog_id);
    }

    Ok(serde_json::json!({
        "savedPaths": saved_paths,
        "count": saved_paths.len()
    }))
}

#[tauri::command]
pub fn cancel_download_post(app_handle: tauri::AppHandle, post_id: String) -> Result<(), String> {
    let state = app_handle.state::<DownloadCancellationState>();
    let map = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(token) = map.get(&post_id) {
        token.cancel();
        log::info!("Cancelled download for post {}", post_id);
    }
    Ok(())
}
