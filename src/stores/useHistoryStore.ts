import { create } from "zustand";

import {
  addHistory,
  clearHistoryRemote,
  getHistory,
  removeHistory,
} from "@/lib/api";
import { isWebMode } from "@/lib/backend";

import { StorageKeys } from "../storage-keys";

export interface CheckedProfile {
  uid: string;
  screenName: string;
  profileImageUrl: string;
  timestamp: number;
}
function readHistoryFromStorage(): CheckedProfile[] {
  try {
    const s = localStorage.getItem(StorageKeys.PROFILE_HISTORY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}
function writeHistoryToStorage(h: CheckedProfile[]) {
  try {
    localStorage.setItem(StorageKeys.PROFILE_HISTORY, JSON.stringify(h));
  } catch (e) {
    console.error(e);
  }
}

interface HistoryState {
  history: CheckedProfile[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  moveToFront: (uid: string) => void;
  addToHistory: (
    uid: string,
    screenName: string,
    profileImageUrl: string,
  ) => void;
  removeFromHistory: (uid: string) => void;
  clearHistory: () => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  history: readHistoryFromStorage(),
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const server = await getHistory();
      const local = readHistoryFromStorage();
      if (server.length === 0 && local.length > 0) {
        let migrated = 0;
        for (const item of local) {
          try {
            await addHistory(item);
            migrated++;
          } catch (e) {
            console.error("history migrate failed", item.uid, e);
          }
        }
        if (migrated === local.length) {
          try {
            localStorage.removeItem(StorageKeys.PROFILE_HISTORY);
          } catch {}
          set({ history: local, hydrated: true });
        } else {
          console.warn(
            `history migrate partial ${migrated}/${local.length}, keeping localStorage`,
          );
          const fresh = await getHistory().catch(() => local);
          set({ history: fresh.length ? fresh : local, hydrated: true });
        }
        return;
      }
      if (server.length > 0) {
        try {
          localStorage.removeItem(StorageKeys.PROFILE_HISTORY);
        } catch {}
        set({ history: server, hydrated: true });
        return;
      }
      set({ hydrated: true });
    } catch (e) {
      console.error("history hydrate failed", e);
      set({ hydrated: true });
    }
  },
  moveToFront: (uid) =>
    set((state) => {
      const item = state.history.find((h) => h.uid === uid);
      if (!item) return {};
      const filtered = state.history.filter((h) => h.uid !== uid);
      const next = [{ ...item, timestamp: Date.now() }, ...filtered];
      void addHistory({ ...item, timestamp: Date.now() }).catch(() => {});
      if (!isWebMode) writeHistoryToStorage(next);
      return { history: next };
    }),
  addToHistory: (uid, screenName, profileImageUrl) => {
    const item = { uid, screenName, profileImageUrl, timestamp: Date.now() };
    void addHistory(item).catch(() => {});
    set((state) => {
      const filtered = state.history.filter((x) => x.uid !== uid);
      const next = [item, ...filtered];
      if (!isWebMode) writeHistoryToStorage(next);
      return { history: next };
    });
  },
  removeFromHistory: (uid) => {
    void removeHistory(uid).catch(() => {});
    set((state) => {
      const next = state.history.filter((x) => x.uid !== uid);
      if (!isWebMode) writeHistoryToStorage(next);
      return { history: next };
    });
  },
  clearHistory: () => {
    void clearHistoryRemote().catch(() => {});
    if (!isWebMode)
      try {
        localStorage.removeItem(StorageKeys.PROFILE_HISTORY);
      } catch {}
    set({ history: [] });
  },
}));
