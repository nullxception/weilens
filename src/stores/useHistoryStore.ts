import { create } from "zustand";
import { StorageKeys } from "../storage-keys";

export interface CheckedProfile {
  uid: string;
  screenName: string;
  profileImageUrl: string;
  timestamp: number;
}

function readHistoryFromStorage(): CheckedProfile[] {
  try {
    const saved = localStorage.getItem(StorageKeys.PROFILE_HISTORY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function writeHistoryToStorage(history: CheckedProfile[]) {
  try {
    localStorage.setItem(StorageKeys.PROFILE_HISTORY, JSON.stringify(history));
  } catch (error) {
    console.error("Failed to save history to localStorage:", error);
  }
}

interface HistoryState {
  history: CheckedProfile[];
  addToHistory: (
    uid: string,
    screenName: string,
    profileImageUrl: string,
  ) => void;
  removeFromHistory: (uid: string) => void;
  clearHistory: () => void;
}

export const useHistoryStore = create<HistoryState>((set) => ({
  history: readHistoryFromStorage(),
  addToHistory: (uid: string, screenName: string, profileImageUrl: string) =>
    set((state: HistoryState) => {
      const filtered = state.history.filter((item) => item.uid !== uid);
      const nextHistory = [
        {
          uid,
          screenName,
          profileImageUrl,
          timestamp: Date.now(),
        },
        ...filtered,
      ];

      writeHistoryToStorage(nextHistory);

      return { history: nextHistory };
    }),
  removeFromHistory: (uid: string) =>
    set((state: HistoryState) => {
      const nextHistory = state.history.filter((item) => item.uid !== uid);
      writeHistoryToStorage(nextHistory);

      return { history: nextHistory };
    }),
  clearHistory: () => {
    try {
      localStorage.removeItem(StorageKeys.PROFILE_HISTORY);
    } catch (error) {
      console.error("Failed to clear history from localStorage:", error);
    }

    set({ history: [] });
  },
}));
