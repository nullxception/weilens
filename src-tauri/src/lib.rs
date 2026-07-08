mod dates;
mod download;
mod exif;
mod image;
mod motion;
mod types;
mod util;

use crate::download::{choose_download_dir, default_download_dir, download_post};
use log::LevelFilter;
use tauri::{
    http::header::REFERER, http::Request, http::Response, webview::PageLoadEvent,
    UriSchemeResponder,
};
use tauri_plugin_log::{Target, TargetKind};
use tauri_plugin_opener::OpenerExt;
use url::Url;

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

async fn handle_image_proxy(
    client: reqwest::Client,
    request: Request<Vec<u8>>,
    responder: UriSchemeResponder,
) {
    let uri_string = request.uri().to_string();

    let parsed_uri = match Url::parse(&uri_string) {
        Ok(u) => u,
        Err(_) => {
            let res = Response::builder().status(400).body(Vec::new()).unwrap();
            return responder.respond(res);
        }
    };

    let target_url_param = match parsed_uri.query_pairs().find(|(k, _)| k == "url") {
        Some((_, val)) => val.into_owned(),
        None => {
            let res = Response::builder().status(400).body(Vec::new()).unwrap();
            return responder.respond(res);
        }
    };

    let target_url = match Url::parse(&target_url_param) {
        Ok(u) => u,
        Err(_) => {
            let res = Response::builder().status(422).body(Vec::new()).unwrap();
            return responder.respond(res);
        }
    };

    let referer_host = format!(
        "{}://{}",
        target_url.scheme(),
        target_url.host_str().unwrap_or("")
    );

    let network_result = client
        .get(target_url.as_str())
        .header(REFERER, &referer_host)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        )
        .send()
        .await;

    let response = match network_result {
        Ok(outbound_res) => {
            let mime = outbound_res
                .headers()
                .get("content-type")
                .and_then(|h| h.to_str().ok())
                .unwrap_or("image/jpeg")
                .to_string();

            let status_code = outbound_res.status().as_u16();
            let bytes = outbound_res.bytes().await.unwrap_or_default();

            Response::builder()
                .status(status_code)
                .header("Content-Type", mime)
                .header("Access-Control-Allow-Origin", "*")
                .body(bytes.to_vec())
                .unwrap()
        }
        Err(_) => Response::builder().status(502).body(Vec::new()).unwrap(),
    };

    responder.respond(response);
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
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(LevelFilter::Info)
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir { file_name: None }),
                    Target::new(TargetKind::Webview),
                ])
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(external_navigation_plugin())
        .invoke_handler(tauri::generate_handler![
            download_post,
            choose_download_dir,
            default_download_dir,
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
