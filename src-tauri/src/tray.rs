//! Menu-bar item: free memory for models and the running models, kept current
//! while the window is closed. The app mostly runs in the background serving the
//! API, so this is where a user checks what is loaded and frees memory.

use crate::{AppState, RuntimeConfig};
use serde::Deserialize;
use std::time::Duration;
use tauri::menu::{Menu, MenuBuilder, MenuItem, MenuItemBuilder, SubmenuBuilder};
use tauri::tray::{TrayIcon, TrayIconBuilder};
use tauri::{AppHandle, Emitter, Manager, Wry};

const TRAY_ID: &str = "main";
const REFRESH: Duration = Duration::from_secs(3);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(2);
/// Event the frontend listens for to open Chat with a model selected.
pub const OPEN_CHAT_EVENT: &str = "tray:open-chat";

const ITEM_OPEN: &str = "open";
const ITEM_QUIT: &str = "quit";
const CHAT_PREFIX: &str = "chat:";
const STOP_PREFIX: &str = "stop:";

/// What the tray shows, as read from the sidecar.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Snapshot {
    /// None while the engine is not answering.
    pub free_for_models_bytes: Option<u64>,
    pub running: Vec<RunningModel>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RunningModel {
    pub id: String,
    pub name: String,
}

#[derive(Deserialize)]
struct StatsWire {
    ram_available: u64,
    #[serde(default)]
    reserve_bytes: u64,
}

#[derive(Deserialize)]
struct ModelWire {
    id: String,
    display_name: String,
    status: String,
}

/// Memory a new model can take: what macOS can hand out minus the safety
/// reserve (same rule as the sidecar's fit check and the UI's memory ledger).
pub fn free_for_models(ram_available: u64, reserve_bytes: u64) -> u64 {
    ram_available.saturating_sub(reserve_bytes)
}

/// "12 GB free for models", one decimal below 10 GB, as in the app.
pub fn free_label(bytes: Option<u64>) -> String {
    match bytes {
        None => "Starting the local engine…".to_string(),
        Some(b) => {
            let gb = b as f64 / 1024f64.powi(3);
            if gb < 10.0 {
                format!("{gb:.1} GB free for models")
            } else {
                format!("{} GB free for models", gb.round() as u64)
            }
        }
    }
}

fn get<T: for<'de> Deserialize<'de>>(config: &RuntimeConfig, path: &str) -> Result<T, String> {
    ureq::get(&format!("http://127.0.0.1:{}{path}", config.port))
        .set("Authorization", &format!("Bearer {}", config.token))
        .timeout(REQUEST_TIMEOUT)
        .call()
        .map_err(|e| e.to_string())?
        .into_json::<T>()
        .map_err(|e| e.to_string())
}

fn fetch_snapshot(config: &RuntimeConfig) -> Snapshot {
    let stats = match get::<StatsWire>(config, "/system/stats") {
        Ok(stats) => stats,
        Err(_) => return Snapshot::default(),
    };
    let running = get::<Vec<ModelWire>>(config, "/models")
        .unwrap_or_default()
        .into_iter()
        .filter(|m| m.status == "running")
        .map(|m| RunningModel { id: m.id, name: m.display_name })
        .collect();
    Snapshot {
        free_for_models_bytes: Some(free_for_models(stats.ram_available, stats.reserve_bytes)),
        running,
    }
}

/// The menu plus its free-memory line, which is updated in place.
struct TrayMenu {
    menu: Menu<Wry>,
    title: MenuItem<Wry>,
}

fn build_menu(app: &AppHandle, snapshot: &Snapshot) -> tauri::Result<TrayMenu> {
    let title = MenuItemBuilder::with_id("free", free_label(snapshot.free_for_models_bytes))
        .enabled(false)
        .build(app)?;
    let mut menu = MenuBuilder::new(app).item(&title);
    if !snapshot.running.is_empty() {
        menu = menu.separator();
        for model in &snapshot.running {
            let submenu = SubmenuBuilder::new(app, &model.name)
                .text(format!("{CHAT_PREFIX}{}", model.id), "Open chat")
                .text(format!("{STOP_PREFIX}{}", model.id), "Stop")
                .build()?;
            menu = menu.item(&submenu);
        }
    }
    let menu = menu
        .separator()
        .text(ITEM_OPEN, "Open MLX Studio")
        .text(ITEM_QUIT, "Quit MLX Studio")
        .build()?;
    Ok(TrayMenu { menu, title })
}

