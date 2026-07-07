use std::collections::HashSet;
use std::path::Path;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::OnceLock;

use tokio::sync::Semaphore;

use crate::dates::{get_date_folder, parse_date};
use crate::download::download_item;
use crate::types::{DownloadItem, GpsData};

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

    static SHARED_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    let client = SHARED_CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .build()
                .expect("failed to build reqwest client")
        })
        .clone();
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
            download_item(
                &app,
                &post_id_clone,
                &created_at_dt_clone,
                item_url,
                item_video,
                index,
                total,
                &resolved_dir,
                location_clone.as_ref(),
                client_clone,
            )
            .await
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
