mod sidecar;

use serde::Serialize;
use std::sync::Mutex;
use tauri::{Manager, RunEvent};
use tauri_plugin_shell::process::CommandChild;

#[derive(Default, Serialize, Clone)]
pub struct RuntimeConfig {
    pub port: u16,
    pub token: String,
    #[serde(rename = "apiKey")]
    pub api_key: String,
}

pub struct AppState {
    pub config: Mutex<RuntimeConfig>,
    pub sidecar: Mutex<Option<CommandChild>>,
}

/// Exposes the sidecar port + tokens to the frontend.
#[tauri::command]
fn get_runtime_config(state: tauri::State<AppState>) -> RuntimeConfig {
    state.config.lock().unwrap().clone()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            config: Mutex::new(RuntimeConfig::default()),
            sidecar: Mutex::new(None),
        })
        .setup(|app| {
            // Spawn the Python sidecar, keep its handle so we can kill it on exit,
            // and store the runtime config for the frontend.
            let (cfg, child) = sidecar::spawn(app.handle())?;
            *app.state::<AppState>().config.lock().unwrap() = cfg;
            *app.state::<AppState>().sidecar.lock().unwrap() = Some(child);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_runtime_config])
        .build(tauri::generate_context!())
        .expect("error while building MLX Studio")
        .run(|app_handle, event| {
            // Make sure the sidecar dies with the app so it never orphans and
            // holds the fixed port hostage on the next launch.
            if let RunEvent::Exit = event {
                if let Some(child) = app_handle.state::<AppState>().sidecar.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        });
}