/// Bring the main window back (it hides instead of closing).
pub fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn stop_model(app: &AppHandle, model_id: String) {
    let config = app.state::<AppState>().config.lock().unwrap().clone();
    std::thread::spawn(move || {
        let result = ureq::post(&format!("http://127.0.0.1:{}/models/{model_id}/stop", config.port))
            .set("Authorization", &format!("Bearer {}", config.token))
            .timeout(Duration::from_secs(30))
            .call();
        if let Err(e) = result {
            eprintln!("[tray] could not stop {model_id}: {e}");
        }
    });
}

fn on_menu_event(app: &AppHandle, id: &str) {
    if id == ITEM_OPEN {
        show_main_window(app);
    } else if id == ITEM_QUIT {
        app.exit(0);
    } else if let Some(model_id) = id.strip_prefix(CHAT_PREFIX) {
        show_main_window(app);
        let _ = app.emit(OPEN_CHAT_EVENT, model_id.to_string());
    } else if let Some(model_id) = id.strip_prefix(STOP_PREFIX) {
        stop_model(app, model_id.to_string());
    }
}

/// Create the tray and start refreshing it from the sidecar.
pub fn install(app: &AppHandle) -> tauri::Result<()> {
    let initial = Snapshot::default();
    let TrayMenu { menu, title } = build_menu(app, &initial)?;
    let tray = TrayIconBuilder::with_id(TRAY_ID)
        .icon(tauri::include_image!("icons/tray-template.png"))
        .icon_as_template(true)
        .tooltip("MLX Studio")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| on_menu_event(app, event.id().as_ref()))
        .build(app)?;

    let handle = app.clone();
    std::thread::spawn(move || refresh_loop(handle, tray, initial, title));
    Ok(())
}

/// Keeps the tray current without pulling the menu out from under the pointer:
/// the free-memory line changes in place (it moves every few seconds), and the
/// menu is rebuilt only when the set of running models changes.
fn refresh_loop(app: AppHandle, tray: TrayIcon, mut shown: Snapshot, mut title: MenuItem<Wry>) {
    let mut label = free_label(shown.free_for_models_bytes);
    loop {
        std::thread::sleep(REFRESH);
        let config = app.state::<AppState>().config.lock().unwrap().clone();
        let snapshot = fetch_snapshot(&config);
        let next_label = free_label(snapshot.free_for_models_bytes);

        // State only advances once the menu shows it, so a failed update is retried.
        if snapshot.running != shown.running {
            let rebuilt = build_menu(&app, &snapshot)
                .and_then(|rebuilt| tray.set_menu(Some(rebuilt.menu)).map(|()| rebuilt.title));
            match rebuilt {
                Ok(new_title) => {
                    title = new_title;
                    let names: Vec<&str> = snapshot.running.iter().map(|m| m.name.as_str()).collect();
                    println!("[tray] {next_label}; running: {}", names.join(", "));
                    label = next_label;
                    shown = snapshot;
                }
                Err(e) => eprintln!("[tray] could not rebuild the menu: {e}"),
            }
        } else if next_label != label {
            match title.set_text(&next_label) {
                Ok(()) => {
                    println!("[tray] {next_label}");
                    label = next_label;
                }
                Err(e) => eprintln!("[tray] could not update the menu: {e}"),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const GB: u64 = 1024 * 1024 * 1024;

    #[test]
    fn free_for_models_subtracts_the_reserve() {
        assert_eq!(free_for_models(20 * GB, 7 * GB), 13 * GB);
        assert_eq!(free_for_models(4 * GB, 7 * GB), 0);
    }

    #[test]
    fn free_label_matches_the_app() {
        assert_eq!(free_label(Some(12 * GB)), "12 GB free for models");
        assert_eq!(free_label(Some(GB * 43 / 10)), "4.3 GB free for models");
        assert_eq!(free_label(None), "Starting the local engine…");
    }
}
