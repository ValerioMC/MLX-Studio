# MLX Studio — Software Architecture & Product Design

> Local AI for Apple Silicon, made simple. A native-feeling macOS app to discover, download, run, and chat with MLX models — with an OpenAI-compatible local API.

**Stack:** Tauri (Rust shell) · React + TypeScript · TailwindCSS + shadcn/ui · Python FastAPI sidecar · `mlx-lm` · SQLite

---

## 0. Design philosophy

MLX Studio should feel like an Apple app, not a wrapped web page. Every decision below follows a few principles:

- **Clarity over chrome.** One primary action per view. Generous whitespace, a single accent color, system typography (SF Pro via `-apple-system`). No gradients-for-the-sake-of-gradients.
- **Deference.** The content (models, chat, metrics) is the UI. Controls recede until needed. Translucency/vibrancy only where macOS uses it (sidebar, title bar).
- **Direct manipulation & immediate feedback.** Every long-running action (download, model load, generation) streams progress. Nothing blocks the UI thread.
- **Honest system state.** RAM headroom and model fit are shown *before* the user commits, so the app never lets someone load a 70B model into 16 GB and watch it swap to death.
- **Native conventions.** Traffic-light window controls, `⌘,` for settings, `⌘N` new chat, `⌘F` search catalog, full keyboard navigation, respects system Appearance (light/dark) and Reduce Motion.
- **Forgiving.** Pause/resume downloads, confirm destructive deletes, never lose a conversation.

Reference points for the visual language: Linear's density and motion discipline, Apple's System Settings information architecture, and Raycast's command ergonomics.

---

## 1. Software architecture

### 1.1 High-level topology

MLX Studio is a three-process desktop application coordinated by Tauri.

```
┌──────────────────────────────────────────────────────────────────────┐
│  macOS App Bundle (MLX Studio.app)                                     │
│                                                                        │
│  ┌────────────────────────┐         ┌──────────────────────────────┐  │
│  │  WebView (WKWebView)    │  IPC    │  Tauri Core (Rust)           │  │
│  │  React + TS frontend    │◄───────►│  - Window / menu / tray      │  │
│  │  Tailwind + shadcn/ui   │ invoke/ │  - Sidecar lifecycle mgmt    │  │
│  │                         │ events  │  - Filesystem & secure store │  │
│  └───────────┬─────────────┘         │  - Native notifications      │  │
│              │ HTTP/SSE                │  - Auto-update (updater)     │  │
│              │ (localhost)            └───────────────┬──────────────┘  │
│              ▼                                        │ spawn / monitor │
│  ┌────────────────────────────────────────────────────▼─────────────┐  │
│  │  Python FastAPI Sidecar  (127.0.0.1:<port>)                       │  │
│  │  - Catalog / search service        - OpenAI-compatible API       │  │
│  │  - Download manager (HF Hub)        - Inference engine (mlx-lm)   │  │
│  │  - Model registry & lifecycle       - System metrics (psutil)    │  │
│  │  - SQLite (SQLAlchemy)                                            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
        │                          │                         │
        ▼                          ▼                         ▼
  Hugging Face Hub          ~/.mlxstudio/models        Apple MLX / Metal
  (model discovery +        (weights, configs)         (unified memory GPU)
   downloads)
```

**Why this split:**

- The **Rust/Tauri core** owns everything that must be native and trusted: window management, the macOS menu bar, notifications, secure storage of the Hugging Face token (Keychain), filesystem permissions, and — critically — the **lifecycle of the Python sidecar**. Tauri ships a ~5–10 MB binary instead of bundling Chromium (Electron), which matters for a "feels native" app.
- The **Python FastAPI sidecar** exists because the AI stack (`mlx-lm`, `mlx`, `transformers`, `huggingface_hub`) is Python-native. Re-implementing model loading and tokenization in Rust would be a multi-year effort for no benefit. FastAPI also *is* the OpenAI-compatible server we need to expose anyway, so the same process serves both the app's internal API and external clients (e.g. a user's `curl`, Continue.dev, or an SDK pointed at `http://localhost:11535/v1`).
- The **React frontend** talks to the sidecar over plain `localhost` HTTP + SSE, and to the Rust core via Tauri's `invoke`/event IPC. It never touches the model files or the network to Hugging Face directly.

### 1.2 Process responsibilities

