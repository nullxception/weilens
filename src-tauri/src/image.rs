use std::sync::{Arc, RwLock};
use std::time::Duration;
use tauri::{http::header::REFERER, http::Request, http::Response, UriSchemeResponder};
use url::Url;

pub enum WmPosition {
    Top,
    Center,
    Bottom,
}

pub fn dewatermark(
    wm_bytes: &[u8],
    no_wm_bytes: &[u8],
    position: WmPosition,
) -> Result<Vec<u8>, String> {
    use image::{imageops, GenericImageView};

    let mut img_wm = image::load_from_memory(wm_bytes)
        .map_err(|e| format!("Failed to load watermarked image: {}", e))?;
    let img_no_wm = image::load_from_memory(no_wm_bytes)
        .map_err(|e| format!("Failed to load no-watermark image: {}", e))?;

    let (width, height) = img_wm.dimensions();
    let resized_no_wm =
        img_no_wm.resize_exact(width, height, image::imageops::FilterType::Triangle);

    let strip_height = std::cmp::max(1, (height as f32 * 0.03).round() as u32);

    let start_y = match position {
        WmPosition::Top => 0,
        WmPosition::Center => (height.saturating_sub(strip_height)) / 2,
        WmPosition::Bottom => height.saturating_sub(strip_height),
    };
    let end_y = std::cmp::min(start_y + strip_height, height);
    let strip_h = end_y - start_y;

    let strip = resized_no_wm.view(0, start_y, width, strip_h).to_image();
    imageops::overlay(&mut img_wm, &strip, 0, start_y as i64);

    let mut out_bytes = std::io::Cursor::new(Vec::new());
    img_wm
        .write_to(&mut out_bytes, image::ImageFormat::Jpeg)
        .map_err(|e| format!("Failed to encode merged image: {}", e))?;

    Ok(out_bytes.into_inner())
}

pub async fn handle_image_proxy(
    client: reqwest::Client,
    request: Request<Vec<u8>>,
    responder: UriSchemeResponder,
    user_agent: &Arc<RwLock<String>>,
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

    let ua = user_agent
        .read()
        .map(|s| s.clone())
        .unwrap_or_else(|_| "Mozilla/5.0".to_string());

    let network_result = client
        .get(target_url.as_str())
        .header(REFERER, &referer_host)
        .header("User-Agent", ua)
        .timeout(Duration::from_secs(30))
        .send()
        .await;

    let response = match network_result {
        Ok(outbound_res) => {
            let headers = outbound_res.headers().clone();

            let mime = headers
                .get("content-type")
                .and_then(|h| h.to_str().ok())
                .unwrap_or("image/jpeg")
                .to_string();

            let status_code = outbound_res.status().as_u16();
            let bytes = outbound_res.bytes().await.unwrap_or_default();

            let cache_control = headers.get("cache-control").and_then(|h| h.to_str().ok());
            let etag = headers.get("etag").and_then(|h| h.to_str().ok());
            let expires = headers.get("expires").and_then(|h| h.to_str().ok());
            let last_modified = headers.get("last-modified").and_then(|h| h.to_str().ok());

            let mut builder = Response::builder()
                .status(status_code)
                .header("Content-Type", mime)
                .header("Access-Control-Allow-Origin", "*");

            if let Some(cc) = cache_control {
                builder = builder.header("Cache-Control", cc);
            }
            if let Some(etag) = etag {
                builder = builder.header("ETag", etag);
            }
            if let Some(exp) = expires {
                builder = builder.header("Expires", exp);
            }
            if let Some(lm) = last_modified {
                builder = builder.header("Last-Modified", lm);
            }

            builder.body(bytes.to_vec()).unwrap()
        }
        Err(_) => Response::builder().status(502).body(Vec::new()).unwrap(),
    };

    responder.respond(response);
}
