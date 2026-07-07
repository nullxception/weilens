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
