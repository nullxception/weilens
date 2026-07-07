use chrono::{DateTime, Utc};

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

pub fn get_formatted_date(dt: &DateTime<Utc>, index_offset: i64) -> String {
    let offset_dt = *dt + chrono::Duration::seconds(index_offset);
    offset_dt.format("%Y%m%d_%H%M%S").to_string()
}

pub fn get_exif_date_string(dt: &DateTime<Utc>, index_offset: i64) -> String {
    let offset_dt = *dt + chrono::Duration::seconds(index_offset);
    offset_dt.format("%Y:%m:%d %H:%M:%S").to_string()
}

pub fn get_date_folder(dt: &DateTime<Utc>) -> String {
    dt.format("%Y-%m-%d").to_string()
}
