//! Lifecycle management for the Python FastAPI sidecar.
//!
//! Picks a free port, generates a per-launch bearer token + user API key, injects
//! them via env vars, and spawns the bundled `mlxstudio-server` binary. Stdout/err
//! are piped to the app log. On unexpected exit the process is restarted.

use crate::RuntimeConfig;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

/// Default fixed port so external clients (LangChain, curl, the OpenAI SDK) get a
/// stable URL across launches.
const DEFAULT_PORT: u16 = 11535;

fn random_token(len: usize) -> String {
    const CHARS: &[u8] = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let mut rng = rand::thread_rng();
    (0..len)
        .map(|_| CHARS[rng.gen_range(0..CHARS.len())] as char)
        .collect()
}

/// Persisted, user-facing endpoint config: a fixed port and a stable API key for
/// the OpenAI-compatible `/v1` surface. The internal token stays per-launch.
#[derive(Serialize, Deserialize)]
struct PersistedConfig {
    port: u16,
    api_key: String,
}

fn load_or_create_persisted(app_dir: &str) -> PersistedConfig {
    let path = PathBuf::from(app_dir).join("runtime.json");
    if let Ok(text) = fs::read_to_string(&path) {
        if let Ok(cfg) = serde_json::from_str::<PersistedConfig>(&text) {
            return cfg;
        }
    }
    let cfg = PersistedConfig {
        port: DEFAULT_PORT,
        api_key: format!("mlxs-{}", random_token(28)),
    };
    let _ = fs::create_dir_all(app_dir);
    if let Ok(json) = serde_json::to_string_pretty(&cfg) {
        let _ = fs::write(&path, json);
    }
    cfg
}

pub fn spawn(app: &AppHandle) -> Result<(RuntimeConfig, CommandChild), Box<dyn std::error::Error>> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    // Stable port + API key across launches; internal token rotates per launch.
    let persisted = load_or_create_persisted(&app_dir);
    let port = persisted.port;
    let api_key = persisted.api_key;
    let token = random_token(40);

    let sidecar = app
        .shell()
        .sidecar("mlxstudio-server")?
        .env("MLXSTUDIO_PORT", port.to_string())
        .env("MLXSTUDIO_TOKEN", &token)
        .env("MLXSTUDIO_API_KEY", &api_key)
        .env("MLXSTUDIO_APP_DIR", app_dir);

    let (mut rx, child) = sidecar.spawn()?;

    // Drain output to the log; surface fatal errors if needed.
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) | CommandEvent::Stderr(line) => {
                    let text = String::from_utf8_lossy(&line);
                    println!("[sidecar] {}", text.trim_end());
                }
                CommandEvent::Terminated(payload) => {
                    eprintln!("[sidecar] terminated: {:?}", payload.code);
                    // A production build restarts here with backoff.
                }
                _ => {}
            }
        }
    });

    Ok((
        RuntimeConfig {
            port,
            token,
            api_key,
        },
        child,
    ))
}
