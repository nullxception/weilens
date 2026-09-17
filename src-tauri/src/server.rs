#![allow(dead_code)]
#![allow(clippy::absolute_paths)]
use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::{header, HeaderMap, StatusCode, Uri},
    response::{IntoResponse, Response, Sse},
    routing::{delete, get, post},
    Json, Router,
};
use rust_embed::RustEmbed;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::convert::Infallible;
use tokio::fs;
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::StreamExt;
use tower_http::cors::{Any, CorsLayer};

use crate::app_context::AppContext;
use crate::db;
use crate::download::{cancel_download_core, download_post_core, DownloadPostRequest};
use crate::weibo;

#[derive(RustEmbed)]
#[folder = "../dist"]
struct Assets;

fn asset_response(path: &str) -> Option<Response<Body>> {
    let asset = Assets::get(path)?;
    let mime = mime_guess::from_path(path)
        .first_or_octet_stream()
        .to_string();
    let body = Body::from(asset.data.into_owned());
    let mut res = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, mime)
        .body(body)
        .ok()?;
    if path.contains('.') {
        // Vite filenames carry a content hash, long cache is safe.
        res.headers_mut().insert(
            header::CACHE_CONTROL,
            "public, max-age=31536000, immutable".parse().ok()?,
        );
    }
    Some(res)
}

async fn serve_embed(uri: Uri) -> Response<Body> {
    let path = uri.path().trim_start_matches('/');
    if !path.is_empty() {
        if let Some(r) = asset_response(path) {
            return r;
        }
    }
    asset_response("index.html")
        .unwrap_or_else(|| (StatusCode::NOT_FOUND, "not found").into_response())
}

#[derive(Deserialize)]
struct SettingsPut {
    cookie: Option<String>,
    #[serde(rename = "downloadPath")]
    download_path: Option<String>,
    #[serde(rename = "wmPosition")]
    wm_position: Option<String>,
    #[serde(rename = "onboardingDismissed")]
    onboarding_dismissed: Option<String>,
}

#[derive(Serialize)]
struct SettingsGet {
    cookie: Option<String>,
    #[serde(rename = "downloadPath")]
    download_path: Option<String>,
    #[serde(rename = "wmPosition")]
    wm_position: Option<String>,
    #[serde(rename = "onboardingDismissed")]
    onboarding_dismissed: Option<String>,
}

fn read_setting(ctx: &AppContext, key: &str) -> Option<String> {
    let conn = rusqlite::Connection::open(&ctx.db_path).ok()?;
    db::get_setting(&conn, key).ok().flatten()
}

fn write_setting(ctx: &AppContext, key: &str, val: &str) -> Result<(), String> {
    let conn = rusqlite::Connection::open(&ctx.db_path).map_err(|e| e.to_string())?;
    db::set_setting(&conn, key, val).map_err(|e| e.to_string())
}

async fn get_settings(State(ctx): State<AppContext>) -> Json<SettingsGet> {
    Json(SettingsGet {
        cookie: read_setting(&ctx, "cookie"),
        download_path: read_setting(&ctx, "download_path"),
        wm_position: read_setting(&ctx, "wm_position"),
        onboarding_dismissed: read_setting(&ctx, "onboarding_dismissed"),
    })
}

async fn put_settings(
    State(ctx): State<AppContext>,
    Json(body): Json<SettingsPut>,
) -> Result<Json<SettingsGet>, (StatusCode, String)> {
    if let Some(v) = body.wm_position.as_deref() {
        if !matches!(v, "top" | "center" | "bottom") {
            return Err((
                StatusCode::UNPROCESSABLE_ENTITY,
                "wmPosition must be top|center|bottom".into(),
            ));
        }
    }
    if let Some(v) = body.cookie {
        write_setting(&ctx, "cookie", &v).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    }
    if let Some(v) = body.download_path {
        write_setting(&ctx, "download_path", &v)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    }
    if let Some(v) = body.wm_position {
        write_setting(&ctx, "wm_position", &v)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    }
    if let Some(v) = body.onboarding_dismissed {
        write_setting(&ctx, "onboarding_dismissed", &v)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    }
    Ok(Json(SettingsGet {
        cookie: read_setting(&ctx, "cookie"),
        download_path: read_setting(&ctx, "download_path"),
        wm_position: read_setting(&ctx, "wm_position"),
        onboarding_dismissed: read_setting(&ctx, "onboarding_dismissed"),
    }))
}

