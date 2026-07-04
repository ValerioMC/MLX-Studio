# MLX Studio

Local AI for Apple Silicon, made simple. Discover, download, run, and chat with
[MLX](https://github.com/ml-explore/mlx) models — with an OpenAI-compatible local API.

> Think Ollama, but native to Apple Silicon and built around the MLX runtime.

## Stack

| Layer | Tech |
|---|---|
| Desktop shell | Tauri 2 (Rust) |
| Frontend | React 18 + TypeScript + Vite |
| UI | TailwindCSS, shadcn-style primitives, lucide icons |
| Backend (sidecar) | Python + FastAPI |
| AI engine | `mlx-lm` |
| DB | SQLite (SQLAlchemy) |

Architecture details are in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Project layout

```
mlx-studio/
├─ src/            React + TypeScript frontend
├─ src-tauri/      Rust core (window, menus, sidecar lifecycle, updater)
├─ sidecar/        Python FastAPI backend (catalog, downloads, engine, /v1 API)
├─ scripts/        build-sidecar.sh, gen-api-types.sh
└─ ARCHITECTURE.md
```

## Prerequisites

- macOS 12+ on Apple Silicon (the engine needs MLX; on other machines it runs
  with a stub so the UI is still fully developable)
- [Node 18+](https://nodejs.org) and [pnpm](https://pnpm.io)
- [Rust](https://rustup.rs) (stable) + Xcode command-line tools
- [uv](https://github.com/astral-sh/uv) for the Python sidecar

## Develop

Run the three pieces. In dev they run as separate processes; in a packaged build
the Rust core spawns the bundled sidecar automatically.

```bash
# 1. Python sidecar (terminal 1)
cd sidecar
uv sync --extra mlx          # omit --extra mlx on non-Apple-Silicon machines
uv run uvicorn mlxstudio.main:app --port 11535 --reload

# 2. Frontend + Tauri shell (terminal 2)
pnpm install
pnpm tauri:dev
```

The frontend reaches the sidecar at `http://127.0.0.1:11535`. In `pnpm tauri:dev`
the Rust core injects the real port + auth tokens via `get_runtime_config`; in a
plain browser (`pnpm dev`) it falls back to localhost defaults.

## Build a release

```bash
pnpm sidecar:build          # PyInstaller → src-tauri/binaries/
pnpm tauri:build            # produces MLX Studio.app + .dmg
```

## Using the OpenAI-compatible API

Once a model is running, point any OpenAI client at the local server:

```python
from openai import OpenAI

client = OpenAI(base_url="http://127.0.0.1:11535/v1", api_key="<your MLX Studio API key>")
resp = client.chat.completions.create(
    model="qwen2.5-7b-instruct-4bit",
    messages=[{"role": "user", "content": "Hello!"}],
    stream=True,
)
for chunk in resp:
    print(chunk.choices[0].delta.content or "", end="")
```

Find the API key under **Settings ▸ API**.

## Features

- **Dashboard** — installed/running models, live memory gauge, recent activity
- **Catalog** — search `mlx-community` models, filter by params/quant/vision/instruct, memory-fit badge (Fits / Tight / Too big / Unknown)
- **Downloads** — resumable downloads with live speed + progress (SSE)
- **Models** — start, stop, delete, update, view logs; memory-fit guard before load
- **Chat** — streaming responses, Markdown + code highlighting, multiple conversations
- **Settings** — models directory, API port/key, theme, performance defaults, optional Hugging Face token (raises download rate limits)
- **OpenAI-compatible `/v1` API** — for `curl`, the OpenAI SDK, Continue, Cursor, etc.

## License

MIT
