#![allow(clippy::absolute_paths)]
use std::fs;
use std::path::PathBuf;
use std::process;
use std::time::Duration;

use sysinfo::{Pid, System};
use tokio::fs as tokio_fs;
use tokio::io::AsyncReadExt;
use tokio::net::TcpStream;
use tokio::time;

use crate::db::standalone_home;

// Set on the detached child so it serves instead of daemonizing again.
pub const SERVER_CHILD_ENV: &str = "WEI_SERVER_CHILD";

fn pid_file() -> PathBuf {
    standalone_home().join("weilens.pid")
}

fn log_file() -> PathBuf {
    standalone_home().join("app.log")
}

async fn probe_port(port: u16) -> bool {
    let addr = format!("127.0.0.1:{port}");
    let fut = TcpStream::connect(&addr);
    matches!(
        time::timeout(Duration::from_millis(1500), fut).await,
        Ok(Ok(_))
    )
}

async fn wait_for_port(port: u16, timeout_ms: u64) -> bool {
    let deadline = time::Instant::now() + Duration::from_millis(timeout_ms);
    while time::Instant::now() < deadline {
        if probe_port(port).await {
            return true;
        }
        time::sleep(Duration::from_millis(300)).await;
    }
    false
}

// Cross-platform liveness check via `sysinfo`.
fn is_alive(pid: u32) -> bool {
    let mut sys = System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
    sys.process(Pid::from_u32(pid)).is_some()
}

async fn kill_pid(pid: u32) -> bool {
    let mut sys = System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
    sys.process(Pid::from_u32(pid)).is_some_and(|p| p.kill())
}

async fn write_pid_file(pid: u32) {
    let p = pid_file();
    if let Some(dir) = p.parent() {
        let _ = tokio_fs::create_dir_all(dir).await;
    }
    let _ = tokio_fs::write(&p, pid.to_string()).await;
}

async fn read_log_tail(lines: usize) -> String {
    let Ok(mut f) = tokio_fs::File::open(log_file()).await else {
        return "(no log)".to_string();
    };
    let mut buf = String::new();
    let _ = f.read_to_string(&mut buf).await;
    buf.lines()
        .rev()
        .take(lines)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

// Drop a pidfile whose process is already gone, so start/stop never chase it.
async fn clear_stale_pid_file() {
    let p = pid_file();
    if !p.exists() {
        return;
    }
    let stale = match tokio_fs::read_to_string(&p).await {
        Ok(s) => s.trim().parse::<u32>().ok(),
        Err(_) => None,
    };
    match stale {
        Some(pid) if is_alive(pid) => {}
        _ => {
            let _ = tokio_fs::remove_file(&p).await;
        }
    }
}

pub async fn daemon_start(port: u16) {
    if probe_port(port).await {
        println!("weilens already running on :{port}.");
        return;
    }
    clear_stale_pid_file().await;
    let log = log_file();
    if let Some(dir) = log.parent() {
        let _ = tokio_fs::create_dir_all(dir).await;
    }
    let _ = tokio_fs::write(&log, "").await;
    let exe = std::env::current_exe().unwrap_or_else(|_| PathBuf::from("weilens"));
    let log_str = log.to_string_lossy().to_string();

    /*
     * Detached spawn sharing one path for Windows and unix: the child
     * re-enters `server start` with the marker set and serves, while we
     * return once its port answers.
     */
    let log_file_out = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log)
        .or_else(|_| fs::File::create(&log))
        .unwrap_or_else(|e| {
            eprintln!("failed to open server log {log_str}: {e}");
            process::exit(1);
        });
    let log_file_err = log_file_out.try_clone().unwrap_or_else(|e| {
        eprintln!("failed to clone server log handle: {e}");
        process::exit(1);
    });
    let mut cmd = process::Command::new(&exe);
    cmd.args(["server", "start", "--port", &port.to_string()]);
    cmd.env(SERVER_CHILD_ENV, "1");
    cmd.stdin(process::Stdio::null());
    cmd.stdout(log_file_out);
    cmd.stderr(log_file_err);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const DETACHED_PROCESS: u32 = 0x0000_0008;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
        cmd.creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP);
    }
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }
    match cmd.spawn() {
        Ok(child) => {
            let pid = child.id();
            println!("spawning weilens server (PID {pid})...");
            if !wait_for_port(port, 15_000).await {
                let tail = read_log_tail(10).await;
                eprintln!(
                    "weilens server did not start listening on :{port} within 15s. Last log lines:\n{tail}"
                );
                process::exit(1);
            }
            write_pid_file(pid).await;
            println!("weilens server started on http://localhost:{port} (PID {pid})");
        }
        Err(e) => {
            eprintln!("failed to spawn weilens server: {e}");
            process::exit(1);
        }
    }
}

