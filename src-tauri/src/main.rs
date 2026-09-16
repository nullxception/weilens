#![allow(clippy::absolute_paths)]
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process;

use weilens_lib::daemon;

const DEFAULT_PORT: u16 = 1421;

#[derive(Clone, Copy)]
enum DaemonOp {
    Start,
    Stop,
    Restart,
    Status,
}

enum Action {
    App,
    Daemon(DaemonOp, u16),
    Help,
}

// Last `--port`/`-p` flag wins; `--port=N` form also accepted.
fn scan_port_flag(raw: &[String]) -> Option<u16> {
    let mut found = None;
    let mut i = 0;
    while i < raw.len() {
        match raw[i].as_str() {
            "--port" | "-p" => {
                if let Some(p) = raw.get(i + 1).and_then(|v| v.parse::<u16>().ok()) {
                    found = Some(p);
                }
                i += 1;
            }
            arg if arg.starts_with("--port=") => {
                if let Ok(p) = arg["--port=".len()..].parse::<u16>() {
                    found = Some(p);
                }
            }
            _ => {}
        }
        i += 1;
    }
    found
}

// Explicit flag wins over env, env wins over the default.
fn resolve_port(raw: &[String]) -> u16 {
    if let Some(p) = scan_port_flag(raw) {
        return p;
    }
    if let Ok(env_port) = std::env::var("WEI_PORT").or_else(|_| std::env::var("WEI_SERVER_PORT")) {
        if let Ok(p) = env_port.trim().parse::<u16>() {
            return p;
        }
    }
    DEFAULT_PORT
}

fn parse_args() -> Action {
    let raw: Vec<String> = std::env::args().skip(1).collect();
    if raw.iter().any(|a| a == "-h" || a == "--help") {
        return Action::Help;
    }
    if !raw.first().is_some_and(|a| a == "server") {
        return Action::App;
    }
    let port = resolve_port(&raw);
    match raw.get(1).map(String::as_str) {
        Some("start") => Action::Daemon(DaemonOp::Start, port),
        Some("stop") => Action::Daemon(DaemonOp::Stop, port),
        Some("restart") => Action::Daemon(DaemonOp::Restart, port),
        Some("status") => Action::Daemon(DaemonOp::Status, port),
        other => {
            eprintln!(
                "unknown server subcommand: {}",
                other.unwrap_or("(missing)")
            );
            print_usage();
            process::exit(1);
        }
    }
}

fn print_usage() {
    println!(
        "Weilens - Sina Weibo viewer and downloader

Usage:
  weilens                          Run the desktop app
  weilens server start [--port N]  Start the server in the background
  weilens server stop [--port N]   Stop the background server
  weilens server restart [--port N]  Restart the background server
  weilens server status [--port N]  Show server status

Options:
  --port, -p N   Server port (default {DEFAULT_PORT}, WEI_PORT env when the flag is omitted)"
    );
}

fn run_daemon_op(op: DaemonOp, port: u16) {
    // Detached child re-enters `server start` with the marker set and serves.
    if matches!(op, DaemonOp::Start) && std::env::var(daemon::SERVER_CHILD_ENV).is_ok() {
        weilens_lib::serve(port);
        return;
    }
    let rt = match tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
    {
        Ok(rt) => rt,
        Err(e) => {
            eprintln!("failed to start async runtime: {e}");
            process::exit(1);
        }
    };
    rt.block_on(async move {
        match op {
            DaemonOp::Start => daemon::daemon_start(port).await,
            DaemonOp::Stop => daemon::daemon_stop(port).await,
            DaemonOp::Restart => daemon::daemon_restart(port).await,
            DaemonOp::Status => daemon::daemon_status(port).await,
        }
    });
}

fn main() {
    match parse_args() {
        Action::App => weilens_lib::run(),
        Action::Daemon(op, port) => run_daemon_op(op, port),
        Action::Help => print_usage(),
    }
}
