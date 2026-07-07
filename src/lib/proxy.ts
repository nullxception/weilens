import { type } from '@tauri-apps/plugin-os';

export function proxyImage(srcUrl: string): string {
  if (!srcUrl) return "";
  
  const encodedUrl = encodeURIComponent(srcUrl);
  const isWindows = type() === 'windows';

  // Windows WebView2 requires standard http structure targeted on local subdomains
  if (isWindows) {
    return `http://img-proxy.localhost/?url=${encodedUrl}`;
  }

  // macOS / Linux can intercept raw custom protocol structures seamlessly
  return `img-proxy://localhost/?url=${encodedUrl}`;
}