| Concern | Owner | Notes |
|---|---|---|
| Window, menus, tray, dock | Tauri (Rust) | Native menu items map to frontend commands via events |
| Sidecar spawn / health / restart | Tauri (Rust) | Spawns bundled Python as a [Tauri sidecar binary]; restarts on crash |
| Secure secrets (HF token) | Tauri (Rust) + macOS Keychain | Never stored in SQLite or plaintext |
| Auto-update | Tauri updater | Signed updates; sidecar shipped inside the bundle |
| Model catalog / search | FastAPI | Caches HF metadata in SQLite |
| Downloads (resume, speed, disk) | FastAPI download manager | Streams progress over SSE/WebSocket |
| Model load / unload / inference | FastAPI + `mlx-lm` | One model resident per "runner" by default |
| OpenAI-compatible API | FastAPI | `/v1/chat/completions`, `/v1/models`, etc. |
| System metrics | FastAPI (`psutil` + Metal) | RAM, VRAM-equivalent (unified), CPU |
| Persistence | SQLite via SQLAlchemy | Single file in app support dir |
| UI state / chat rendering | React | TanStack Query for server state |

### 1.3 Why FastAPI is bundled, and how it's secured

The sidecar binds to `127.0.0.1` only and is started with a **per-launch bearer token** generated by the Rust core and passed via env var. Every request from the frontend includes this token; external OpenAI clients use a separate, user-visible API key managed in Settings. This prevents a malicious local web page from driving the user's models. CORS is locked to the Tauri origin (`tauri://localhost`) plus an explicit user-configurable allowlist.

The Python runtime is packaged with **PyInstaller** (or `uv`-built standalone) into a single executable and registered as a Tauri `externalBin`, so users never install Python themselves.

### 1.4 Data flow examples

**Search → download → run → chat**, end to end:

1. User searches catalog → React → `GET /catalog/search` → FastAPI queries cached HF metadata (refreshes from Hub if stale) → returns models annotated with *download size*, *estimated RAM*, *fits-your-machine?* badge.
2. User clicks Download → `POST /downloads` → download manager starts an `huggingface_hub` snapshot download in a worker → emits progress events on SSE channel → React updates the Downloads view live.
3. User clicks Start → `POST /models/{id}/start` → engine loads weights into unified memory via `mlx_lm.load()` → status flips to *running*, exposed on the OpenAI API.
4. User chats → React opens SSE stream `POST /v1/chat/completions` (stream=true) → tokens render incrementally with Markdown + syntax highlighting.

---

## 2. Folder structure

A monorepo with three workspaces under one Tauri app.

