pub fn get_no_watermark_url(url: &str) -> Option<String> {
    let size_segment = url.split('/').nth(3)?;
    if size_segment.is_empty() {
        return None;
    }
    let mut target = String::with_capacity(size_segment.len() + 1);
    target.push_str(size_segment);
    target.push('/');
    let replaced = url.replace(&target, "oslarge/");
    if replaced == url {
        return None;
    }
    Some(replaced)
}
