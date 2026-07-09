use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Place {
    pub lat: f64,
    pub lon: f64,
    pub name: String,
}

pub struct DbState(pub Mutex<Connection>);

pub fn init_db(app: &AppHandle) -> Result<Connection, rusqlite::Error> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to get app data dir");
    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let db_path = app_data_dir.join("weipoint.db");
    let conn = Connection::open(db_path)?;

    conn.execute("PRAGMA foreign_keys = ON;", [])?;
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

    Ok(conn)
}

fn cleanup_orphans(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute(
        "DELETE FROM places
         WHERE id NOT IN (SELECT place_id FROM blog_places)",
        [],
    )?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
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
    let mut places = Vec::new();
    for item in saved_iter {
        places.push(item.map_err(|e| e.to_string())?);
    }

    Ok(Places { places, total })
}

#[tauri::command]
pub fn search_place(state: tauri::State<'_, DbState>, r#for: &str) -> Result<Vec<Place>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let pattern = format!("%{}%", r#for);
    let mut stmt = conn
        .prepare("SELECT  lat, lon, name FROM places WHERE name LIKE ?1")
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

    let mut result = Vec::new();
    for place in place_iter {
        result.push(place.map_err(|e| e.to_string())?);
    }

    Ok(result)
}

#[tauri::command]
pub fn get_place_by_post(
    state: tauri::State<'_, DbState>,
    user_id: String,
    mblogid: String,
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
        .query_row([user_id, mblogid], |row| {
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
    user_id: String,
    mblogid: String,
    place: Place,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR IGNORE INTO places (lat, lon, name) VALUES (?1, ?2, ?3)",
        params![place.lat, place.lon, place.name],
    )
    .map_err(|e| e.to_string())?;
    let place_id: i64 = conn
        .query_row(
            "SELECT id FROM places WHERE lat = ?1 AND lon = ?2 AND name = ?3",
            params![place.lat, place.lon, place.name],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO blog_places (user_id, mblogid, place_id) VALUES (?1, ?2, ?3)",
        params![user_id, mblogid, place_id],
    )
    .map_err(|e| e.to_string())?;
    cleanup_orphans(&conn).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn remove_blog_place(
    state: tauri::State<'_, DbState>,
    user_id: String,
    mblogid: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM blog_places WHERE user_id = ?1 AND mblogid = ?2",
        params![user_id, mblogid],
    )
    .map_err(|e| e.to_string())?;
    cleanup_orphans(&conn).map_err(|e| e.to_string())?;
    Ok(())
}