#[derive(Deserialize, Serialize, Clone)]
struct HistoryItem {
    uid: String,
    #[serde(rename = "screenName")]
    screen_name: String,
    #[serde(rename = "profileImageUrl", alias = "avatar")]
    profile_image_url: String,
    timestamp: i64,
}

async fn get_history(
    State(ctx): State<AppContext>,
) -> Result<Json<Vec<HistoryItem>>, (StatusCode, String)> {
    let conn = rusqlite::Connection::open(&ctx.db_path)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let rows = db::list_profile_history(&conn)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(
        rows.into_iter()
            .map(|r| HistoryItem {
                uid: r.uid,
                screen_name: r.screen_name,
                profile_image_url: r.avatar,
                timestamp: r.timestamp,
            })
            .collect(),
    ))
}

async fn post_history(
    State(ctx): State<AppContext>,
    Json(item): Json<HistoryItem>,
) -> Result<Json<HistoryItem>, (StatusCode, String)> {
    let conn = rusqlite::Connection::open(&ctx.db_path)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    db::upsert_profile_history(
        &conn,
        &db::ProfileHistoryRow {
            uid: item.uid.clone(),
            screen_name: item.screen_name.clone(),
            avatar: item.profile_image_url.clone(),
            timestamp: item.timestamp,
        },
    )
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(item))
}

async fn delete_history(State(ctx): State<AppContext>) -> Result<StatusCode, (StatusCode, String)> {
    let conn = rusqlite::Connection::open(&ctx.db_path)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    db::clear_profile_history(&conn)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::NO_CONTENT)
}

async fn delete_history_item(
    State(ctx): State<AppContext>,
    Path(uid): Path<String>,
) -> Result<StatusCode, (StatusCode, String)> {
    let conn = rusqlite::Connection::open(&ctx.db_path)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    db::delete_profile_history(&conn, &uid)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
struct PlacesQuery {
    limit: Option<usize>,
    offset: Option<usize>,
}

async fn get_places(
    State(ctx): State<AppContext>,
    Query(q): Query<PlacesQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let conn = rusqlite::Connection::open(&ctx.db_path)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let total: usize = conn
        .query_row("SELECT COUNT(*) FROM places", [], |r| r.get(0))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let limit = q.limit.unwrap_or(total);
    let offset = q.offset.unwrap_or(0);
    let mut stmt = conn
        .prepare("SELECT lat, lon, name FROM places LIMIT ? OFFSET ?")
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let places: Vec<serde_json::Value> = stmt.query_map(rusqlite::params![limit as i64, offset as i64], |row| {
        Ok(serde_json::json!({ "lat": row.get::<_, f64>(0)?, "lon": row.get::<_, f64>(1)?, "name": row.get::<_, String>(2)? }))
    }).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .collect::<Result<_, _>>().map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(
        serde_json::json!({ "places": places, "total": total }),
    ))
}

#[derive(Deserialize)]
struct SearchQuery {
    q: Option<String>,
    query: Option<String>,
}

