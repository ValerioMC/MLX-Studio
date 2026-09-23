/**
 * Opens a URL in the user's browser. Inside the app a plain link would
 * navigate the webview itself away from the UI, so it goes through the shell
 * plugin; in browser dev it falls back to a new tab.
 */
export async function openExternal(url: string): Promise<void> {
  try {
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(url);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
