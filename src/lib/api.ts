import type { GPSData, Place } from "../types/gps";
import type { DownloadItem, WmPosition } from "../types/rpc";

import { api, isWebMode } from "./backend";

// Lazy import — @tauri-apps/api/core requires __TAURI__ which only exists in Tauri WebView.
// Dynamic import defers resolution until the first non-web-mode call, so browser loads don't crash.
async function tauriInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

async function webGet<T>(path: string): Promise<T> {
  const res = await fetch(api(path));
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}
async function webPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(api(path), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok)
    throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}
async function webPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(api(path), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok)
    throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export async function defaultDownloadDir(): Promise<string> {
  if (isWebMode) {
    const data = await webGet<{ path: string }>("/api/download-dir/default");
    return data.path;
  }
  return tauriInvoke<string>("default_download_dir");
}

export async function chooseDownloadDir(
  startingFolder?: string,
): Promise<string> {
  if (isWebMode) {
    const current = await defaultDownloadDir();
    return startingFolder || current;
  }
  return tauriInvoke<string>("choose_download_dir", { startingFolder });
}

export async function downloadPost(params: {
  uid: string;
  blogId: string;
  date: string;
  dewatermark: WmPosition;
  items: DownloadItem[];
  target?: string | undefined;
  gps?: GPSData | undefined;
}): Promise<{ savedPaths: string[]; count: number }> {
  if (isWebMode) return webPost("/api/download", params);
  return tauriInvoke("download_post", { request: params }) as Promise<{
    savedPaths: string[];
    count: number;
  }>;
}

export async function cancelDownloadPost(blogId: string): Promise<void> {
  if (isWebMode) {
    await webPost("/api/download/cancel", { blogId });
    return;
  }
  return tauriInvoke("cancel_download_post", { blogId });
}

export async function listPlaces(payload: {
  limit: number;
  offset: number;
}): Promise<{ places: Place[]; total: number }> {
  if (isWebMode)
    return webGet(
      `/api/places?limit=${payload.limit}&offset=${payload.offset}`,
    );
  return tauriInvoke("list_places", payload);
}

export async function searchPlace(query: string): Promise<Place[]> {
  if (isWebMode)
    return webGet(`/api/places/search?q=${encodeURIComponent(query)}`);
  return tauriInvoke<Place[]>("search_place", { query });
}

export async function addPlace(place: Place): Promise<void> {
  if (isWebMode) {
    await webPost("/api/places", place);
    return;
  }
  return tauriInvoke("add_place", { place });
}

export async function getPlaceByPost(
  uid: string,
  blogId: string,
): Promise<Place> {
  if (isWebMode)
    return webGet(
      `/api/places/by-post?uid=${encodeURIComponent(uid)}&blogId=${encodeURIComponent(blogId)}`,
    );
  return tauriInvoke<Place>("get_place_by_post", { uid, blogId });
}

export async function setBlogPlace(
  uid: string,
  blogId: string,
  place: Place,
): Promise<void> {
  if (isWebMode) {
    await webPut("/api/places/by-post", { uid, blogId, place });
    return;
  }
  return tauriInvoke("set_blog_place", { uid, blogId, place });
}

export async function removeBlogPlace(
  uid: string,
  blogId: string,
): Promise<void> {
  if (isWebMode) {
    const res = await fetch(
      api(
        `/api/places/by-post?uid=${encodeURIComponent(uid)}&blogId=${encodeURIComponent(blogId)}`,
      ),
      { method: "DELETE" },
    );
    if (!res.ok) throw new Error(`removeBlogPlace failed: ${res.status}`);
    return;
  }
  return tauriInvoke("remove_blog_place", { uid, blogId });
}

export async function getSettings(): Promise<{
  cookie: string | null;
  downloadPath: string | null;
  wmPosition: string | null;
  onboardingDismissed: string | null;
}> {
  if (isWebMode) return webGet("/api/settings");
  const cookie = await tauriInvoke<string | null>("get_settings", {
    key: "cookie",
  }).catch(() => null);
  const downloadPath = await tauriInvoke<string | null>("get_settings", {
    key: "download_path",
  }).catch(() => null);
  const wmPosition = await tauriInvoke<string | null>("get_settings", {
    key: "wm_position",
  }).catch(() => null);
  const onboardingDismissed = await tauriInvoke<string | null>("get_settings", {
    key: "onboarding_dismissed",
  }).catch(() => null);
  return { cookie, downloadPath, wmPosition, onboardingDismissed };
}

export async function saveSettings(patch: {
  cookie?: string;
  downloadPath?: string;
  wmPosition?: string;
  onboardingDismissed?: string;
}): Promise<void> {
  if (isWebMode) {
    await webPut("/api/settings", patch);
    return;
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    const key =
      k === "downloadPath"
        ? "download_path"
        : k === "wmPosition"
          ? "wm_position"
          : k === "onboardingDismissed"
            ? "onboarding_dismissed"
            : k;
    await tauriInvoke("save_settings", { key, value: v as string });
  }
}

export async function getHistory(): Promise<
  Array<{
    uid: string;
    screenName: string;
    profileImageUrl: string;
    timestamp: number;
  }>
> {
  if (isWebMode) return webGet("/api/history");
  return tauriInvoke("list_profile_history_cmd");
}

export async function addHistory(item: {
  uid: string;
  screenName: string;
  profileImageUrl: string;
  timestamp: number;
}): Promise<void> {
  if (isWebMode) {
    await webPost("/api/history", item);
    return;
  }
  return tauriInvoke("upsert_profile_history_cmd", { row: item });
}

export async function removeHistory(uid: string): Promise<void> {
  if (isWebMode) {
    await fetch(api(`/api/history/${encodeURIComponent(uid)}`), {
      method: "DELETE",
    });
    return;
  }
  return tauriInvoke("delete_profile_history_cmd", { uid });
}

export async function clearHistoryRemote(): Promise<void> {
  if (isWebMode) {
    await fetch(api("/api/history"), { method: "DELETE" });
    return;
  }
  return tauriInvoke("clear_profile_history_cmd");
}

export async function setUserAgent(ua: string): Promise<void> {
  if (isWebMode) {
    await webPost("/api/user-agent", { ua });
    return;
  }
  return tauriInvoke("set_user_agent", { ua });
}
