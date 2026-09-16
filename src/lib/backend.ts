// In Tauri WebView, __TAURI_INTERNALS__ is present; in plain browser (Vite
// proxy / LAN server) it is absent. This keeps the same embedded dist/
// working for both exe and server mode without a rebuild.
export const isWebMode =
  typeof window !== "undefined"
    ? !("__TAURI_INTERNALS__" in window) && !("__TAURI__" in window)
    : false;
