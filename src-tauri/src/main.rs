#![allow(clippy::absolute_paths)]
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let mut args = std::env::args().skip(1);
    let mut serve = false;
    let mut port: u16 = 1421;
    while let Some(a) = args.next() {
        match a.as_str() {
            "--serve" => serve = true,
            "--port" => port = args.next().and_then(|p| p.parse().ok()).unwrap_or(1421),
            _ => {}
        }
    }
    // Env wins only if --port not given; WEI_PORT mirrors plan
    if !serve {
        // allow WEI_PORT to also trigger serve? No — flag is required.
    } else if port == 1421 {
        if let Ok(env_port) = std::env::var("WEI_PORT").or_else(|_| std::env::var("WEI_SERVER_PORT")) {
            if let Ok(p) = env_port.parse::<u16>() { port = p; }
        }
        // --port flag already handled above; env only applies when flag kept default
    }
    if serve {
        weilens_lib::serve(port);
    } else {
        weilens_lib::run();
    }
}
