use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Place {
    pub lat: f64,
    pub lon: f64,
    pub name: String,
}

pub struct DbState(pub Mutex<Connection>);

#[allow(dead_code)]
pub fn standalone_db_path() -> PathBuf {
    if let Some(base) = dirs::data_dir() {
        base.join("io.chaldeaprjkt.WeiLens").join("weipoint.db")
    } else {
        PathBuf::from("./data/weipoint.db")
    }
}

// Home dir for standalone server artifacts (pidfile, logs), next to the DB.
pub fn standalone_home() -> PathBuf {
    standalone_db_path()
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("./data"))
}

fn init_common(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA busy_timeout=5000;
         PRAGMA foreign_keys = ON;",
    )?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS places (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            name TEXT NOT NULL,
            UNIQUE(lat, lon, name)
        )",
        [],
    )?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS blog_places (
            user_id TEXT NOT NULL,
            mblogid TEXT NOT NULL,
            place_id INTEGER NOT NULL,
            PRIMARY KEY (user_id, mblogid),
            FOREIGN KEY(place_id) REFERENCES places(id) ON DELETE CASCADE
        )",
        [],
    )?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS profile_history (
            uid TEXT PRIMARY KEY,
            screen_name TEXT NOT NULL DEFAULT '',
            avatar TEXT NOT NULL DEFAULT '',
            timestamp INTEGER NOT NULL DEFAULT 0
        )",
        [],
    )?;
    Ok(())
}

fn open_and_init(path: &Path) -> Result<Connection, rusqlite::Error> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    }
    let conn = Connection::open(path)?;
    init_common(&conn)?;
    Ok(conn)
}

pub fn init_db(app: &AppHandle) -> Result<Connection, rusqlite::Error> {
    let app_data_dir = app.path().app_data_dir().expect("app data dir available");
    let db_path = app_data_dir.join("weipoint.db");
    open_and_init(&db_path)
}

#[allow(dead_code)]
pub fn init_standalone_db() -> Result<Connection, rusqlite::Error> {
    let path = standalone_db_path();
    open_and_init(&path)
}

#[allow(dead_code)]
pub fn init_db_at_path(path: &Path) -> Result<Connection, rusqlite::Error> {
    open_and_init(path)
}

#[allow(dead_code)]
pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>, rusqlite::Error> {
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |row| row.get(0),
    )
    .optional()
}

#[allow(dead_code)]
pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        params![key, value],
    )?;
    Ok(())
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[allow(dead_code)]
#[serde(rename_all = "camelCase")]
pub struct ProfileHistoryRow {
    pub uid: String,
    #[serde(rename = "screenName")]
    pub screen_name: String,
    #[serde(rename = "profileImageUrl", alias = "avatar")]
    pub avatar: String,
    pub timestamp: i64,
}

#[allow(dead_code)]
pub fn list_profile_history(conn: &Connection) -> Result<Vec<ProfileHistoryRow>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT uid, screen_name, avatar, timestamp FROM profile_history ORDER BY timestamp DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(ProfileHistoryRow {
            uid: row.get(0)?,
            screen_name: row.get(1)?,
            avatar: row.get(2)?,
            timestamp: row.get(3)?,
        })
    })?;
    rows.collect()
}

#[allow(dead_code)]
pub fn upsert_profile_history(
    conn: &Connection,
    row: &ProfileHistoryRow,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO profile_history (uid, screen_name, avatar, timestamp) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(uid) DO UPDATE SET screen_name=excluded.screen_name, avatar=excluded.avatar, timestamp=excluded.timestamp",
        params![row.uid, row.screen_name, row.avatar, row.timestamp],
    )?;
    Ok(())
}

#[allow(dead_code)]
pub fn delete_profile_history(conn: &Connection, uid: &str) -> Result<(), rusqlite::Error> {
    conn.execute("DELETE FROM profile_history WHERE uid = ?1", params![uid])?;
    Ok(())
}

#[allow(dead_code)]
pub fn clear_profile_history(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute("DELETE FROM profile_history", [])?;
    Ok(())
}

// Multi-write blog place core shared by Tauri commands and the server path.
pub fn set_blog_place_txn(
    tx: &Transaction<'_>,
    uid: &str,
    blog_id: &str,
    place: &Place,
) -> Result<(), rusqlite::Error> {
    let place_id: i64 = tx.query_row(
        "INSERT INTO places (lat, lon, name) VALUES (?1, ?2, ?3)
         ON CONFLICT(lat, lon, name) DO UPDATE SET lat = lat
         RETURNING id",
        params![place.lat, place.lon, place.name],
        |row| row.get(0),
    )?;
    tx.execute(
        "INSERT OR REPLACE INTO blog_places (user_id, mblogid, place_id) VALUES (?1, ?2, ?3)",
        params![uid, blog_id, place_id],
    )?;
    tx.execute(
        "DELETE FROM places
         WHERE id NOT IN (SELECT place_id FROM blog_places)",
        [],
    )?;
    Ok(())
}

pub fn remove_blog_place_txn(
    tx: &Transaction<'_>,
    uid: &str,
    blog_id: &str,
) -> Result<(), rusqlite::Error> {
    tx.execute(
        "DELETE FROM blog_places WHERE user_id = ?1 AND mblogid = ?2",
        params![uid, blog_id],
    )?;
    tx.execute(
        "DELETE FROM places
         WHERE id NOT IN (SELECT place_id FROM blog_places)",
        [],
    )?;
    Ok(())
}
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Places {
    pub places: Vec<Place>,
    pub total: usize,
}