```
mlx-studio/
├─ .gitignore
├─ README.md
├─ package.json                  # root scripts (concurrently runs vite + tauri)
├─ pnpm-workspace.yaml
│
├─ src-tauri/                     # Rust / Tauri core
│  ├─ Cargo.toml
│  ├─ tauri.conf.json            # windows, sidecar bin, updater, bundle id
│  ├─ build.rs
│  ├─ icons/
│  ├─ binaries/                  # bundled python sidecar (per-arch)
│  │  └─ mlxstudio-server-aarch64-apple-darwin
│  └─ src/
│     ├─ main.rs                 # app bootstrap
│     ├─ sidecar.rs              # spawn/monitor/health-check python
│     ├─ menu.rs                 # native menu bar + shortcuts
│     ├─ tray.rs                 # menu-bar extra (running models)
│     ├─ secrets.rs             # Keychain access (HF token, API key)
│     ├─ commands.rs             # #[tauri::command] handlers
│     └─ updater.rs
│
├─ src/                          # React + TypeScript frontend
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ routes/                    # one folder per top-level section
│  │  ├─ dashboard/
│  │  ├─ catalog/
│  │  ├─ downloads/
│  │  ├─ models/
│  │  ├─ chat/
│  │  └─ settings/
│  ├─ components/
│  │  ├─ ui/                     # shadcn/ui primitives (button, dialog…)
│  │  ├─ layout/                 # Sidebar, TitleBar, AppShell
│  │  ├─ models/                 # ModelCard, ModelStatusBadge, RamMeter
│  │  ├─ chat/                   # MessageList, Composer, Markdown
│  │  └─ system/                 # MemoryLedger, ConnectionBanner
│  ├─ lib/
│  │  ├─ api/                    # typed client for FastAPI (openapi-gen)
│  │  ├─ tauri/                  # invoke wrappers + event listeners
│  │  ├─ sse.ts                  # SSE/stream helper
│  │  ├─ format.ts               # bytes, tokens/s, durations
│  │  └─ query.ts                # TanStack Query setup
│  ├─ stores/                    # Zustand stores (ui, chat draft, settings)
│  ├─ hooks/                     # useMemoryLedger, useIsDark
│  ├─ types/                     # shared TS types (generated + hand)
│  └─ styles/
│     ├─ globals.css             # tailwind layers + CSS vars (themes)
│     └─ tokens.css              # design tokens (color, spacing, radius)
│
├─ sidecar/                      # Python FastAPI backend
│  ├─ pyproject.toml             # managed with uv
│  ├─ mlxstudio/
│  │  ├─ main.py                 # FastAPI app factory, lifespan
│  │  ├─ config.py               # settings (port, dirs, token)
│  │  ├─ db/
│  │  │  ├─ models.py            # SQLAlchemy ORM
│  │  │  ├─ session.py
│  │  │  └─ migrations/          # alembic
│  │  ├─ api/
│  │  │  ├─ catalog.py
│  │  │  ├─ downloads.py
│  │  │  ├─ models.py            # lifecycle (start/stop/delete)
│  │  │  ├─ system.py
│  │  │  ├─ chat.py              # conversations (internal)
│  │  │  └─ openai.py            # /v1/* OpenAI-compatible
│  │  ├─ services/
│  │  │  ├─ hf_catalog.py        # HF Hub search + metadata
│  │  │  ├─ download_manager.py  # resumable, throttled, progress
│  │  │  ├─ engine.py            # mlx-lm load/generate/unload
│  │  │  ├─ runner_registry.py   # in-memory map of loaded models
│  │  │  ├─ metrics.py           # psutil + metal memory
│  │  │  └─ estimator.py         # RAM/size estimation heuristics
│  │  ├─ schemas/                # Pydantic request/response models
│  │  └─ utils/
│  └─ tests/
│
├─ scripts/
│  ├─ build-sidecar.sh           # PyInstaller → src-tauri/binaries
│  └─ gen-api-types.sh           # openapi.json → TS types
│
└─ docs/
   └─ ARCHITECTURE.md            # this file
```

---

## 3. API design

Two API surfaces share one FastAPI app:

1. **Internal API** (`/catalog`, `/downloads`, `/models`, `/system`, `/conversations`) — consumed by the React frontend, authenticated with the per-launch bearer token.
2. **OpenAI-compatible API** (`/v1/*`) — for the user and third-party tools, authenticated with the user's API key.

Conventions: JSON, `snake_case` fields, RFC 7807-style error bodies, cursor pagination for lists, SSE for anything streaming. All times ISO-8601 UTC. Versioned under `/api/v1` internally (omitted below for brevity).

### 3.1 Error shape

```json
{
  "error": {
    "type": "model_not_loaded",
    "message": "Model 'qwen2.5-7b-instruct-4bit' is not running.",
    "detail": { "model_id": "…" }
  }
}
```

---

## 4. Database schema

SQLite, single file at `~/Library/Application Support/MLX Studio/mlxstudio.db`. Managed with SQLAlchemy + Alembic. WAL mode for concurrent reads while a download writes.

