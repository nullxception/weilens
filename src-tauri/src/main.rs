#![allow(clippy::absolute_paths)]
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process;

const DEFAULT_PORT: u16 = 1421;

enum Action {
    App,
    Server(u16),
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
    if raw.len() > 1 && !raw[1].starts_with('-') {
        eprintln!("unknown server argument: {}", raw[1]);
        print_usage();
        process::exit(1);
    }
    Action::Server(resolve_port(&raw))
}

fn print_usage() {
    println!(
        "Weilens - Sina Weibo viewer and downloader

  weilens                 Run the desktop app
  weilens server [--port N]  Run the server in the foreground

Options:
  --port, -p N   Server port (default {DEFAULT_PORT}, WEI_PORT env when the flag is omitted)"
    );
}

fn main() {
    match parse_args() {
        Action::App => weilens_lib::run(),
        Action::Server(port) => weilens_lib::serve(port),
        Action::Help => print_usage(),
    }
}
