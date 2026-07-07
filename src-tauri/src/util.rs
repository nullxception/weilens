pub fn get_no_watermark_url(url: &str) -> Option<String> {
    let parts: Vec<&str> = url.split('/').collect();
    if parts.len() > 3 {
        let size_segment = parts[3];
        let target = format!("{}/", size_segment);
        Some(url.replace(&target, "oslarge/"))
    } else {
        None
    }
}
