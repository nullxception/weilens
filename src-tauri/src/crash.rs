use std::backtrace::Backtrace;
use std::fs;
use std::path::PathBuf;
use std::sync::Once;

use chrono::Utc;

use crate::db;

static INIT: Once = Once::new();

pub fn crash_log_path() -> PathBuf {
    db::standalone_home().join("crash.log")
}

fn append_crash_block(header: &str, body: &str) {
    let path = crash_log_path();
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
    }
    let ts = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let block = format!("\n[{ts}] {header}\n{body}\n---\n");
    if let Ok(mut f) = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
    {
        use std::io::Write as _;
        let _ = f.write_all(block.as_bytes());
    }
    eprintln!("{block}");
}

fn capture_backtrace() -> String {
    Backtrace::force_capture().to_string()
}

pub fn init() {
    INIT.call_once(|| {
        install_panic_hook();
        #[cfg(unix)]
        install_signal_handlers();
        #[cfg(windows)]
        install_windows_handler();
    });
}

fn install_panic_hook() {
    let prev = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let loc = info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "<unknown>".to_string());
        let payload = if let Some(s) = info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "<non-string panic payload>".to_string()
        };
        let bt = capture_backtrace();
        let body = format!("location: {loc}\npayload: {payload}\nbacktrace:\n{bt}");
        append_crash_block("PANIC", &body);
        prev(info);
    }));
}

#[cfg(unix)]
fn install_signal_handlers() {
    use signal_hook::consts::signal::*;
    for sig in [SIGSEGV, SIGBUS, SIGILL, SIGABRT, SIGFPE] {
        let _ = unsafe { signal_hook::low_level::register(sig, move || handle_signal(sig)) };
    }
}

#[cfg(unix)]
fn handle_signal(sig: i32) {
    let name = match sig {
        signal_hook::consts::signal::SIGSEGV => "SIGSEGV",
        signal_hook::consts::signal::SIGBUS => "SIGBUS",
        signal_hook::consts::signal::SIGILL => "SIGILL",
        signal_hook::consts::signal::SIGABRT => "SIGABRT",
        signal_hook::consts::signal::SIGFPE => "SIGFPE",
        _ => "UNKNOWN",
    };
    let bt = capture_backtrace();
    let body = format!("signal: {name} ({sig})\nbacktrace:\n{bt}");
    append_crash_block(&format!("FATAL {name}"), &body);
    std::thread::sleep(std::time::Duration::from_millis(200));
    unsafe { libc::abort() };
}

#[cfg(windows)]
fn install_windows_handler() {
    use std::sync::OnceLock;
    use windows_sys::Win32::System::Diagnostics::Debug as Dbg;

    static PREV: OnceLock<Option<unsafe extern "system" fn(*const Dbg::EXCEPTION_POINTERS) -> i32>> =
        OnceLock::new();

    unsafe extern "system" fn filter(info: *const Dbg::EXCEPTION_POINTERS) -> i32 {
        const EXCEPTION_CONTINUE_SEARCH: i32 = 0;
        let code: u32 = if info.is_null() || (*info).ExceptionRecord.is_null() {
            0
        } else {
            (*(*info).ExceptionRecord).ExceptionCode as u32
        };
        let name = match code {
            0xC0000005 => "STATUS_ACCESS_VIOLATION (segfault)",
            0xC00000FD => "STATUS_STACK_OVERFLOW",
            0xC0000094 => "STATUS_INTEGER_DIVIDE_BY_ZERO",
            0xC0000096 => "STATUS_PRIVILEGED_INSTRUCTION",
            0xC000001D => "STATUS_ILLEGAL_INSTRUCTION",
            _ => "STATUS_UNKNOWN",
        };
        let bt = capture_backtrace();
        let body = format!("exception: {name} 0x{code:08X}\nbacktrace:\n{bt}");
        append_crash_block("FATAL SEH", &body);
        if let Some(Some(prev)) = PREV.get() {
            unsafe { return prev(info); }
        }
        EXCEPTION_CONTINUE_SEARCH
    }

    unsafe {
        let prev = Dbg::SetUnhandledExceptionFilter(Some(filter));
        let _ = PREV.set(prev);
    }
}