async fn search_places(
    State(ctx): State<AppContext>,
    Query(q): Query<SearchQuery>,
) -> Result<Json<Vec<serde_json::Value>>, (StatusCode, String)> {
    let term = q.q.or(q.query).unwrap_or_default();
    let pattern = format!("%{}%", term);
    let conn = rusqlite::Connection::open(&ctx.db_path)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let mut stmt = conn
        .prepare("SELECT lat, lon, name FROM places WHERE name LIKE ?1")
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let rows = stmt.query_map(rusqlite::params![pattern], |row| {
        Ok(serde_json::json!({ "lat": row.get::<_, f64>(0)?, "lon": row.get::<_, f64>(1)?, "name": row.get::<_, String>(2)? }))
    }).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .collect::<Result<Vec<_>, _>>().map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
struct PlaceBody {
    lat: f64,
    lon: f64,
    name: String,
}

async fn post_place(
    State(ctx): State<AppContext>,
    Json(body): Json<PlaceBody>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let conn = rusqlite::Connection::open(&ctx.db_path)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    conn.execute(
        "INSERT OR IGNORE INTO places (lat, lon, name) VALUES (?1, ?2, ?3)",
        rusqlite::params![body.lat, body.lon, body.name],
    )
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

#[derive(Deserialize)]
struct BlogPlaceQuery {
    uid: String,
    #[serde(alias = "blogId")]
    blog_id: String,
    #[serde(alias = "mblogid")]
    mblogid: Option<String>,
}

async fn get_blog_place(
    State(ctx): State<AppContext>,
    Query(q): Query<BlogPlaceQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let bid = q.mblogid.unwrap_or(q.blog_id);
    let conn = rusqlite::Connection::open(&ctx.db_path)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let mut stmt = conn.prepare("SELECT p.lat, p.lon, p.name FROM blog_places bp JOIN places p ON bp.place_id = p.id WHERE bp.user_id = ?1 AND bp.mblogid = ?2 LIMIT 1").map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let place: serde_json::Value = stmt.query_row(rusqlite::params![q.uid, bid], |row| {
        Ok(serde_json::json!({ "lat": row.get::<_, f64>(0)?, "lon": row.get::<_, f64>(1)?, "name": row.get::<_, String>(2)? }))
    }).map_err(|e| (StatusCode::NOT_FOUND, e.to_string()))?;
    Ok(Json(place))
}

#[derive(Deserialize)]
struct BlogPlacePut {
    uid: String,
    #[serde(alias = "blogId")]
    blog_id: String,
    place: PlaceBody,
}

async fn put_blog_place(
    State(ctx): State<AppContext>,
    Json(body): Json<BlogPlacePut>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let conn = rusqlite::Connection::open(&ctx.db_path)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let place_id: i64 = conn.query_row(
        "INSERT INTO places (lat, lon, name) VALUES (?1, ?2, ?3) ON CONFLICT(lat, lon, name) DO UPDATE SET lat = lat RETURNING id",
        rusqlite::params![body.place.lat, body.place.lon, body.place.name],
        |row| row.get(0)
    ).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    conn.execute(
        "INSERT OR REPLACE INTO blog_places (user_id, mblogid, place_id) VALUES (?1, ?2, ?3)",
        rusqlite::params![body.uid, body.blog_id, place_id],
    )
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    conn.execute(
        "DELETE FROM places WHERE id NOT IN (SELECT place_id FROM blog_places)",
        [],
    )
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

async fn delete_blog_place(
    State(ctx): State<AppContext>,
    Query(q): Query<BlogPlaceQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let bid = q.mblogid.unwrap_or(q.blog_id);
    let conn = rusqlite::Connection::open(&ctx.db_path)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    conn.execute(
        "DELETE FROM blog_places WHERE user_id = ?1 AND mblogid = ?2",
        rusqlite::params![q.uid, bid],
    )
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    conn.execute(
        "DELETE FROM places WHERE id NOT IN (SELECT place_id FROM blog_places)",
        [],
    )
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

async fn post_download(
    State(ctx): State<AppContext>,
    Json(req): Json<DownloadPostRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let ua = ctx
        .user_agent
        .read()
        .map(|s| s.clone())
        .unwrap_or_else(|_| crate::types::FALLBACK_USER_AGENT.to_string());
    let val = download_post_core(
        req,
        ctx.http.clone(),
        ua,
        ctx.config.clone(),
        ctx.cancel.clone(),
        ctx.progress_tx.clone(),
    )
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(Json(val))
}

#[derive(Deserialize)]
struct CancelBody {
    #[serde(alias = "postId")]
    post_id: Option<String>,
    #[serde(alias = "blogId")]
    blog_id: Option<String>,
}

async fn post_cancel(
    State(ctx): State<AppContext>,
    Json(body): Json<CancelBody>,
) -> Json<serde_json::Value> {
    let id = body.post_id.or(body.blog_id).unwrap_or_default();
    cancel_download_core(&ctx.cancel, &id);
    Json(serde_json::json!({ "ok": true }))
}

async fn get_download_dir_default(State(ctx): State<AppContext>) -> Json<serde_json::Value> {
    let path = ctx
        .config
        .effective_download_root(read_setting(&ctx, "download_path").as_deref())
        .to_string_lossy()
        .to_string();
    // Prefer server-side download_path setting if present, else default
    Json(serde_json::json!({ "path": path }))
}

async fn get_events(
    State(ctx): State<AppContext>,
) -> Sse<impl tokio_stream::Stream<Item = Result<axum::response::sse::Event, Infallible>>> {
    let rx = ctx.progress_tx.subscribe();
    let stream = BroadcastStream::new(rx).filter_map(|res| {
        res.ok()
            .and_then(|payload| serde_json::to_string(&payload).ok())
            .map(|data| Ok(axum::response::sse::Event::default().data(data)))
    });
    Sse::new(stream).keep_alive(axum::response::sse::KeepAlive::default())
}

#[derive(Deserialize)]
struct UserAgentBody {
    ua: Option<String>,
    #[serde(alias = "userAgent")]
    user_agent: Option<String>,
}

async fn post_user_agent(
    State(ctx): State<AppContext>,
    Json(body): Json<UserAgentBody>,
) -> Json<serde_json::Value> {
    let ua = body.ua.or(body.user_agent).unwrap_or_default();
    if !ua.is_empty() {
        if let Ok(mut cur) = ctx.user_agent.write() {
            *cur = ua;
        }
    }
    Json(serde_json::json!({ "ok": true }))
}

async fn get_img_proxy(
    State(ctx): State<AppContext>,
    Query(params): Query<HashMap<String, String>>,
) -> Response<Body> {
    let Some(target) = params.get("url") else {
        return (StatusCode::BAD_REQUEST, "missing url").into_response();
    };
    let Ok(parsed) = url::Url::parse(target) else {
        return (StatusCode::UNPROCESSABLE_ENTITY, "invalid url").into_response();
    };
    // Upstream hotlink guard keys on the origin, so mirror it back as the referer.
    let referer = format!("{}://{}", parsed.scheme(), parsed.host_str().unwrap_or(""));
    let ua = ctx
        .user_agent
        .read()
        .map(|s| s.clone())
        .unwrap_or_else(|_| crate::types::FALLBACK_USER_AGENT.to_string());
    let res = match ctx
        .http
        .get(target)
        .header("Referer", referer)
        .header("User-Agent", ua)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => return (StatusCode::BAD_GATEWAY, "upstream failed").into_response(),
    };
    let status = StatusCode::from_u16(res.status().as_u16()).unwrap_or(StatusCode::OK);
    let headers = res.headers().clone();
    let mime = headers
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/jpeg")
        .to_string();
    let bytes = res.bytes().await.unwrap_or_default();
    let mut builder = Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, mime);
    for key in ["cache-control", "etag", "expires", "last-modified"] {
        if let Some(v) = headers.get(key).and_then(|h| h.to_str().ok()) {
            builder = builder.header(key, v);
        }
    }
    builder
        .header("access-control-allow-origin", "*")
        .body(Body::from(bytes))
        .unwrap_or_else(|_| (StatusCode::INTERNAL_SERVER_ERROR, "body error").into_response())
}

#[derive(Deserialize)]
struct WeiboQuery {
    uid: String,
    page: Option<u32>,
    since_id: Option<String>,
    #[serde(alias = "sinceId")]
    since_id2: Option<String>,
}

async fn get_weibo(
    State(ctx): State<AppContext>,
    headers: HeaderMap,
    Query(q): Query<WeiboQuery>,
) -> Response<Body> {
    let page = q.page.unwrap_or(1);
    let since_id = q.since_id.or(q.since_id2);
    let target_url = weibo::build_mymblog_url(&q.uid, page, since_id.as_deref());
    // First-seed request carries the cookie in a header, later ones reuse the stored setting.
    let cookie = headers
        .get("x-wei-cookie")
        .and_then(|v| v.to_str().ok())
        .map(str::to_string)
        .or_else(|| read_setting(&ctx, "cookie"))
        .unwrap_or_default();
    let ua = ctx
        .user_agent
        .read()
        .map(|s| s.clone())
        .unwrap_or_else(|_| crate::types::FALLBACK_USER_AGENT.to_string());
    let referer = format!("https://weibo.com/u/{}", q.uid);
    let res = match ctx
        .http
        .get(&target_url)
        .header("accept", "application/json, text/plain, */*")
        .header("referer", referer)
        .header("x-requested-with", "XMLHttpRequest")
        .header("user-agent", ua)
        .header("cookie", cookie)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => return (StatusCode::BAD_GATEWAY, e.to_string()).into_response(),
    };
    let status = StatusCode::from_u16(res.status().as_u16()).unwrap_or(StatusCode::OK);
    let body = res.bytes().await.unwrap_or_default();
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(body))
        .unwrap_or_else(|_| (StatusCode::INTERNAL_SERVER_ERROR, "body error").into_response())
}

