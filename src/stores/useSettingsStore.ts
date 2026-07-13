import { create } from "zustand";
import { StorageKeys } from "../storage-keys";
import type { WmPosition } from "@/types/rpc";

function readDownloadLocationFromStorage() {
  try {
    return localStorage.getItem(StorageKeys.DOWNLOAD_PATH) ?? "";
  } catch {
    return "";
  }
}

function readWmPositionFromStorage(): WmPosition {
  try {
    const val = localStorage.getItem(StorageKeys.WM_POSITION);
    if (val === "top" || val === "center" || val === "bottom") return val;
    return "bottom";
  } catch {
    return "bottom";
  }
}

interface SettingsState {
  downloadLocation: string;
  dewatermark: WmPosition;
  setDownloadLocation: (downloadLocation: string) => void;
  setWmPosition: (wmPosition: WmPosition) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  downloadLocation: readDownloadLocationFromStorage(),
  dewatermark: readWmPositionFromStorage(),
  setDownloadLocation: (downloadLocation: string) => {
    try {
      localStorage.setItem(StorageKeys.DOWNLOAD_PATH, downloadLocation);
    } catch (error) {
      console.error("Failed to save download location to localStorage:", error);
    }

    set({ downloadLocation });
  },
  setWmPosition: (wmPosition: WmPosition) => {
    try {
      localStorage.setItem(StorageKeys.WM_POSITION, wmPosition);
    } catch (error) {
      console.error("Failed to save WM position to localStorage:", error);
    }

    set({ dewatermark: wmPosition });
  },
}));