```sql
-- Installed / known models
CREATE TABLE models (
  id              TEXT PRIMARY KEY,          -- slug, e.g. "qwen2.5-7b-instruct-4bit"
  hf_repo_id      TEXT NOT NULL,             -- "mlx-community/Qwen2.5-7B-Instruct-4bit"
  display_name    TEXT NOT NULL,
  params_b        REAL,                      -- parameter count in billions
  quantization    TEXT,                      -- "4bit","8bit","bf16","fp16",NULL
  context_length  INTEGER,
  vision          INTEGER DEFAULT 0,         -- bool
  instruct        INTEGER DEFAULT 0,         -- instruction-tuned
  download_bytes  INTEGER,                   -- on-disk size
  est_ram_bytes   INTEGER,                   -- estimated load footprint
  license         TEXT,
  description     TEXT,
  local_path      TEXT,                      -- NULL until installed
  status          TEXT NOT NULL DEFAULT 'available',
                  -- available|downloading|installed|running|error
  installed_at    TIMESTAMP,
  last_used_at    TIMESTAMP,
  metadata_json   TEXT,                      -- raw HF config snapshot
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Catalog cache (search results from HF, refreshed periodically)
CREATE TABLE catalog_cache (
  hf_repo_id      TEXT PRIMARY KEY,
  payload_json    TEXT NOT NULL,             -- normalized model card
  downloads_30d   INTEGER,
  likes           INTEGER,
  fetched_at      TIMESTAMP NOT NULL
);

-- Download jobs
CREATE TABLE downloads (
  id              TEXT PRIMARY KEY,          -- uuid
  model_id        TEXT REFERENCES models(id) ON DELETE CASCADE,
  hf_repo_id      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'queued',
                  -- queued|downloading|paused|completed|failed|canceled
  total_bytes     INTEGER,
  downloaded_bytes INTEGER DEFAULT 0,
  speed_bps       INTEGER,                   -- last sampled
  error           TEXT,
  started_at      TIMESTAMP,
  completed_at    TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- File-level progress for resumability
CREATE TABLE download_files (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  download_id     TEXT REFERENCES downloads(id) ON DELETE CASCADE,
  rel_path        TEXT NOT NULL,
  total_bytes     INTEGER,
  downloaded_bytes INTEGER DEFAULT 0,
  etag            TEXT,
  completed       INTEGER DEFAULT 0
);

-- Chat conversations
CREATE TABLE conversations (
  id              TEXT PRIMARY KEY,          -- uuid
  title           TEXT,                      -- auto-generated from first msg
  model_id        TEXT REFERENCES models(id) ON DELETE SET NULL,
  system_prompt   TEXT,
  params_json     TEXT,                      -- temperature, top_p, max_tokens…
  pinned          INTEGER DEFAULT 0,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,             -- system|user|assistant|tool
  content         TEXT NOT NULL,
  tokens          INTEGER,
  tok_per_sec     REAL,                      -- for assistant messages
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Activity feed (dashboard "Recent activity")
CREATE TABLE activity_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  kind            TEXT NOT NULL,             -- download|start|stop|delete|chat|error
  model_id        TEXT,
  message         TEXT NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Key/value settings (mirrors Settings UI; secrets live in Keychain)
CREATE TABLE settings (
  key             TEXT PRIMARY KEY,
  value_json      TEXT NOT NULL,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_models_status        ON models(status);
CREATE INDEX idx_downloads_status     ON downloads(status);
CREATE INDEX idx_messages_conv        ON messages(conversation_id, created_at);
CREATE INDEX idx_activity_created     ON activity_log(created_at DESC);
```

---

## 5. React component hierarchy

```
<App>
└─ <QueryClientProvider>            # TanStack Query
   └─ <ThemeProvider>               # light/dark/system → CSS vars
      └─ <AppShell>
         ├─ <TitleBar/>             # custom draggable region, traffic-light inset
         ├─ <Sidebar>              # primary nav, vibrancy background
         │  ├─ <NavItem> Overview ⌘1, Chat ⌘2, Models ⌘3, Catalog ⌘4, Downloads ⌘5 (badge: active count)
         │  ├─ <RunningModels/>     # live status + context; click opens chat with it
         │  ├─ <LedgerBar compact/> # unified memory at a glance
         │  └─ <NavItem> Settings ⌘,
         └─ <Routes>
            ├─ <DashboardView>          # "Overview"
            │  ├─ <FreeForModels/> <LedgerBar/> <LedgerLegend/>  # memory by model, system, reserve, free
            │  ├─ running models (Chat / Use from code / Stop) or quick start
            │  └─ activity
            ├─ <CatalogView>
            │  ├─ <SearchBar/>          # ⌘F
            │  ├─ <FilterPanel>        # params, quant, ctx, vision, instruct
            │  └─ <ModelGrid>
            │     └─ <ModelCard>       # size, est RAM, fits-badge, download btn
            │        └─ <ModelDetailSheet/>
            ├─ <DownloadsView>
            │  └─ <DownloadList>
            │     └─ <DownloadRow>     # progress, speed, pause/resume/cancel
            ├─ <ModelsView>
            │  └─ <InstalledModelList>
            │     └─ <ModelRow>        # start/stop/delete/update/logs
            │        ├─ <ModelLogsDrawer/>
            │        └─ <ConfirmDeleteDialog/>
            ├─ <ChatView>
            │  ├─ <ConversationSidebar> # list, new (⌘N), rename, pin, delete
            │  └─ <ChatPane>
            │     ├─ <ChatHeader/>      # model picker, params popover
            │     ├─ <MessageList>
            │     │  └─ <MessageBubble>
            │     │     ├─ <MarkdownRenderer/>   # react-markdown + remark-gfm
            │     │     └─ <CodeBlock/>          # shiki/prism highlight + copy
            │     └─ <Composer/>        # textarea, send, stop-generation
            └─ <SettingsView>
               ├─ <SettingsSection> Models directory  (folder picker via Tauri)
               ├─ <SettingsSection> API (port, key, CORS allowlist)
               ├─ <SettingsSection> Appearance (theme, accent, reduce motion)
               └─ <SettingsSection> Performance (max RAM, default ctx, kv-cache)
```

