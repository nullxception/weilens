use url::Url;

#[allow(dead_code)]
pub fn build_mymblog_url(uid: &str, page: u32, since_id: Option<&str>) -> String {
    let mut url =
        Url::parse("https://weibo.com/ajax/statuses/mymblog").expect("mymblog base url is valid");
    url.query_pairs_mut()
        .append_pair("uid", uid)
        .append_pair("page", &page.to_string())
        .append_pair("feature", "0");
    if let Some(sid) = since_id.filter(|sid| !sid.is_empty()) {
        url.query_pairs_mut().append_pair("since_id", sid);
    }
    url.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn build_url_without_since_id() {
        assert_eq!(
            build_mymblog_url("123", 1, None),
            "https://weibo.com/ajax/statuses/mymblog?uid=123&page=1&feature=0"
        );
    }
    #[test]
    fn build_url_with_since_id() {
        assert_eq!(
            build_mymblog_url("123", 2, Some("abc")),
            "https://weibo.com/ajax/statuses/mymblog?uid=123&page=2&feature=0&since_id=abc"
        );
    }
    #[test]
    fn empty_since_id_is_dropped() {
        assert_eq!(
            build_mymblog_url("123", 1, Some("")),
            "https://weibo.com/ajax/statuses/mymblog?uid=123&page=1&feature=0"
        );
    }
}
