import { isWebMode } from "./backend";

export function proxyImage(srcUrl: string): string {
  if (!srcUrl) return "";
  const encodedUrl = encodeURIComponent(srcUrl);
  if (isWebMode) return `/img-proxy?url=${encodedUrl}`;
  // Tauri mode: lazy check platform via dynamic import to avoid bundling Tauri deps in web build
  try {
    const w = window as unknown as { __TAURI__?: unknown };
    if (w.__TAURI__) {
      const isWin = navigator.platform.toLowerCase().includes("win");
      if (isWin) return `http://img-proxy.localhost/?url=${encodedUrl}`;
      return `img-proxy://localhost/?url=${encodedUrl}`;
    }
  } catch {}
  return `/img-proxy?url=${encodedUrl}`;
}
