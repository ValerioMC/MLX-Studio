.PHONY: help sidecar-bin dmg dmg-native

help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk -F':.*?## ' '{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

# PyInstaller output, arch-tagged, is what Tauri's `externalBin` bundles into the app (see
# tauri.conf.json). It has to exist before `tauri build` runs, on Apple Silicon this pulls in
# mlx/mlx_lm/mlx_vlm; elsewhere the engine ships with its stub.
sidecar-bin: ## Bundle the Python sidecar into the single binary the app packages
	./scripts/build-sidecar.sh

dmg: sidecar-bin ## macOS: package MLX Studio as MLX Studio.app + a .dmg (needs Rust and uv)
	pnpm install --frozen-lockfile
	pnpm tauri build

# macOS only, and additive: `dmg` above stays the plain build that has to keep working
# unattended (it is what release-latest.yml calls). This wraps it with an install into
# /Applications on the machine that just built it — the disk image is what travels elsewhere.
# See scripts/macos-install-app.sh: it replaces an existing /Applications/MLX Studio.app
# without asking, quitting it first if it is running. MLXSTUDIO_INSTALL=0 builds the disk
# image and stops there.
dmg-native: dmg ## macOS: build the .dmg above, then install MLX Studio.app into /Applications
	./scripts/macos-install-app.sh