**State strategy:** TanStack Query owns request/response server state (models, conversations, activity, catalog). What the sidecar pushes over SSE (system stats, download progress) lives in one Zustand store (`stores/live.ts`) fed by a single subscription per stream, opened by the shell and reconnecting with backoff. Zustand also holds the chat thread (so a generation survives navigation) and persisted preferences (theme, chat defaults). No Redux.

---

## 6. Tauri integration strategy

### 6.1 Sidecar lifecycle (the critical bit)

The Python server is registered as an `externalBin` and managed from Rust:

```rust
// src-tauri/src/sidecar.rs (sketch)
use tauri_plugin_shell::process::CommandChild;

pub fn spawn_sidecar(app: &AppHandle) -> Result<CommandChild> {
    let port = pick_free_port();                 // avoid collisions
    let token = generate_token();                // per-launch bearer
    app.state::<AppConfig>().set(port, &token);

    let (mut rx, child) = app.shell()
        .sidecar("mlxstudio-server")?
        .env("MLXSTUDIO_PORT", port.to_string())
        .env("MLXSTUDIO_TOKEN", &token)
        .env("MLXSTUDIO_DB", db_path())
        .env("MLXSTUDIO_MODELS_DIR", models_dir())
        .spawn()?;

    // Pipe stdout/stderr to a rotating log; surface fatal lines to UI.
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await { log_sidecar_event(event); }
    });
    Ok(child)
}
```

- **Health gating:** the frontend shows a "Starting engine…" splash and polls `GET /health` (with the token) until ready, then routes to Dashboard. Typical cold start <2 s.
- **Crash recovery:** Rust watches the child; on unexpected exit it restarts with exponential backoff and posts a `sidecar-restarted` event the UI can toast.
- **Clean shutdown:** on window-close / app-quit, Rust sends `POST /shutdown` (graceful: unload models, flush DB) then kills the child if it doesn't exit within a timeout. Prevents orphaned Python processes holding GBs of unified memory.

### 6.2 Tauri commands (Rust ↔ React)

Reserved for things only the native side can do; everything else goes over HTTP to the sidecar.

```rust
#[tauri::command] fn get_runtime_config() -> RuntimeConfig   // port + token
#[tauri::command] fn pick_models_directory() -> Option<String> // native folder dialog
#[tauri::command] fn set_hf_token(token: String) -> Result<()> // → Keychain
#[tauri::command] fn get_hf_token() -> Result<Option<String>>
#[tauri::command] fn reveal_in_finder(path: String)
#[tauri::command] fn open_external(url: String)
#[tauri::command] fn restart_sidecar() -> Result<()>
```

### 6.3 Native menus, tray, notifications, updates

- **Menu bar:** standard macOS menus; `File ▸ New Chat (⌘N)`, `Edit`, `Models ▸ Start/Stop`, `View ▸ Toggle Sidebar (⌘\\)`, `Window`, `Help`. Menu actions emit events the React app handles via a global listener.
- **Menu-bar extra (tray):** implemented in `src-tauri/src/tray.rs`. It shows free memory for models and each running model (with *Open chat* and *Stop*), plus *Open MLX Studio* and *Quit MLX Studio*. A background thread reads `/system/stats` and `/models` every 3 s with the per-launch token. It updates the free-memory line in place and rebuilds the menu only when the running models change, so an open menu is never swapped out under the pointer. *Open chat* emits `tray:open-chat` to the frontend. Closing the window hides it, so the API keeps serving with the window closed.
- **Notifications:** "Download complete", "Model ready", "Out of memory — load canceled".
- **Updater:** Tauri updater with signed artifacts; sidecar binary ships inside the bundle so app + engine version together.
- **Permissions:** Tauri v2 capabilities scoped tightly — FS access limited to the models dir and app-support dir, shell limited to the one sidecar, network limited to the HF domains + localhost.

