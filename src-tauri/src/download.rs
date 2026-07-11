use chrono::{DateTime, Utc};
use std::collections::HashSet;
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
use crate::image::merge_strip_three_percent;
use crate::image::StripPosition;
use crate::motion::mux_motion_photo;
use crate::types::{
    DownloadCancellationState, DownloadConfig, DownloadError, DownloadItem,
    DownloadProgressPayload, GpsData,
};
use crate::util::get_no_watermark_url;

#[tauri::command]
pub async fn download_post(
    app_handle: tauri::AppHandle,
    uid: String,
    post_id: String,
    created_at: String,
    items: Vec<DownloadItem>,
    download_dir: Option<String>,
    location: Option<GpsData>,
    wm_position: String,
) -> Result<serde_json::Value, String> {
    let config = DownloadConfig::default();
    let base_dir = config.effective_download_root(download_dir);

    let uid_segment = if uid.trim().is_empty() {
        "unknown_user"
    } else {
        &uid
    };

    let created_at_dt = parse_date(&created_at).unwrap_or_else(|| chrono::Utc::now());
    let date_segment = get_date_folder(&created_at_dt);

    let resolved_download_dir = base_dir.join(uid_segment).join(date_segment);
    std::fs::create_dir_all(&resolved_download_dir)
        .map_err(|e| DownloadError::CreateDir(e.to_string()))
        .map_err(|e| e.to_string())?;

    let mut saved_paths = Vec::new();
    let total = items.len();

    let client = app_handle.state::<reqwest::Client>().inner().clone();
    let semaphore = Arc::new(Semaphore::new(config.effective_max_concurrency()));

    let cancellation_token = CancellationToken::new();
    {
        let state = app_handle.state::<DownloadCancellationState>();
        let mut map = state.0.lock().map_err(|e| e.to_string())?;
        map.insert(post_id.clone(), cancellation_token.clone());
    }

    let mut hosts: HashSet<String> = HashSet::new();
    for it in items.iter() {
        if let Ok(parsed) = url::Url::parse(&it.url) {
            if let Some(host) = parsed.host_str() {
                let mut host_url = format!("{}://{}", parsed.scheme(), host);
                if let Some(port) = parsed.port() {
                    host_url = format!("{}:{}", host_url, port);
                }
                hosts.insert(host_url);
            }
        }
    }

    let mut handles = Vec::new();
    for (index, item) in items.iter().enumerate() {
        let app = app_handle.clone();
        let post_id_clone = post_id.clone();
        let created_at_dt_clone = created_at_dt.clone();
        let resolved_dir = resolved_download_dir.to_path_buf();
        let location_clone = location.clone();
        let wm_position_clone = wm_position.clone();
        let client_clone = client.clone();
        let sem = semaphore.clone();
        let config_clone = config.clone();
        let token = cancellation_token.clone();

        let item_url = item.url.clone();
        let item_video = item.video_url.clone();

        let handle = tokio::spawn(async move {
            if token.is_cancelled() {
                let _ = app.emit(
                    "download-progress",
                    DownloadProgressPayload {
                        post_id: post_id_clone.clone(),
                        index,
                        total,
                        status: "cancelled".to_string(),
                        url: item_url.clone(),
                        saved_path: None,
                    },
                );
                return Err("cancelled".to_string());
            }

            let _permit = sem.acquire().await;

            let mut attempt = 0u32;
            loop {
                if token.is_cancelled() {
                    let _ = app.emit(
                        "download-progress",
                        DownloadProgressPayload {
                            post_id: post_id_clone.clone(),
                            index,
                            total,
                            status: "cancelled".to_string(),
                            url: item_url.clone(),
                            saved_path: None,
                        },
                    );
                    return Err("cancelled".to_string());
                }

                match download_item(
                    &app,
                    &post_id_clone,
                    &created_at_dt_clone,
                    item_url.clone(),
                    item_video.clone(),
                    index,
                    total,
                    &resolved_dir,
                    location_clone.as_ref(),
                    &wm_position_clone,
                    client_clone.clone(),
                    config_clone.clone(),
                    token.clone(),
                )
                .await
                {
                    Ok(paths) => break Ok(paths),
                    Err(e) if e == "cancelled" => {
                        let _ = app.emit(
                            "download-progress",
                            DownloadProgressPayload {
                                post_id: post_id_clone.clone(),
                                index,
                                total,
                                status: "cancelled".to_string(),
                                url: item_url.clone(),
                                saved_path: None,
                            },
                        );
                        break Err(e);
                    }
                    Err(e) if attempt < config_clone.max_retries => {
                        attempt += 1;
                        let delay_ms = config_clone
                            .retry_base_delay_ms
                            .saturating_mul(1u64 << attempt.min(10))
                            .min(config_clone.retry_max_delay_ms);
                        log::warn!(
                            "[Post {}:{}/{}] Attempt {}/{} failed ({}). Retrying in {}ms…",
                            &post_id_clone,
                            index + 1,
                            total,
                            attempt,
                            config_clone.max_retries,
                            e,
                            delay_ms
                        );
                        sleep(Duration::from_millis(delay_ms)).await;
                    }
                    Err(e) => {
                        log::error!(
                            "[Post {}:{}/{}] All {} retries exhausted: {}",
                            &post_id_clone,
                            index + 1,
                            total,
                            config_clone.max_retries,
                            e
                        );
                        let _ = app.emit(
                            "download-progress",
                            crate::types::DownloadProgressPayload {
                                post_id: post_id_clone.clone(),
                                index,
                                total,
                                status: "failed".to_string(),
                                url: item_url.clone(),
                                saved_path: None,
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
            Ok(Ok(paths)) => saved_paths.extend(paths),
            Ok(Err(e)) if e == "cancelled" => {
                log::info!("Download item cancelled");
            }
            Ok(Err(e)) => log::error!("Error downloading item: {}", e),
            Err(e) => log::error!("Join error: {}", e),
        }
    }

    {
        let state = app_handle.state::<DownloadCancellationState>();
        let mut map = state.0.lock().map_err(|e| e.to_string())?;
        map.remove(&post_id);
    }

    Ok(serde_json::json!({
        "savedPaths": saved_paths,
        "count": saved_paths.len()
    }))
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

pub async fn download_item(
    app_handle: &tauri::AppHandle,
    post_id: &str,
    created_at_dt: &DateTime<Utc>,
    item_url: String,
    item_video_url: Option<String>,
    index: usize,
    total: usize,
    resolved_download_dir: &Path,
    location: Option<&GpsData>,
    wm_position: &str,
    client: reqwest::Client,
    config: DownloadConfig,
    cancellation_token: CancellationToken,
) -> Result<Vec<String>, String> {
    let mut saved_paths = Vec::new();
    let is_live_photo = item_video_url.is_some();
    let no_watermark_url = get_no_watermark_url(&item_url);

    log::info!(
        "[Post {}:{}/{}] Starting download. URL: {}",
        post_id,
        index + 1,
        total,
        item_url
    );

    let _ = app_handle.emit(
        "download-progress",
        DownloadProgressPayload {
            post_id: post_id.to_string(),
            index,
            total,
            status: "downloading".to_string(),
            url: item_url.clone(),
            saved_path: None,
        },
    );

    if cancellation_token.is_cancelled() {
        return Err("cancelled".to_string());
    }

    let req = client
        .get(&item_url)
        .timeout(Duration::from_secs(config.request_timeout_secs))
        .header("Referer", &config.referer)
        .header("User-Agent", &config.user_agent);
    let response = req.send().await.map_err(|e| {
        let err = DownloadError::Request(format!("Request failed: {}", e)).to_string();
        log::error!("[{}/{}] Post {} - {}", index + 1, total, post_id, err);
        err
    })?;

    if !response.status().is_success() {
        let err = DownloadError::Http(format!("HTTP error: {}", response.status())).to_string();
        log::error!("[{}/{}] Post {} - {}", index + 1, total, post_id, err);
        return Err(err);
    }

    let mut buffer = response
        .bytes()
        .await
        .map_err(|e| {
            let err =
                DownloadError::Request(format!("Failed to read response bytes: {}", e)).to_string();
            log::error!("[{}/{}] Post {} - {}", index + 1, total, post_id, err);
            err
        })?
        .to_vec();

    if let Some(ref no_wm_url) = no_watermark_url {
        if no_wm_url != &item_url && !is_live_photo {
            if cancellation_token.is_cancelled() {
                return Err("cancelled".to_string());
            }
            let req_no_wm = client
                .get(no_wm_url)
                .timeout(Duration::from_secs(config.request_timeout_secs))
                .header("Referer", &config.referer)
                .header("User-Agent", &config.user_agent);
            if let Ok(res_no_wm) = req_no_wm.send().await {
                if res_no_wm.status().is_success() {
                    if let Ok(no_wm_bytes) = res_no_wm.bytes().await {
                        let pos = match wm_position {
                            "top" => StripPosition::Top,
                            "center" => StripPosition::Center,
                            "bottom" => StripPosition::Bottom,
                            _ => StripPosition::Bottom,
                        };
                        if let Ok(merged) = merge_strip_three_percent(&buffer, &no_wm_bytes, pos) {
                            buffer = merged;
                        } else {
                            log::warn!(
                                "[Post {}:{}/{}] Failed to merge watermark-free version",
                                post_id,
                                index + 1,
                                total
                            );
                        }
                    }
                } else {
                    log::warn!(
                        "[Post {}:{}/{}] Watermark-free request returned status: {}",
                        post_id,
                        index + 1,
                        total,
                        res_no_wm.status()
                    );
                }
            } else {
                log::warn!(
                    "[Post {}:{}/{}] Failed to request watermark-free image",
                    post_id,
                    index + 1,
                    total
                );
            }
        }
    }

    let extension = Path::new(&item_url)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| format!(".{}", ext))
        .unwrap_or_else(|| ".jpg".to_string());

    let formatted_date = get_formatted_date(created_at_dt, index as i64);
    let image_filename = format!("{}{}", formatted_date, extension);
    let target_path = resolved_download_dir.join(&image_filename);

    let exif_date_str = get_exif_date_string(created_at_dt, index as i64);
    if let Err(e) = write_exif(&mut buffer, &exif_date_str, location, &extension) {
        log::warn!(
            "[Post {}:{}/{}] Failed to write EXIF metadata in memory: {}",
            post_id,
            index + 1,
            total,
            e
        );
    }

    // For live photos, mux the video into the image bytes in memory before
    // writing to disk so we only need a single file write.
    if is_live_photo {
        if let Some(ref video_url) = item_video_url {
            if cancellation_token.is_cancelled() {
                return Err("cancelled".to_string());
            }
            buffer =
                download_live_photo(&client, video_url, &buffer, &config, index, total, post_id, cancellation_token)
                    .await
                    .unwrap_or_else(|e| {
                        log::error!(
                            "[Post {}:{}/{}] Live photo mux failed, writing plain image: {}",
                            post_id,
                            index + 1,
                            total,
                            e
                        );
                        buffer.clone()
                    });
            log::info!(
                "[Post {}:{}/{}] Live photo muxed successfully, new size: {} bytes",
                post_id,
                index + 1,
                total,
                buffer.len()
            );
        }
    }

    let mut file = File::create(&target_path).map_err(|e| {
        let err = DownloadError::Io(e).to_string();
        log::error!("[Post {}:{}/{}] - {}", post_id, index + 1, total, err);
        err
    })?;
    file.write_all(&buffer).map_err(|e| {
        let err = DownloadError::Io(e).to_string();
        log::error!("[Post {}:{}/{}] - {}", post_id, index + 1, total, err);
        err
    })?;

    log::info!(
        "[Post {}:{}/{}] Wrote image to {}",
        post_id,
        index + 1,
        total,
        target_path.display()
    );

    saved_paths.push(target_path.to_string_lossy().to_string());

    let _ = app_handle.emit(
        "download-progress",
        DownloadProgressPayload {
            post_id: post_id.to_string(),
            index,
            total,
            status: "completed".to_string(),
            url: item_url.clone(),
            saved_path: Some(target_path.to_string_lossy().to_string()),
        },
    );

    log::info!("[Post {}:{}/{}] Completed", post_id, index + 1, total);

    Ok(saved_paths)
}

/// Downloads the video component of a live photo and muxes it with the already-downloaded
/// `image_bytes` entirely in memory.
///
/// Returns the muxed motion-photo bytes on success, or an error string on failure.
async fn download_live_photo(
    client: &reqwest::Client,
    video_url: &str,
    image_bytes: &[u8],
    config: &DownloadConfig,
    index: usize,
    total: usize,
    post_id: &str,
    cancellation_token: CancellationToken,
) -> Result<Vec<u8>, String> {
    log::info!(
        "[Post {}:{}/{}] Live Photo: Downloading video from {}",
        post_id,
        index + 1,
        total,
        video_url
    );

    if cancellation_token.is_cancelled() {
        return Err("cancelled".to_string());
    }

    let res = client
        .get(video_url)
        .timeout(Duration::from_secs(config.request_timeout_secs))
        .header("Referer", &config.referer)
        .header("User-Agent", &config.user_agent)
        .send()
        .await
        .map_err(|e| format!("Video request failed: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Video HTTP error: {}", res.status()));
    }

    let video_bytes = res
        .bytes()
        .await
        .map_err(|e| format!("Failed to read video bytes: {}", e))?;

    let url = Url::parse(video_url).unwrap();
    let mime = match Path::new(url.path())
        .extension()
        .and_then(|ext| ext.to_str())
    {
        Some("mp4") | Some("MP4") => "video/mp4",
        Some("mov") | Some("MOV") => "video/quicktime",
        _ => return Err("Unsupported url video format! Must be mp4 or mov".into()),
    };

    log::info!(
        "[Post {}:{}/{}]  - Muxing live photo video ({} bytes) in memory",
        post_id,
        index + 1,
        total,
        video_bytes.len()
    );

    mux_motion_photo(image_bytes, &video_bytes, &mime).map_err(|e| format!("Mux failed: {}", e))
}

#[tauri::command]
pub fn cancel_download(
    app_handle: tauri::AppHandle,
    post_id: String,
) -> Result<(), String> {
    let state = app_handle.state::<DownloadCancellationState>();
    let map = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(token) = map.get(&post_id) {
        token.cancel();
        log::info!("Cancelled download for post {}", post_id);
    }
    Ok(())
}
