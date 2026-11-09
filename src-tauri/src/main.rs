// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    std::panic::set_hook(Box::new(|info| {
        let msg = format!(
            "PANIC: {}\nBacktrace:\n{:?}\n",
            info,
            std::backtrace::Backtrace::force_capture()
        );
        let _ = std::fs::write("D:\\MYAPP\\AuraPDF\\panic.log", &msg);
        let _ = std::fs::write("panic.log", &msg);
        if let Ok(temp) = std::env::var("TEMP") {
            let _ = std::fs::write(format!("{}\\aurapdf_panic.log", temp), &msg);
        }
    }));
    app_lib::run();
}
