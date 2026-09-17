use url::Url;

pub fn get_no_watermark_url(url: &str) -> Option<String> {
    let mut parsed = Url::parse(url).ok()?;
    /*
     * Only the size segment (first path segment) selects the rendition;
     * later segments are object keys and keep their literal text.
     */
    let mut segments: Vec<String> = parsed
        .path_segments()
        .map(|segments| segments.map(str::to_string).collect())
        .unwrap_or_default();
    let first = segments.first()?;
    if first.is_empty() || *first == "oslarge" {
        return None;
    }
    segments[0] = "oslarge".to_string();
    parsed
        .path_segments_mut()
        .ok()?
        .clear()
        .extend(segments.iter().map(String::as_str));
    Some(parsed.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rewrites_size_segment_to_oslarge() {
        let out =
            get_no_watermark_url("https://wx1.sinaimg.cn/mw690/abc.jpg").expect("mw690 rewrites");
        assert!(out.contains("/oslarge/"), "{out}");
        assert!(out.ends_with("/abc.jpg"), "{out}");
    }

    #[test]
    fn already_oslarge_returns_none() {
        assert_eq!(
            get_no_watermark_url("https://wx1.sinaimg.cn/oslarge/abc.jpg"),
            None
        );
    }
    #[test]
    fn keeps_object_key_literal() {
        let out = get_no_watermark_url("https://wx1.sinaimg.cn/mw690/004abcXYZ.jpg")
            .expect("plain key rewrites");
        assert_eq!(out, "https://wx1.sinaimg.cn/oslarge/004abcXYZ.jpg");
    }
    #[test]
    fn rejects_garbage() {
        assert_eq!(get_no_watermark_url("not a url"), None);
        assert_eq!(get_no_watermark_url(""), None);
    }
}
