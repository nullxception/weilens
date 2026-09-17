use chrono::{DateTime, Utc};

/// Parse a Weibo post timestamp, trying the known wire formats in turn.
///
/// # Errors
///
/// Returns `None` when no known format matches.
pub fn parse_date(date_str: &str) -> Option<DateTime<Utc>> {
    if let Ok(dt) = DateTime::parse_from_str(date_str, "%a %b %d %H:%M:%S %z %Y") {
        return Some(dt.into());
    }
    if let Ok(dt) = DateTime::parse_from_rfc3339(date_str) {
        return Some(dt.into());
    }
    if let Ok(dt) = DateTime::parse_from_rfc2822(date_str) {
        return Some(dt.into());
    }
    None
}

/// Shift a timestamp by a per-item offset; out-of-range offsets clamp to no shift.
pub fn get_formatted_date(dt: &DateTime<Utc>, index_offset: i64) -> String {
    let offset = chrono::Duration::try_seconds(index_offset).unwrap_or_default();
    (*dt + offset).format("%Y%m%d_%H%M%S").to_string()
}

/// Render the EXIF capture timestamp; out-of-range offsets clamp to no shift.
pub fn get_exif_date_string(dt: &DateTime<Utc>, index_offset: i64) -> String {
    let offset = chrono::Duration::try_seconds(index_offset).unwrap_or_default();
    (*dt + offset).format("%Y:%m:%d %H:%M:%S").to_string()
}

/// Render the day folder name for a timestamp.
pub fn get_date_folder(dt: &DateTime<Utc>) -> String {
    dt.format("%Y-%m-%d").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn fixture() -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2025, 9, 16, 4, 34, 56).unwrap()
    }

    #[test]
    fn parses_weibo_format() {
        let dt = parse_date("Tue Sep 16 12:34:56 +0800 2025").expect("weibo format");
        assert_eq!(dt, fixture());
    }

    #[test]
    fn parses_rfc3339() {
        let dt = parse_date("2025-09-16T04:34:56Z").expect("rfc3339");
        assert_eq!(dt, fixture());
    }

    #[test]
    fn parses_rfc2822() {
        let dt = parse_date("Tue, 16 Sep 2025 04:34:56 +0000").expect("rfc2822");
        assert_eq!(dt, fixture());
    }

    #[test]
    fn rejects_garbage() {
        assert_eq!(parse_date("not a date"), None);
        assert_eq!(parse_date(""), None);
    }

    #[test]
    fn formatted_date_applies_offset() {
        assert_eq!(get_formatted_date(&fixture(), 0), "20250916_043456");
        assert_eq!(get_formatted_date(&fixture(), 3600), "20250916_053456");
    }

    #[test]
    fn overflowing_offset_falls_back_to_no_shift() {
        assert_eq!(
            get_formatted_date(&fixture(), i64::MAX),
            get_formatted_date(&fixture(), 0)
        );
        assert_eq!(
            get_exif_date_string(&fixture(), i64::MAX),
            get_exif_date_string(&fixture(), 0)
        );
    }

    #[test]
    fn exif_and_folder_shapes() {
        assert_eq!(get_exif_date_string(&fixture(), 0), "2025:09:16 04:34:56");
        assert_eq!(get_date_folder(&fixture()), "2025-09-16");
    }
}
