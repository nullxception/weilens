use std::collections::HashMap;
use std::env;
use std::path::PathBuf;
use std::str::FromStr;
use std::sync::Mutex;
use thiserror::Error;
use tokio_util::sync::CancellationToken;

pub const DEFAULT_REFERER: &str = "https://weibo.com/";
pub const DEFAULT_DOWNLOAD_ROOT_NAME: &str = "WeiLens";
pub const FALLBACK_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

#[derive(Debug, Clone)]
pub struct DownloadConfig {
    pub max_concurrency: usize,
    pub max_retries: u32,
    pub retry_base_delay_ms: u64,
    pub retry_max_delay_ms: u64,
    pub request_timeout_secs: u64,
    pub referer: String,
    pub download_root_name: String,
}

impl Default for DownloadConfig {
    fn default() -> Self {
        Self {
            max_concurrency: env_value("WEI_MAX_CONCURRENCY", 16),
            max_retries: env_value("WEI_MAX_RETRIES", 6),
            retry_base_delay_ms: env_value("WEI_RETRY_BASE_DELAY_MS", 150),
            retry_max_delay_ms: env_value("WEI_RETRY_MAX_DELAY_MS", 153600),
            request_timeout_secs: env_value("WEI_REQUEST_TIMEOUT_SECS", 30),
            referer: env::var("WEI_REFERER").unwrap_or_else(|_| DEFAULT_REFERER.to_string()),
            download_root_name: env::var("WEI_DOWNLOAD_ROOT_NAME")
                .unwrap_or_else(|_| DEFAULT_DOWNLOAD_ROOT_NAME.to_string()),
        }
    }
}

impl DownloadConfig {
    pub fn effective_max_concurrency(&self) -> usize {
        self.max_concurrency.max(1)
    }

    pub fn effective_download_root(&self, download_dir: Option<String>) -> PathBuf {
        match download_dir {
            Some(dir) if !dir.trim().is_empty() => PathBuf::from(dir),
            _ => dirs::download_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join(&self.download_root_name),
        }
    }
}

fn env_value<T>(name: &str, default: T) -> T
where
    T: FromStr,
{
    env::var(name)
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(default)
}

#[derive(Debug, Error)]
pub enum DownloadError {
    #[error("request failed: {0}")]
    Request(String),
    #[error("HTTP error: {0}")]
    Http(String),
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("failed to create directory: {0}")]
    CreateDir(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn effective_max_concurrency_never_below_one() {
        let config = DownloadConfig {
            max_concurrency: 0,
            max_retries: 1,
            retry_base_delay_ms: 50,
            retry_max_delay_ms: 200,
            request_timeout_secs: 10,
            referer: DEFAULT_REFERER.to_string(),
            download_root_name: DEFAULT_DOWNLOAD_ROOT_NAME.to_string(),
        };

        assert_eq!(config.effective_max_concurrency(), 1);
    }
}

#[derive(serde::Deserialize)]
pub struct DownloadItem {
    pub url: String,
    #[serde(rename = "videoUrl")]
    pub video_url: Option<String>,
}

#[derive(serde::Deserialize, Clone)]
pub struct GpsData {
    pub lat: f64,
    pub lon: f64,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgressPayload {
    pub post_id: String,
    pub index: usize,
    pub total: usize,
    pub status: String,
    pub url: String,
    pub saved_path: Option<String>,
}

pub struct DownloadCancellationState(pub Mutex<HashMap<String, CancellationToken>>);

pub struct AppState {
    pub user_agent: std::sync::Arc<std::sync::RwLock<String>>,
}
