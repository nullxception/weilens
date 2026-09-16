#![allow(clippy::absolute_paths)]
mod app_context;
pub mod daemon;
mod crash;
mod dates;
mod db;
mod download;
mod exif;
mod image;
mod motion;
mod server;
mod types;
mod util;
mod weibo;

use crate::db::{
    add_place, clear_profile_history_cmd, delete_profile_history_cmd, get_place_by_post, init_db,
    list_places, list_profile_history_cmd, remove_blog_place, search_place, set_blog_place,
    upsert_profile_history_cmd, DbState,
};
#[allow(unused_imports)]
use crate::app_context::AppContext;
use crate::download::{
    cancel_download_post, choose_download_dir, default_download_dir, download_post,
};
use crate::image::handle_image_proxy;
use crate::types::{AppState, DownloadCancellationState, DownloadConfig, FALLBACK_USER_AGENT};
use log::LevelFilter;
use std::collections::HashMap;
use std::sync::{Arc, Mutex, RwLock};
use tauri::async_runtime;
use tauri::plugin::{Builder as PluginBuilder, TauriPlugin};
use tauri::{webview::PageLoadEvent, Manager};
use tauri_plugin_log::{Target, TargetKind};
use tauri_plugin_opener::OpenerExt;
fn external_navigation_plugin<R: tauri::Runtime>() -> TauriPlugin<R> {
    PluginBuilder::<R>::new("external-navigation")
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

#[tauri::command]
fn debug_read_app_log(lines: Option<usize>) -> Result<Vec<String>, String> {
    tail_log_file("app.log", lines)
}

#[tauri::command]
fn debug_read_crash_log(lines: Option<usize>) -> Result<Vec<String>, String> {
    tail_log_file("crash.log", lines)
}

fn tail_log_file(file: &str, lines: Option<usize>) -> Result<Vec<String>, String> {
    use std::fs;
    let n = lines.unwrap_or(500).clamp(1, 2000);
    let Some(dir) = dirs::data_dir() else {
        return Ok(vec![]);
    };
    let path = dir.join("io.chaldeaprjkt.WeiLens").join(file);
    let Ok(text) = fs::read_to_string(&path) else {
        return Ok(vec![]);
    };
    let all: Vec<String> = text.lines().map(|l| l.to_string()).collect();
    if all.len() <= n {
        return Ok(all);
    }
    Ok(all[all.len() - n..].to_vec())
}

#[tauri::command]
fn set_user_agent(state: tauri::State<AppState>, ua: String) {
    if let Ok(mut current) = state.user_agent.write() {
        *current = ua;
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let http_client = reqwest::Client::builder()
        .pool_max_idle_per_host(15)
        .build()
        .expect("Failed to build HTTP client (check TLS/network dependencies)");

    let user_agent = Arc::new(RwLock::new(FALLBACK_USER_AGENT.to_string()));

    tauri::Builder::default()
        .manage(http_client.clone())
        .manage(DownloadCancellationState(Arc::new(Mutex::new(HashMap::new()))))
        .manage(AppState {
            user_agent: user_agent.clone(),
        })
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(LevelFilter::Info)
                .level_for("little_exif", log::LevelFilter::Off)
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::Folder {
                        path: db::standalone_home(),
                        file_name: Some("app".into()),
                    }),
                    Target::new(TargetKind::Webview),
                ])
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(external_navigation_plugin())
        .setup(|app| {
            let conn = init_db(app.handle())?;
            app.manage(DbState(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_user_agent,
            debug_read_app_log,
            debug_read_crash_log,
            download_post,
            cancel_download_post,
            choose_download_dir,
            default_download_dir,
            list_places,
            get_place_by_post,
            add_place,
            search_place,
            set_blog_place,
            remove_blog_place,
            list_profile_history_cmd,
            upsert_profile_history_cmd,
            delete_profile_history_cmd,
            clear_profile_history_cmd,
            crate::db::get_settings,
            crate::db::save_settings,
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
                let user_agent = user_agent.clone();

                async_runtime::spawn(async move {
                    handle_image_proxy(client, request, responder, &user_agent).await;
                });
            },
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
#[allow(clippy::absolute_paths)]
pub fn serve(port: u16) {
    crash::init();
    // File logging for release (background server has no console on GUI subsystem)
    let home = db::standalone_home();
    let _ = std::fs::create_dir_all(&home);
    let log_file = home.join("app.log");
    // File-only logger: stderr is redirected to app.log for the detached
    // child, so echoing there would duplicate every line.
    if let Ok(f) = std::fs::OpenOptions::new().create(true).append(true).open(&log_file) {
        struct FileLogger { file: std::sync::Mutex<std::fs::File> }
        impl log::Log for FileLogger {
            fn enabled(&self, m: &log::Metadata) -> bool { m.level() <= log::Level::Info }
            fn log(&self, r: &log::Record) {
                if self.enabled(r.metadata()) {
                    let line = format!("[{} {}] {}\n", r.level(), r.target(), r.args());
                    let _ = std::io::Write::write_all(&mut *self.file.lock().unwrap(), line.as_bytes());
                }
            }
            fn flush(&self) {}
        }
        let logger = Box::new(FileLogger { file: std::sync::Mutex::new(f) });
        let leaked: &'static FileLogger = Box::leak(logger);
        let _ = log::set_logger(leaked);
        log::set_max_level(log::LevelFilter::Info);
    }
    log::info!("WeiLens server starting on 0.0.0.0:{port}, log at {}", log_file.display());

    let rt = tokio::runtime::Builder::new_multi_thread().enable_all().build().expect("tokio runtime");
    rt.block_on(async move { serve_async(port).await });
}

#[allow(clippy::absolute_paths)]
async fn serve_async(port: u16) {
    let http_client = reqwest::Client::builder()
        .pool_max_idle_per_host(15)
        .build()
        .expect("HTTP client");
    let user_agent = Arc::new(RwLock::new(FALLBACK_USER_AGENT.to_string()));
    let config = DownloadConfig::default();
    let cancel_map = Arc::new(Mutex::new(HashMap::new()));
    let (progress_tx, _rx) = tokio::sync::broadcast::channel::<crate::types::DownloadProgressPayload>(256);

    // Ensure DB exists and has correct schema
    let db_path = db::standalone_db_path();
    match db::init_standalone_db() {
        Ok(conn) => drop(conn),
        Err(e) => {
            log::error!("Failed to init DB at {}: {}", db_path.display(), e);
            eprintln!("Failed to init DB: {e}");
            std::process::exit(1);
        }
    }
    log::info!("DB at {}", db_path.display());

    let ctx = AppContext {
        http: http_client,
        user_agent,
        config,
        cancel: cancel_map,
        progress_tx,
        db_path,
    };

    let app = server::build_router(ctx);
    let addr = format!("0.0.0.0:{port}");
    let listener = tokio::net::TcpListener::bind(&addr).await.expect("bind");
    log::info!("Listening on http://{addr}");
    println!("WeiLens server listening on http://{addr}");
    if let Err(e) = axum::serve(listener, app).await {
        log::error!("Server error: {e}");
        eprintln!("Server error: {e}");
        std::process::exit(1);
    }
}