### 6.4 Custom title bar & window

`titleBarStyle: "Overlay"` with `hiddenTitle`, a draggable region, traffic-light controls inset into the sidebar header — the standard "unified" macOS look. Vibrancy via `NSVisualEffectView` (`windowEffects: ["sidebar"]`).

---

## 7. FastAPI endpoints

### 7.1 Internal API

```
GET    /health                          → { status, version, uptime }
POST   /shutdown                         → graceful stop

# Catalog
GET    /catalog/search?q=&params_min=&params_max=&quant=&ctx_min=
                       &vision=&instruct=&sort=&cursor=
                                         → paginated, machine-fit annotated
GET    /catalog/{repo_id}                → full model card + file manifest
POST   /catalog/refresh                  → force re-pull from HF Hub

# Models (registry + lifecycle)
GET    /models                           → installed/known models
GET    /models/{id}                       → detail
POST   /models/{id}/start                 → load into memory  { ctx?, kv_cache? }
POST   /models/{id}/stop                  → unload
DELETE /models/{id}                       → delete weights from disk
POST   /models/{id}/update                → pull newer revision
GET    /models/{id}/logs?tail=200         → load/inference logs
GET    /models/{id}/logs/stream           → SSE live logs

# Downloads
POST   /downloads                         → { repo_id } start job
GET    /downloads                         → all jobs
GET    /downloads/{id}                     → one job
POST   /downloads/{id}/pause
POST   /downloads/{id}/resume
DELETE /downloads/{id}                      → cancel + cleanup partials
GET    /downloads/stream                   → SSE: progress/speed for all jobs

# System
GET    /system/stats                       → ram total/used/available,
                                             swap, cpu, per-model footprint,
                                             disk free in models dir
GET    /system/stats/stream                → SSE, ~1 Hz

# Conversations (internal chat persistence)
GET    /conversations
POST   /conversations
GET    /conversations/{id}
PATCH  /conversations/{id}                  → rename, pin, params
DELETE /conversations/{id}
GET    /conversations/{id}/messages
```

### 7.2 OpenAI-compatible API (`/v1`)

Drop-in for the OpenAI SDK and tools like Continue, Cursor, LangChain — point `base_url` at `http://localhost:11535/v1`.

```
GET    /v1/models                          → lists running models (OpenAI shape)
POST   /v1/chat/completions                 → chat (stream=true → SSE deltas)
POST   /v1/completions                      → legacy text completion
POST   /v1/embeddings                       → if an embedding model is loaded
```

`POST /v1/chat/completions` mirrors OpenAI exactly: `model`, `messages`, `temperature`, `top_p`, `max_tokens`, `stream`, `stop`. Streaming returns `data: {chat.completion.chunk}` SSE frames terminated by `data: [DONE]`. If the requested model is installed but not running, the server can lazy-load it (configurable) or return `model_not_loaded`.

---

## 8. Model download workflow

```
User clicks "Download" on a ModelCard
   │
   ▼
POST /downloads { repo_id }
   │  ├─ resolve file manifest from HF (safetensors, config, tokenizer)
   │  ├─ compute total_bytes; check disk free in models dir
   │  ├─ check est_ram vs system RAM → warn if it won't run
   │  └─ create downloads + download_files rows (status=queued)
   ▼
Download worker (async, bounded concurrency)
   │  ├─ huggingface_hub snapshot download with hf_transfer for speed
   │  ├─ per-file streaming to <models_dir>/<repo>/… with .part suffix
   │  ├─ HTTP Range requests → resumable; etag stored per file
   │  ├─ sample speed every ~500 ms → update speed_bps
   │  └─ emit progress on /downloads/stream (SSE)
   ▼
Pause  → cancel in-flight requests, keep .part files, status=paused
Resume → re-issue Range requests from downloaded_bytes
   ▼
On all files complete
   ├─ atomically rename .part → final, verify sizes/sha
   ├─ models row: local_path set, status=installed, sizes recorded
   ├─ activity_log: "Downloaded {name}"
   └─ native notification "Model ready"
```

