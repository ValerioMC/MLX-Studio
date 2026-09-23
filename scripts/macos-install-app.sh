#!/usr/bin/env bash
# Installs the MLX Studio.app that `pnpm tauri build` just produced into /Applications.
# Run via `make dmg-native`, not on its own.
#
# The .dmg Tauri also builds is what travels to another machine; this is for the machine that
# just built it, so the copy you are iterating on is the one in the Dock. MLXSTUDIO_INSTALL=0
# skips the install and leaves the .app and .dmg under src-tauri/target/release/bundle/ as the
# only output.
set -euo pipefail

if [ "$(uname -s)" != "Darwin" ]; then
    echo "This installs a macOS .app and only runs on macOS." >&2
    exit 1
fi

if [ "${MLXSTUDIO_INSTALL:-1}" = "0" ]; then
    echo "==> Not installing (MLXSTUDIO_INSTALL=0)"
    exit 0
fi

cd "$(dirname "$0")/.."

SOURCE="src-tauri/target/release/bundle/macos/MLX Studio.app"
TARGET="/Applications/MLX Studio.app"

if [ ! -d "$SOURCE" ]; then
    echo "$SOURCE not found. Run 'make dmg-native' rather than this script on its own." >&2
    exit 1
fi

# /Applications is group-writable by admins on a stock macOS. Where it is not, this stops rather
# than escalating to sudo on its own: what a build target may write outside the project is not
# something to decide silently.
if [ ! -w /Applications ]; then
    echo "/Applications is not writable by $(whoami). Open the .dmg under src-tauri/target/release/bundle/dmg/ and drag it across instead." >&2
    exit 1
fi

# A running copy keeps the sidecar alive underneath it (the app hides on window close rather
# than quitting — see README's Menu bar note), so the replacement quits it first and only
# reopens it afterwards if it was actually up.
RUNNING=0
if pgrep -f "$TARGET/" >/dev/null 2>&1; then
    RUNNING=1
    echo "==> Quitting the running MLX Studio"
    osascript -e 'quit app "MLX Studio"' >/dev/null 2>&1 || true
    for _ in $(seq 1 40); do
        pgrep -f "$TARGET/" >/dev/null 2>&1 || break
        sleep 0.25
    done
    # It ignored the quit, or the sidecar outlived it. Nothing here is unsaved: chats are
    # written to SQLite as they happen.
    if pgrep -f "$TARGET/" >/dev/null 2>&1; then
        pkill -f "$TARGET/" >/dev/null 2>&1 || true
        sleep 1
    fi
fi

echo "==> Installing into /Applications"
# ditto rather than cp -R: it carries the extended attributes the ad-hoc signature is stored in,
# and a bundle that arrives without them is refused at launch on Apple silicon.
rm -rf "$TARGET"
ditto "$SOURCE" "$TARGET"

if [ "$RUNNING" = "1" ]; then
    echo "==> Starting the new one"
    open "$TARGET"
fi

echo
echo "    installed $TARGET ($(du -sh "$TARGET" | cut -f1 | tr -d ' '))"
