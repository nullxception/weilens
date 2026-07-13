import { create } from "zustand";

export interface PostDownloadState {
  postId: string;
  total: number;
  completed: number;
  failed: number;
  cancelled: number;
  items: Record<number, "downloading" | "completed" | "failed" | "cancelled">;
}

interface DownloadsState {
  downloads: Record<string, PostDownloadState>;
  startDownload: (postId: string, total: number) => void;
  updateDownloadProgress: (
    postId: string,
    index: number,
    status: "downloading" | "completed" | "failed" | "cancelled",
  ) => void;
  clearDownload: (postId: string) => void;
  clearDownloads: () => void;
}

export const useDownloadsStore = create<DownloadsState>((set) => ({
  downloads: {},
  startDownload: (postId: string, total: number) =>
    set((state: DownloadsState) => {
      const items: Record<
        number,
        "downloading" | "completed" | "failed" | "cancelled"
      > = {};
      for (let i = 0; i < total; i++) {
        items[i] = "downloading";
      }
      return {
        downloads: {
          ...state.downloads,
          [postId]: {
            postId,
            total,
            completed: 0,
            failed: 0,
            cancelled: 0,
            items,
          },
        },
      };
    }),
  updateDownloadProgress: (
    postId: string,
    index: number,
    status: "downloading" | "completed" | "failed" | "cancelled",
  ) =>
    set((state: DownloadsState) => {
      const postDownload = state.downloads[postId];
      if (!postDownload) return {};

      const items = { ...postDownload.items, [index]: status };
      let completed = 0;
      let failed = 0;
      let cancelled = 0;
      Object.values(items).forEach((s) => {
        if (s === "completed") completed++;
        if (s === "failed") failed++;
        if (s === "cancelled") cancelled++;
      });

      return {
        downloads: {
          ...state.downloads,
          [postId]: {
            ...postDownload,
            completed,
            failed,
            cancelled,
            items,
          },
        },
      };
    }),
  clearDownload: (postId: string) =>
    set((state: DownloadsState) => {
      const next = { ...state.downloads };
      delete next[postId];
      return { downloads: next };
    }),
  clearDownloads: () => set({ downloads: {} }),
}));
