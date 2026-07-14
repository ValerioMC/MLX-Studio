#!/usr/bin/env bash
# Bundle the Python sidecar into a single binary and place it where Tauri expects
# it (src-tauri/binaries/mlxstudio-server-<target-triple>).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/sidecar"

TARGET_TRIPLE="$(rustc -Vv | grep host | cut -d' ' -f2)"
OUT_DIR="$ROOT/src-tauri/binaries"
mkdir -p "$OUT_DIR"

echo "Building sidecar for $TARGET_TRIPLE …"
[ -d .venv ] || uv venv --quiet

# MLX only ships wheels for Apple Silicon; on other archs the engine runs
# with its stub and the binary is built without mlx/mlx_lm.
MLX_COLLECT_FLAGS=()
if [ "$(uname -m)" = "arm64" ]; then
  uv pip install --quiet -e ".[mlx]" pyinstaller
  MLX_COLLECT_FLAGS=(--collect-all mlx --collect-all mlx_lm --collect-all mlx_metal)
else
  echo "Non-Apple-Silicon host: bundling without MLX (engine stub)."
  uv pip install --quiet -e . pyinstaller
fi

uv run pyinstaller \
  --onefile \
  --name "mlxstudio-server" \
  --paths . \
  --collect-submodules mlxstudio \
  --collect-all huggingface_hub \
  ${MLX_COLLECT_FLAGS[@]+"${MLX_COLLECT_FLAGS[@]}"} \
  --hidden-import uvicorn.logging \
  -c run_server.py

cp "dist/mlxstudio-server" "$OUT_DIR/mlxstudio-server-$TARGET_TRIPLE"
echo "✓ Sidecar at $OUT_DIR/mlxstudio-server-$TARGET_TRIPLE"