#[derive(Deserialize)]
struct LogQuery {
    lines: Option<usize>,
}

#[derive(Serialize)]
struct AppLogResponse {
    lines: Vec<String>,
}

fn last_n_lines(text: &str, n: usize) -> Vec<String> {
    text.lines()
        .rev()
        .take(n)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .map(str::to_string)
        .collect()
}

async fn get_daemon_log(Query(q): Query<LogQuery>) -> Json<AppLogResponse> {
    let n = q.lines.unwrap_or(500).clamp(1, 1000);
    // Missing log reads as empty, the tail below then yields no lines.
    let text = fs::read_to_string(db::standalone_home().join("app.log"))
        .await
        .unwrap_or_default();
    Json(AppLogResponse {
        lines: last_n_lines(&text, n),
    })
}

#[derive(Deserialize)]
struct CrashLogQuery {
    lines: Option<usize>,
}

#[derive(Serialize)]
struct CrashLogResponse {
    lines: Vec<String>,
    path: String,
}

async fn get_crash_log(Query(q): Query<CrashLogQuery>) -> Json<CrashLogResponse> {
    let n = q.lines.unwrap_or(500).clamp(1, 2000);
    // Missing log reads as empty, the tail below then yields no lines.
    let text = fs::read_to_string(crate::crash::crash_log_path())
        .await
        .unwrap_or_default();
    Json(CrashLogResponse {
        lines: last_n_lines(&text, n),
        path: crate::crash::crash_log_path().to_string_lossy().to_string(),
    })
}

