pub mod export;
pub mod launch;
pub mod ocr;
pub mod pdf;
pub mod single_instance;
pub mod win_assoc;

use tauri::{Manager, WindowEvent};
use tauri_plugin_log::{Target, TargetKind};

/// Keeps one copy of the database from before the current launch.
///
/// Migrations run on every start and are the only operation that can lose user data
/// (annotations, reading state, library rows). A copy taken before the frontend connects
/// turns a bad migration from "everything is gone" into "delete one file to roll back".
fn backup_database(app: &tauri::AppHandle) {
    let Ok(config_dir) = app.path().app_config_dir() else {
        return;
    };
    let database = config_dir.join("aurapdf.db");
    if !database.exists() {
        return;
    }
    let backup = config_dir.join("aurapdf.db.bak");

    // One backup per launch: skip if the existing copy is already from this session.
    if let (Ok(database_meta), Ok(backup_meta)) =
        (std::fs::metadata(&database), std::fs::metadata(&backup))
    {
        if let (Ok(database_time), Ok(backup_time)) =
            (database_meta.modified(), backup_meta.modified())
        {
            if database_time <= backup_time {
                return;
            }
        }
    }

    match std::fs::copy(&database, &backup) {
        Ok(_) => log::info!("[DB] Backup written to {}", backup.display()),
        Err(error) => log::warn!("[DB] Could not write backup: {error}"),
    }

    // WAL contents are only durable together with the main file; copy it alongside when
    // present so the backup is a consistent snapshot rather than an older one.
    let wal = config_dir.join("aurapdf.db-wal");
    if wal.exists() {
        let _ = std::fs::copy(&wal, config_dir.join("aurapdf.db.bak-wal"));
    }
}

#[tauri::command]
fn get_db_url() -> Option<String> {
    std::env::var("AURAPDF_DB_URL")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args().collect();
    let cwd = std::env::current_dir().ok();

    // 1. Single-instance check: if an existing AuraPDF instance is running, forward CLI args & exit immediately
    if single_instance::try_forward_to_running_instance(&args, cwd.as_deref()) {
        std::process::exit(0);
    }

    // 2. Parse initial CLI arguments (e.g. `AuraPDF.exe "C:\path\to\file.pdf"`) and enqueue for React startup
    let initial_items = launch::extract_launch_items_from_args(&args, cwd.as_deref());
    launch::enqueue_launch_items(initial_items);

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        // Registered but never invoked from the UI yet: enabling updates needs a signing
        // keypair, which is generated per project and must not live in the repository.
        // See docs/RELEASING.md section 6.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            pdf::pdf_open,
            pdf::pdf_close,
            pdf::pdf_get_page_meta,
            pdf::pdf_render_page,
            pdf::pdf_get_outline,
            pdf::pdf_get_text_layer,
            ocr::pdf_ocr_page_direct,
            export::pdf_export_annotated,
            ocr::pdf_ocr_region,
            ocr::ocr_diagnostics,
            pdf::pdf_search_document,
            launch::pdf_take_launch_queue,
            launch::pdf_inspect_path,
            win_assoc::pdf_register_file_association,
            win_assoc::pdf_open_default_apps_settings,
            get_db_url,
        ])
        .on_window_event(|window, event| {
            if window.label() == "main" && matches!(event, WindowEvent::Destroyed) {
                single_instance::cleanup_endpoint_file();
            }
        })
        .setup(|app| {
            // Logging is initialised before anything else. It used to be registered at the
            // end of setup, which meant every message emitted during startup — including the
            // file-association warning and the startup banner — was written to no target at
            // all. Writes to %LOCALAPPDATA%/com.aurapdf.desktop/logs on Windows.
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .targets([
                        Target::new(TargetKind::LogDir {
                            file_name: Some("aurapdf".into()),
                        }),
                        Target::new(TargetKind::Stdout),
                    ])
                    .level(if cfg!(debug_assertions) {
                        log::LevelFilter::Debug
                    } else {
                        log::LevelFilter::Info
                    })
                    .max_file_size(2_000_000)
                    .build(),
            )?;

            log::info!(
                "[STARTUP] AuraPDF {} on {}",
                env!("CARGO_PKG_VERSION"),
                std::env::consts::OS
            );

            // Start single-instance IPC listener so subsequent PDF launches reuse this window
            single_instance::start_primary_instance_listener(app.handle().clone());

            let isolated_profile = get_db_url().is_some();

            // Ensure non-intrusive per-user Windows Open With & Default Apps registration
            if !isolated_profile {
                if let Err(err) = win_assoc::ensure_current_exe_registered() {
                    log::warn!("[WIN_ASSOC] Could not register file association: {}", err);
                }
            }

            if let Some(window) = app.get_webview_window("main") {
                if let Some(icon) = app.default_window_icon() {
                    let _ = window.set_icon(icon.clone());
                }
                let _ = window.set_fullscreen(true);
            }
            if !isolated_profile {
                backup_database(app.handle());
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