**Robustness details:** bounded parallel file downloads (default 4) to avoid saturating the link; integrity check via HF-provided hashes; partial-file GC for canceled jobs; graceful handling of gated/private repos by prompting for the HF token (read from Keychain); automatic retry with backoff on transient network errors. Disk-full and "won't fit in RAM" are surfaced *before* committing, with the fit estimate from `estimator.py` (weights + KV-cache headroom for the chosen context length).

---

## 9. Chat streaming architecture

```
<Composer> send
   │  optimistic user MessageBubble appended
   ▼
fetch POST /v1/chat/completions (stream:true)
   │  Authorization: Bearer <api_key>
   │  body: { model, messages, temperature, … }
   ▼
FastAPI handler
   ├─ resolve runner from runner_registry (lazy-load if allowed)
   ├─ build prompt via model's chat template (tokenizer.apply_chat_template)
   └─ StreamingResponse(media_type="text/event-stream")
        │  for token in mlx_lm.stream_generate(model, tokenizer, prompt, …):
        │     yield  data: {choices:[{delta:{content: token}}]}\n\n
        │  yield  data: [DONE]
   ▼
Frontend SSE reader (lib/sse.ts)
   ├─ append delta.content to the streaming assistant bubble
   ├─ throttle React re-renders (rAF/batched) for smooth 60 fps
   ├─ live token/s in the bubble footer
   └─ "Stop" → AbortController → cancels fetch → server sees disconnect,
                                 stops generation, frees compute
   ▼
On [DONE]
   ├─ persist assistant message (content, tokens, tok_per_sec)
   ├─ update conversation.updated_at; auto-title if first exchange
   └─ activity_log: "Chatted with {model}"
```

**Key choices:** SSE (not WebSocket) because the OpenAI streaming format *is* SSE — same code path serves the built-in chat and external clients. Generation runs in a worker thread / async task so the event loop stays responsive and `/system/stats/stream` keeps flowing during inference. Cancellation is honored both client-side (AbortController) and server-side (disconnect detection) so a stopped generation immediately releases the GPU. Multiple conversations are independent rows; switching is instant since history is in SQLite, and only one model need be resident to serve all of them.

---

## 10. Future features roadmap

**v1.0 — Core (this design).** Discover, download, manage, run, chat, OpenAI API, system metrics, light/dark, settings.

**v1.1 — Power user.**
- Multi-model concurrent runners with a memory budget scheduler (auto-evict LRU model under pressure).
- Prompt/preset library and per-conversation system prompts.
- Quantization-on-device (convert HF models to MLX 4/8-bit locally).
- Model comparison view (A/B same prompt across two models).

**v1.2 — Multimodal & tools.**
- Vision model chat (image attachments) end-to-end.
- Function/tool calling passthrough in the OpenAI API.
- Embeddings + a lightweight local RAG ("Chat with your files").
- Speech: Whisper (MLX) transcription input, optional TTS output.

**v1.3 — Developer platform.**
- Workspaces/projects with saved API keys and usage stats.
- Built-in API playground and request logs.
- CLI companion (`mlxstudio pull/run/serve`) sharing the sidecar.
- Plugin/extension API for custom model sources.

**v2.0 — Scale & sharing.**
- Fine-tuning / LoRA training UI on Apple Silicon.
- Model collections and shareable presets.
- Optional remote/headless mode (run the engine on a Mac Studio, control from a laptop).
- Benchmarking suite (tokens/s, time-to-first-token, memory by model).

**Cross-cutting, ongoing:** telemetry strictly opt-in and local-first; accessibility (VoiceOver, full keyboard, Reduce Motion) audited each release; signed & notarized builds; localization (the app should ship Italian and English at minimum).

---

## Appendix A — Estimating RAM fit

The "fits your machine" badge uses: `est_ram ≈ weight_bytes + kv_cache(ctx, layers, heads, dtype) + overhead`. For a 4-bit 7B model that's roughly weights ~4 GB + a few hundred MB KV-cache at 8k context. The estimator reads the model's `config.json` (hidden size, layers, heads) to compute KV-cache precisely rather than guessing, and compares against *available* unified memory (total − OS reserve − currently-loaded models), not total RAM.

## Appendix B — Default ports & paths

- API port: `11535` (configurable; collisions auto-resolved at launch).
- Models dir: `~/.mlxstudio/models` (configurable; can point at an external SSD).
- App data: `~/Library/Application Support/MLX Studio/` (db, logs).
- Secrets: macOS Keychain (`com.mlxstudio.app`).
