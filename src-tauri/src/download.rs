use chrono::{DateTime, Utc};
use std::fs::File;
use std::io::Write;
use std::path::Path;
use tauri::Emitter;
use url::Url;

use crate::dates::{get_exif_date_string, get_formatted_date};
use crate::exif::write_exif;
use crate::image::merge_bottom_three_percent;
use crate::types::{DownloadProgressPayload, GpsData};
use crate::util::get_no_watermark_url;

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
