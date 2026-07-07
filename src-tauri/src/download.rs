use chrono::{DateTime, Utc};
use std::fs::File;
use std::io::Write;
use std::path::Path;
use tauri::Emitter;

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
    let response = req.send().await.map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("HTTP error downloading: {}", response.status()));
    }

    let mut buffer = response.bytes().await.map_err(|e| e.to_string())?.to_vec();

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
                        }
                    }
                }
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

    let mut file = File::create(&target_path).map_err(|e| e.to_string())?;
    file.write_all(&buffer).map_err(|e| e.to_string())?;

    let exif_date_str = get_exif_date_string(created_at_dt, index as i64);
    let _ = write_exif(&target_path, &exif_date_str, location);

    saved_paths.push(target_path.to_string_lossy().to_string());

    if let Some(ref video_url) = item_video_url {
        let req_video = client
            .get(video_url)
            .header("Referer", "https://weibo.com/");
        if let Ok(res_video) = req_video.send().await {
            if res_video.status().is_success() {
                if let Ok(video_bytes) = res_video.bytes().await {
                    let video_extension = Path::new(video_url)
                        .extension()
                        .and_then(|ext| ext.to_str())
                        .map(|ext| format!(".{}", ext))
                        .unwrap_or_else(|| ".mov".to_string());
                    let video_filename = format!("{}{}", formatted_date, video_extension);
                    let video_target_path = resolved_download_dir.join(&video_filename);
                    if let Ok(mut video_file) = File::create(&video_target_path) {
                        if video_file.write_all(&video_bytes).is_ok() {
                            saved_paths.push(video_target_path.to_string_lossy().to_string());
                        }
                    }
                }
            }
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

    Ok(saved_paths)
}