// Best-effort port kill when the pidfile is missing or stale. Only touches
// processes that look like our own server, never foreign port occupants.
async fn kill_by_port(port: u16) {
    let mut sys = System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
    let target = port.to_string();
    for proc in sys.processes().values() {
        let cmdline = proc
            .cmd()
            .iter()
            .map(|s| s.to_string_lossy().into_owned())
            .collect::<Vec<_>>();
        let port_hit = cmdline
            .windows(2)
            .any(|w| (w[0] == "--port" || w[0] == "-p") && w[1] == target)
            || cmdline.iter().any(|a| a == &format!("--port={target}"));
        if !port_hit {
            continue;
        }
        let exe = proc.name().to_string_lossy().to_lowercase();
        let ours = exe.contains("weilens") || cmdline.iter().any(|a| a == "server");
        if ours {
            proc.kill();
        }
    }
}

pub async fn daemon_stop(port: u16) {
    if !probe_port(port).await {
        println!("nothing running on :{port}.");
        let _ = tokio_fs::remove_file(pid_file()).await;
        return;
    }

    // Pidfile first, PID-accurate and free of port-scan ambiguity.
    let pid_path = pid_file();
    let mut pid_attempted = false;
    let mut pid_ok = false;
    if let Ok(s) = tokio_fs::read_to_string(&pid_path).await {
        if let Ok(pid) = s.trim().parse::<u32>() {
            if pid != 0 {
                pid_attempted = true;
                pid_ok = kill_pid(pid).await;
            }
        }
    }

    if pid_attempted {
        for _ in 0..5 {
            if !probe_port(port).await {
                break;
            }
            time::sleep(Duration::from_millis(200)).await;
        }
        if !probe_port(port).await {
            let _ = tokio_fs::remove_file(&pid_path).await;
            println!("weilens server stopped (:{port}).");
            return;
        }
        if !pid_ok {
            eprintln!("pidfile kill failed, falling back to port scan...");
        }
    }

    kill_by_port(port).await;
    for _ in 0..20 {
        if !probe_port(port).await {
            break;
        }
        time::sleep(Duration::from_millis(200)).await;
    }
    if probe_port(port).await {
        println!("failed to free :{port}.");
        return;
    }
    println!("weilens server stopped (:{port}).");
}

pub async fn daemon_restart(port: u16) {
    daemon_stop(port).await;
    daemon_start(port).await;
}

pub async fn daemon_status(port: u16) {
    let live = probe_port(port).await;
    let pid = tokio_fs::read_to_string(pid_file())
        .await
        .ok()
        .and_then(|s| s.trim().parse::<u32>().ok());
    match (live, pid) {
        (true, Some(pid)) if is_alive(pid) => {
            println!("weilens server running on :{port} (PID {pid}).");
        }
        (true, _) => println!("weilens server running on :{port} (PID unknown)."),
        (false, Some(pid)) if is_alive(pid) => {
            println!("weilens server not listening on :{port}, but PID {pid} is alive.");
        }
        (false, _) => println!("weilens server not running on :{port}."),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dead_pid_reports_not_alive() {
        assert!(!is_alive(u32::MAX));
    }
}
