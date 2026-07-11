mod dates;
mod db;
mod download;
mod exif;
mod image;
mod motion;
mod types;
mod util;

use crate::db::{
    add_place, get_place_by_post, init_db, list_places, remove_blog_place, search_place,
    set_blog_place, DbState,
};
use crate::download::{cancel_download, choose_download_dir, default_download_dir, download_post};
use crate::image::handle_image_proxy;
use crate::types::DownloadCancellationState;
use log::LevelFilter;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{webview::PageLoadEvent, Manager};
use tauri_plugin_log::{Target, TargetKind};
use tauri_plugin_opener::OpenerExt;

fn external_navigation_plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::<R>::new("external-navigation")
        .on_navigation(|webview, url| {
            let is_internal_host = matches!(
                url.host_str(),
                Some("localhost") | Some("127.0.0.1") | Some("tauri.localhost") | Some("::1")
            );

            let is_internal = url.scheme() == "tauri" || is_internal_host;

            if is_internal {
                return true;
            }

            let is_external_link = matches!(url.scheme(), "http" | "https" | "mailto" | "tel");

            if is_external_link {
                log::info!("opening external link in system browser: {}", url);
                let _ = webview.opener().open_url(url.as_str(), None::<&str>);
                return false;
            }

            true
        })
        .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Shared concurrent connection pool wrapper
    let http_client = reqwest::Client::builder()
        .pool_max_idle_per_host(15)
        .build()
        .unwrap();

    tauri::Builder::default()
        .manage(http_client.clone())
        .manage(DownloadCancellationState(Mutex::new(HashMap::new())))
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(LevelFilter::Info)
                .level_for("little_exif", log::LevelFilter::Off)
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir { file_name: None }),
                    Target::new(TargetKind::Webview),
                ])
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(external_navigation_plugin())
        .setup(|app| {
            let conn = init_db(app.handle()).expect("Failed to initialize database");
            app.manage(DbState(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            download_post,
            cancel_download,
            choose_download_dir,
            default_download_dir,
            list_places,
            get_place_by_post,
            add_place,
            search_place,
            set_blog_place,
            remove_blog_place,
        ])
        .on_page_load(|webview, payload| {
            if webview.label() == "main" && matches!(payload.event(), PageLoadEvent::Finished) {
                log::info!("main webview finished loading");
                let _ = webview.window().show();
            }
        })
        // Register standard string identifier "img-proxy"
        .register_asynchronous_uri_scheme_protocol(
            "img-proxy",
            move |_context, request, responder| {
                let client = http_client.clone();

                tauri::async_runtime::spawn(async move {
                    handle_image_proxy(client, request, responder).await;
                });
            },
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
