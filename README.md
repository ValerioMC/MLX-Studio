# MLX Studio

Local AI for Apple Silicon, made simple. Discover, download, run, and chat with
[MLX](https://github.com/ml-explore/mlx) models — with an OpenAI-compatible local API.

> Think Ollama, but native to Apple Silicon and built around the MLX runtime.

## Download

Latest build (rebuilt automatically from `main` on every push, tag [`latest`](https://github.com/ValerioMC/MLX-Studio/releases/tag/latest)):

| Mac | Download |
|---|---|
| Apple Silicon (M1 and later) | [MLX-Studio_apple-silicon.dmg](https://github.com/ValerioMC/MLX-Studio/releases/download/latest/MLX-Studio_apple-silicon.dmg) |

MLX requires Apple Silicon, so Intel Macs are not supported. macOS 12+.

The app is self-contained: the Python sidecar ships inside the bundle as a
PyInstaller binary, so there is nothing to install first (no Python, no Homebrew).

Builds are unsigned and not notarized, so macOS reports the downloaded app as
"damaged". After copying it to `/Applications`, clear the quarantine flag once:

```bash
xattr -dr com.apple.quarantine "/Applications/MLX Studio.app"
```

## Stack

| Layer | Tech |
|---|---|
| Desktop shell | Tauri 2 (Rust) |
| Frontend | Vue 3 (Composition API) + TypeScript + Vite |
| UI | TailwindCSS on the app's own CSS-variable tokens (ink canvas + one lime signal, light and dark), bundled Geist / Geist Mono, custom SVG instruments, lucide icons |
| Backend (sidecar) | Python + FastAPI |
| AI engine | `mlx-lm` (text) + `mlx-vlm` (vision) |
| DB | SQLite (SQLAlchemy) |

Architecture details are in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Project layout

```
mlx-studio/
├─ src/            Vue + TypeScript frontend
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

On non-Apple-Silicon machines `pnpm sidecar:build` bundles the sidecar without
MLX (the engine falls back to its stub).

`make dmg-native` does the same build, then installs `MLX Studio.app` straight into
`/Applications` on this machine (replacing a running copy, quitting it first). The
`.dmg` is still what you'd hand to another machine; `MLXSTUDIO_INSTALL=0` builds it
without installing. `make dmg` builds without installing at all.

### CI releases

Every push to `main` runs [`release-latest.yml`](./.github/workflows/release-latest.yml).
It first runs the checks in [`ci.yml`](./.github/workflows/ci.yml): frontend lint,
typecheck and vitest, then sidecar pytest and ruff. If any fails, nothing is built
or published. When they pass, it builds the app on `macos-14` (Apple Silicon) and
recreates the GitHub release tagged `latest` with the DMG
(`MLX-Studio_apple-silicon.dmg`). Pull requests to `main` run the same checks
without releasing. The
workflow can also be triggered manually from the Actions tab. Current version: **0.4.0** (kept in
sync across `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`,
`sidecar/pyproject.toml`, and `sidecar/mlxstudio/__init__.py`).

## Using the OpenAI-compatible API

Point any OpenAI client at the local server. Every installed chat model is served:
if it is not running yet, it loads automatically on the first request.
`GET /v1/models` lists all installed chat models. In the app, the **Models** tab has
a Connect button per model with ready-to-copy snippets (OpenAI SDK, LangChain, LangChain4j, Rig, curl).

Tool calling (`tools`, `tool_calls`, role `tool` messages, streaming deltas,
`finish_reason: "tool_calls"`) works with models whose chat template declares a
tool format mlx-lm can parse (Qwen, Mistral, GLM, Gemma, Kimi, ...). Requests
with `tools` against a model without one fail with a 400.

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

Find the API key under **Settings ▸ Local API**.

## Features

- **Memory instruments**: the Mac's unified memory split into each loaded model, macOS and apps, the 15% safety reserve and what is free for models. A radial dial on Overview (hover an arc or its legend row to read it), a strip of per-GB cells in the sidebar, and a preview of where a model will land in the start dialog. Each model keeps one color everywhere: its arc, its cells and its status core
- **Model cores**: every model's state (idle, loading, running, generating, stopping, error) is drawn by one animated instrument, in the rail, the lists, the palette and next to each chat reply
- **Overview**: free memory for models, live CPU trace, disk and swap, running models (chat, use from code, stop, share of memory), quick start for installed models, swap warning, activity timeline
- **Command palette** (⌘K): jump to any page, chat with / start / stop any model, new chat, switch appearance, search the catalog for what you typed
- **Toasts**: outcomes that happen away from where you are looking (a model finished loading, a delete, a failure) are reported bottom-right; errors stay longer than successes
- **Catalog**: debounced search of `mlx-community`, filters (4/8-bit, vision, instruct, fits this Mac), sort by downloads, likes or recency, a memory meter per model against this Mac's usable memory, download state per row (downloading, paused, retry, installed), model card dialog
- **Downloads**: resumable downloads with live speed, progress and time left (SSE); pause/cancel take effect at the next file boundary; failed jobs retry in place; finished jobs can be cleared without touching the installed model
- **Models**: start (context length and reasoning, with a live memory breakdown), stop, delete (confirmed), update; "Use from code" dialog with snippets (Python OpenAI SDK, LangChain, Java LangChain4j, Rust Rig, curl); non-chat repos (ASR, embeddings) are flagged and not startable
- **Chat**: prompt starters on an empty chat, a filter for past chats, streaming responses batched per frame with an inline caret, Markdown with highlighted, copyable code; collapsible reasoning ("Thought for 4 s") for Qwen3/DeepSeek-R1 style models; copy, regenerate, tokens/sec and time to first token per reply; notice when a reply hits the token limit; conversations grouped by date, renamable, persisted; system prompt, temperature and reply length remembered across launches; image attachments (picker, paste or drop) on vision models
- **Vision models**: repos with a vision tower (Qwen-VL, LLaVA, ...) load through `mlx-vlm`; the `/v1` API accepts OpenAI-style `image_url` content parts (base64 data URLs or http URLs)
- **Settings**: theme (system, light, dark, remembered), chat defaults, API base URL/key, optional Hugging Face token, models directory, how memory fit is decided
- **Menu bar**: an icon in the macOS menu bar shows free memory for models and each running model, with *Open chat* and *Stop* per model, plus *Open MLX Studio* and *Quit MLX Studio*. Closing the window only hides it: the app keeps serving the API from the menu bar, and the Dock icon or *Open MLX Studio* brings the window back. Quit from the menu-bar item or with ⌘Q, which also stops the engine
- **Keyboard**: ⌘K opens the command palette, ⌘1–⌘5 switch pages, ⌘, opens Settings, ⌘N starts a new chat, ⌘F searches the catalog, Esc closes dialogs
- **Design system**: every primitive and instrument in every state, at `#/design` (or "Open the design system" in the palette)
- **OpenAI-compatible `/v1` API**: for `curl`, the OpenAI SDK, LangChain, Continue, Cursor, etc.; supports tool/function calling (agentic clients) on models with a parseable tool format

## Process lifecycle

The sidecar can never outlive the app:

1. On quit, the Rust core kills the sidecar child and sweeps any process still
   listening on its port (a PyInstaller onefile kill only reaches the bootloader).
2. On launch, it kills stale `mlxstudio-server` processes holding the port from a
   previous crash, and falls back to a free port if a foreign app occupies it.
3. The sidecar watches the app's PID (`MLXSTUDIO_PARENT_PID`) and exits on its own
   if the app dies without cleanup (force-quit, crash).

## Run tests

```bash
cd sidecar
uv run --extra dev pytest tests      # sidecar unit + API tests
cd ..
pnpm test                            # frontend unit tests (vitest)
pnpm typecheck                       # frontend typecheck
pnpm lint                            # ESLint (flat config in eslint.config.js)
```

## License

MIT
