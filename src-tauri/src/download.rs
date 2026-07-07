use chrono::{DateTime, Utc};
use std::collections::HashSet;
use std::fs::File;
use std::io::Write;
use std::path::Path;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::Emitter;
use tauri::Manager;
use tokio::sync::Semaphore;
use tokio::time::{sleep, Duration};
use url::Url;

use crate::dates::{get_date_folder, parse_date};
use crate::dates::{get_exif_date_string, get_formatted_date};
use crate::exif::write_exif;
use crate::image::merge_bottom_three_percent;
use crate::types::{DownloadItem, DownloadProgressPayload, GpsData};
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
) -> Result<serde_json::Value, String> {
    let base_dir = match download_dir {
        Some(dir) if !dir.trim().is_empty() => PathBuf::from(dir),
        _ => dirs::download_dir().unwrap_or_else(|| PathBuf::from("WeiLens")),
    };

    let uid_segment = if uid.trim().is_empty() {
        "unknown_user"
    } else {
        &uid
    };

    let created_at_dt = parse_date(&created_at).unwrap_or_else(|| chrono::Utc::now());
    let date_segment = get_date_folder(&created_at_dt);

    let resolved_download_dir = base_dir.join(uid_segment).join(date_segment);
    std::fs::create_dir_all(&resolved_download_dir).map_err(|e| e.to_string())?;

    let mut saved_paths = Vec::new();
    let total = items.len();

    let client = app_handle.state::<reqwest::Client>().inner().clone();
    let semaphore = Arc::new(Semaphore::new(16));

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
        let client_clone = client.clone();
        let sem = semaphore.clone();

        let item_url = item.url.clone();
        let item_video = item.video_url.clone();

        let handle = tokio::spawn(async move {
            let _permit = sem.acquire().await;

            const MAX_RETRIES: u32 = 6;
            let mut attempt = 0u32;
            loop {
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
                    client_clone.clone(),
                )
                .await
                {
                    Ok(paths) => break Ok(paths),
                    Err(e) if attempt < MAX_RETRIES => {
                        attempt += 1;
                        let delay_ms = 150u64 * (1u64 << attempt.min(10));
                        log::warn!(
                            "[{}/{}] Post {} - Attempt {}/{} failed ({}). Retrying in {}ms…",
                            index + 1,
                            total,
                            &post_id_clone,
                            attempt,
                            MAX_RETRIES,
                            e,
                            delay_ms
                        );
                        sleep(Duration::from_millis(delay_ms)).await;
                    }
                    Err(e) => {
                        log::error!(
                            "[{}/{}] Post {} - All {} retries exhausted: {}",
                            index + 1,
                            total,
                            &post_id_clone,
                            MAX_RETRIES,
                            e
                        );
                        // Emit failed only after all retries done
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
            Ok(Err(e)) => log::error!("Error downloading item: {}", e),
            Err(e) => log::error!("Join error: {}", e),
        }
    }

    Ok(serde_json::json!({
        "savedPaths": saved_paths,
        "count": saved_paths.len()
    }))
}

#[tauri::command]
pub async fn choose_download_folder(starting_folder: Option<String>) -> Result<String, String> {
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
    client: reqwest::Client,
) -> Result<Vec<String>, String> {
    let mut saved_paths = Vec::new();
    let is_live_photo = item_video_url.is_some();
    let no_watermark_url = get_no_watermark_url(&item_url);

    log::info!(
        "[{}/{}] Starting download for post_id: {}. URL: {}",
        index + 1,
        total,
        post_id,
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

    let req = client
        .get(&item_url)
        .header("Referer", "https://weibo.com/");
    let response = req.send().await.map_err(|e| {
        let err = format!("Request failed: {}", e);
        log::error!("[{}/{}] Post {} - {}", index + 1, total, post_id, err);
        err
    })?;

    if !response.status().is_success() {
        let err = format!("HTTP error: {}", response.status());
        log::error!("[{}/{}] Post {} - {}", index + 1, total, post_id, err);
        return Err(err);
    }

    let mut buffer = response
        .bytes()
        .await
        .map_err(|e| {
            let err = format!("Failed to read response bytes: {}", e);
            log::error!("[{}/{}] Post {} - {}", index + 1, total, post_id, err);
            err
        })?
        .to_vec();

    if let Some(ref no_wm_url) = no_watermark_url {
        if no_wm_url != &item_url && !is_live_photo {
            let req_no_wm = client
                .get(no_wm_url)
                .header("Referer", "https://weibo.com/");
            if let Ok(res_no_wm) = req_no_wm.send().await {
                if res_no_wm.status().is_success() {
                    if let Ok(no_wm_bytes) = res_no_wm.bytes().await {
                        if let Ok(merged) = merge_bottom_three_percent(&buffer, &no_wm_bytes) {
                            buffer = merged;
                        } else {
                            log::warn!(
                                "[{}/{}] Post {} - Failed to merge watermark-free version",
                                index + 1,
                                total,
                                post_id
                            );
                        }
                    }
                } else {
                    log::warn!(
                        "[{}/{}] Post {} - Watermark-free request returned status: {}",
                        index + 1,
                        total,
                        post_id,
                        res_no_wm.status()
                    );
                }
            } else {
                log::warn!(
                    "[{}/{}] Post {} - Failed to connect for watermark-free image",
                    index + 1,
                    total,
                    post_id
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

    let mut file = File::create(&target_path).map_err(|e| {
        let err = format!("Failed to create file: {}", e);
        log::error!("[{}/{}] Post {} - {}", index + 1, total, post_id, err);
        err
    })?;
    file.write_all(&buffer).map_err(|e| {
        let err = format!("Failed to write file: {}", e);
        log::error!("[{}/{}] Post {} - {}", index + 1, total, post_id, err);
        err
    })?;

    log::info!(
        "[{}/{}] Post {} - Wrote image to {}",
        index + 1,
        total,
        post_id,
        target_path.display()
    );

    let exif_date_str = get_exif_date_string(created_at_dt, index as i64);
    if let Err(e) = write_exif(&target_path, &exif_date_str, location) {
        log::warn!(
            "[{}/{}] Post {} - Failed to write EXIF metadata: {}",
            index + 1,
            total,
            post_id,
            e
        );
    }

    saved_paths.push(target_path.to_string_lossy().to_string());

    if let Some(ref video_url) = item_video_url {
        log::info!(
            "[{}/{}] Post {} - Item is a Live Photo, downloading video from {}",
            index + 1,
            total,
            post_id,
            video_url
        );
        let req_video = client
            .get(video_url)
            .header("Referer", "https://weibo.com/");
        if let Ok(res_video) = req_video.send().await {
            if res_video.status().is_success() {
                if let Ok(video_bytes) = res_video.bytes().await {
                    let parsed = Url::parse(video_url).unwrap();
                    let path = parsed.path();
                    let video_extension = Path::new(path)
                        .extension()
                        .and_then(|e| e.to_str())
                        .map(|ext| format!(".{}", ext))
                        .unwrap_or_else(|| ".mov".to_string());
                    let video_filename = format!("{}{}", formatted_date, video_extension);
                    let video_target_path = resolved_download_dir.join(&video_filename);
                    if let Ok(mut video_file) = File::create(&video_target_path) {
                        if video_file.write_all(&video_bytes).is_ok() {
                            saved_paths.push(video_target_path.to_string_lossy().to_string());
                        } else {
                            log::error!(
                                "[{}/{}] Post {} - Failed to write video file data",
                                index + 1,
                                total,
                                post_id
                            );
                        }
                    } else {
                        log::error!(
                            "[{}/{}] Post {} - Failed to create video file: {:?}",
                            index + 1,
                            total,
                            post_id,
                            video_target_path
                        );
                    }
                }
            } else {
                log::error!(
                    "[{}/{}] Post {} - Video download request returned status: {}",
                    index + 1,
                    total,
                    post_id,
                    res_video.status()
                );
            }
        } else {
            log::error!(
                "[{}/{}] Post {} - Failed to connect for video download",
                index + 1,
                total,
                post_id
            );
        }
    }

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

    log::info!(
        "[{}/{}] Post {} - Completed successfully",
        index + 1,
        total,
        post_id
    );

    Ok(saved_paths)
}
