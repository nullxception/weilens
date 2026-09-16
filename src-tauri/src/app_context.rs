#[allow(dead_code)]
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, RwLock};

use tokio::sync::broadcast;
use tokio_util::sync::CancellationToken;

use crate::types::{DownloadConfig, DownloadProgressPayload};

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct AppContext {
    pub http: reqwest::Client,
    pub user_agent: Arc<RwLock<String>>,
    pub config: DownloadConfig,
    pub cancel: Arc<Mutex<HashMap<String, CancellationToken>>>,
    pub progress_tx: broadcast::Sender<DownloadProgressPayload>,
    pub db_path: PathBuf,
}
