export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL as
  | string
  | undefined;
// Tauri injects __TAURI_INTERNALS__ before any app script runs (withGlobalTauri=true).
// In a Tauri WebView this is present; in a plain browser (LAN server mode or `bun dev`) it is absent.
// Using runtime detection keeps the same embedded dist/ working for both exe and server mode
// without requiring a rebuild with VITE_BACKEND_URL set.
export const isWebMode =
  typeof window !== "undefined"
    ? !("__TAURI_INTERNALS__" in window) && !("__TAURI__" in window)
    : !!BACKEND_URL;
export function api(path: string): string {
  if (BACKEND_URL) return `${BACKEND_URL.replace(/\/$/, "")}${path}`;
  return path;
}