#[tauri::command]
pub fn list_places(
    state: tauri::State<'_, DbState>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<Places, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let total: usize = conn
        .query_row("SELECT COUNT(*) FROM places", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    let limit = limit.unwrap_or(total);
    let offset = offset.unwrap_or(0);

    let mut stmt = conn
        .prepare("SELECT lat, lon, name FROM places LIMIT ? OFFSET ?")
        .map_err(|e| e.to_string())?;
    let saved_iter = stmt
        .query_map(params![limit as i64, offset as i64], |row| {
            Ok(Place {
                lat: row.get(0)?,
                lon: row.get(1)?,
                name: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let places: Vec<Place> = saved_iter
        .map(|item| item.map_err(|e| e.to_string()))
        .collect::<Result<_, _>>()?;

    Ok(Places { places, total })
}

#[tauri::command]
pub fn search_place(state: tauri::State<'_, DbState>, query: &str) -> Result<Vec<Place>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let pattern = format!("%{query}%");
    let mut stmt = conn
        .prepare("SELECT lat, lon, name FROM places WHERE name LIKE ?1")
        .map_err(|e| e.to_string())?;

    let place_iter = stmt
        .query_map(params![pattern], |row| {
            Ok(Place {
                lat: row.get(0)?,
                lon: row.get(1)?,
                name: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let result: Vec<Place> = place_iter
        .map(|place| place.map_err(|e| e.to_string()))
        .collect::<Result<_, _>>()?;

    Ok(result)
}

#[tauri::command]
pub fn get_place_by_post(
    state: tauri::State<'_, DbState>,
    uid: String,
    blog_id: String,
) -> Result<Place, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT p.lat, p.lon, p.name 
             FROM blog_places bp
             JOIN places p ON bp.place_id = p.id where bp.user_id = ?1 and bp.mblogid = ?2 LIMIT 1",
        )
        .map_err(|e| e.to_string())?;

    let place = stmt
        .query_row([uid, blog_id], |row| {
            Ok(Place {
                lat: row.get(0)?,
                lon: row.get(1)?,
                name: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;
    Ok(place)
}

#[tauri::command]
pub fn add_place(state: tauri::State<'_, DbState>, place: Place) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR IGNORE INTO places (lat, lon, name) VALUES (?1, ?2, ?3)",
        params![place.lat, place.lon, place.name],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn set_blog_place(
    state: tauri::State<'_, DbState>,
    uid: String,
    blog_id: String,
    place: Place,
) -> Result<(), String> {
    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    set_blog_place_txn(&tx, &uid, &blog_id, &place).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_blog_place(
    state: tauri::State<'_, DbState>,
    uid: String,
    blog_id: String,
) -> Result<(), String> {
    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    remove_blog_place_txn(&tx, &uid, &blog_id).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}

#[allow(dead_code)]
#[tauri::command]
pub fn get_settings(
    state: tauri::State<'_, DbState>,
    key: String,
) -> Result<Option<String>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    get_setting(&conn, &key).map_err(|e| e.to_string())
}

#[allow(dead_code)]
#[tauri::command]
pub fn save_settings(
    state: tauri::State<'_, DbState>,
    key: String,
    value: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    set_setting(&conn, &key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_profile_history_cmd(
    state: tauri::State<'_, DbState>,
) -> Result<Vec<ProfileHistoryRow>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    list_profile_history(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn upsert_profile_history_cmd(
    state: tauri::State<'_, DbState>,
    row: ProfileHistoryRow,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    upsert_profile_history(&conn, &row).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_profile_history_cmd(
    state: tauri::State<'_, DbState>,
    uid: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    delete_profile_history(&conn, &uid).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_profile_history_cmd(state: tauri::State<'_, DbState>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    clear_profile_history(&conn).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn settings_kv_roundtrip() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);")
            .unwrap();
        set_setting(&conn, "cookie", "a=b").unwrap();
        assert_eq!(
            get_setting(&conn, "cookie").unwrap(),
            Some("a=b".to_string())
        );
        set_setting(&conn, "cookie", "c=d").unwrap();
        assert_eq!(
            get_setting(&conn, "cookie").unwrap(),
            Some("c=d".to_string())
        );
        assert_eq!(get_setting(&conn, "missing").unwrap(), None);
    }

    #[test]
    fn init_db_creates_all_tables() {
        let dir = std::env::temp_dir().join(format!("weilens_test_{}", rand::random::<u32>()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("weipoint.db");
        let conn = init_db_at_path(&path).unwrap();
        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap();
        let tables: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert!(tables.contains(&"places".to_string()));
        assert!(tables.contains(&"blog_places".to_string()));
        assert!(tables.contains(&"settings".to_string()));
        assert!(tables.contains(&"profile_history".to_string()));
        drop(stmt);
        drop(conn);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn profile_history_crud() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE profile_history (uid TEXT PRIMARY KEY, screen_name TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '', timestamp INTEGER NOT NULL DEFAULT 0);",
        )
        .unwrap();
        let row = ProfileHistoryRow {
            uid: "123".to_string(),
            screen_name: "alice".to_string(),
            avatar: "https://example.com/a.jpg".to_string(),
            timestamp: 999,
        };
        upsert_profile_history(&conn, &row).unwrap();
        let listed = list_profile_history(&conn).unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].uid, "123");
        delete_profile_history(&conn, "123").unwrap();
        assert_eq!(list_profile_history(&conn).unwrap().len(), 0);
        upsert_profile_history(&conn, &row).unwrap();
        clear_profile_history(&conn).unwrap();
        assert_eq!(list_profile_history(&conn).unwrap().len(), 0);
    }
}
