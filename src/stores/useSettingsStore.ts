import { create } from "zustand";

import type { WmPosition } from "@/types/rpc";

import { getSettings, saveSettings } from "@/lib/api";
import { isWebMode } from "@/lib/backend";

import { StorageKeys } from "../storage-keys";

function readDownloadLocationFromStorage(): string {
  try {
    return localStorage.getItem(StorageKeys.DOWNLOAD_PATH) ?? "";
  } catch {
    return "";
  }
}
function readWmPositionFromStorage(): WmPosition {
  try {
    const v = localStorage.getItem(StorageKeys.WM_POSITION);
    if (v === "top" || v === "center" || v === "bottom") return v;
    return "bottom";
  } catch {
    return "bottom";
  }
}

interface SettingsState {
  downloadLocation: string;
  dewatermark: WmPosition;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setDownloadLocation: (v: string) => void;
  setWmPosition: (v: WmPosition) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  downloadLocation: readDownloadLocationFromStorage(),
  dewatermark: readWmPositionFromStorage(),
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const s = await getSettings();
      let dl = s.downloadPath ?? "";
      let wm = (s.wmPosition as WmPosition | null) ?? null;
      const localDl = readDownloadLocationFromStorage();
      const localWm = readWmPositionFromStorage();
      const patch: Record<string, string> = {};
      if (!dl && localDl) {
        dl = localDl;
        patch.downloadPath = localDl;
      }
      if (!wm && localStorage.getItem(StorageKeys.WM_POSITION) !== null) {
        wm = localWm;
        patch.wmPosition = localWm;
      }
      if (!wm) wm = "bottom";
      if (Object.keys(patch).length) {
        try {
          await saveSettings(patch as never);
          for (const k of Object.keys(patch)) {
            const lk =
              k === "downloadPath"
                ? StorageKeys.DOWNLOAD_PATH
                : StorageKeys.WM_POSITION;
            try {
              localStorage.removeItem(lk);
            } catch {}
          }
        } catch (e) {
          console.error("settings migrate failed", e);
          // keep localStorage so we can retry next launch
          set({
            downloadLocation: dl,
            dewatermark: wm as WmPosition,
            hydrated: true,
          });
          return;
        }
      } else {
        try {
          if (dl) localStorage.removeItem(StorageKeys.DOWNLOAD_PATH);
          if (wm) localStorage.removeItem(StorageKeys.WM_POSITION);
        } catch {}
      }
      set({
        downloadLocation: dl,
        dewatermark: wm as WmPosition,
        hydrated: true,
      });
    } catch (e) {
      console.error("settings hydrate failed", e);
      set({ hydrated: true });
    }
  },
  setDownloadLocation: (downloadLocation: string) => {
    void saveSettings({ downloadPath: downloadLocation })
      .then(() => {
        try {
          localStorage.removeItem(StorageKeys.DOWNLOAD_PATH);
        } catch {}
      })
      .catch((e) => console.error(e));
    if (!isWebMode)
      try {
        localStorage.setItem(StorageKeys.DOWNLOAD_PATH, downloadLocation);
      } catch {}
    set({ downloadLocation });
  },
  setWmPosition: (wmPosition: WmPosition) => {
    void saveSettings({ wmPosition })
      .then(() => {
        try {
          localStorage.removeItem(StorageKeys.WM_POSITION);
        } catch {}
      })
      .catch((e) => console.error(e));
    if (!isWebMode)
      try {
        localStorage.setItem(StorageKeys.WM_POSITION, wmPosition);
      } catch {}
    set({ dewatermark: wmPosition });
  },
}));
