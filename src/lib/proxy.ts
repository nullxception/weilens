import { api, isWebMode } from "./backend";

export function proxyImage(srcUrl: string): string {
  if (!srcUrl) return "";
  const encodedUrl = encodeURIComponent(srcUrl);
  if (isWebMode) return `${api("/img-proxy")}?url=${encodedUrl}`;
  // Tauri mode: lazy check platform via dynamic import to avoid bundling Tauri deps in web build
  // We use a sync heuristic: if running in web mode we already returned; otherwise use Tauri URI scheme
  // For Tauri, we need to know Windows vs other — do it lazily via navigator/platform or just use the http variant which works on both
  try {
    // Synchronous fallback: check if we are in Tauri by looking for __TAURI__
    const w = window as unknown as { __TAURI__?: unknown };
    if (w.__TAURI__) {
      const isWin = navigator.platform.toLowerCase().includes("win");
      if (isWin) return `http://img-proxy.localhost/?url=${encodedUrl}`;
      return `img-proxy://localhost/?url=${encodedUrl}`;
    }
  } catch {}
  return `${api("/img-proxy")}?url=${encodedUrl}`;
}