pub fn build_router(ctx: AppContext) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);
    Router::new()
        .route("/api/settings", get(get_settings).put(put_settings))
        .route(
            "/api/history",
            get(get_history).post(post_history).delete(delete_history),
        )
        .route("/api/history/:uid", delete(delete_history_item))
        .route("/api/places", get(get_places).post(post_place))
        .route("/api/places/search", get(search_places))
        .route(
            "/api/places/by-post",
            get(get_blog_place)
                .put(put_blog_place)
                .delete(delete_blog_place),
        )
        .route("/api/download", post(post_download))
        .route("/api/download/cancel", post(post_cancel))
        .route("/api/download-dir/default", get(get_download_dir_default))
        .route("/api/download/events", get(get_events))
        .route("/api/user-agent", post(post_user_agent))
        .route("/api/img-proxy", get(get_img_proxy))
        .route("/api/weibo/mymblog", get(get_weibo))
        .route("/api/app-log", get(get_daemon_log))
        .route("/api/crash-log", get(get_crash_log))
        .fallback(serve_embed)
        .layer(cors)
        .with_state(ctx)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tail_keeps_last_n_lines() {
        let text = "a\nb\nc\nd";
        assert_eq!(
            last_n_lines(text, 2),
            vec!["c".to_string(), "d".to_string()]
        );
        assert_eq!(last_n_lines(text, 10).len(), 4);
        assert!(last_n_lines("", 5).is_empty());
    }
}
