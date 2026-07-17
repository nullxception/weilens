import { create } from "zustand";
import { useHistoryStore } from "./useHistoryStore";

interface UiState {
  activeUid: string;
  pendingLookupUid: string | null;
  isSidebarOpen: boolean;

  setActiveUid: (uid: string) => void;
  setPendingLookupUid: (uid: string | null) => void;
  setSidebarOpen: (isOpen: boolean) => void;

  openHistoryProfile: (uid: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeUid: "",
  pendingLookupUid: null,
  isSidebarOpen: false,

  setActiveUid: (activeUid: string) => set({ activeUid }),
  setPendingLookupUid: (pendingLookupUid: string | null) =>
    set({ pendingLookupUid }),
  setSidebarOpen: (isSidebarOpen: boolean) => set({ isSidebarOpen }),

  openHistoryProfile: (uid: string) => {
    useHistoryStore.getState().moveToFront(uid);
    set({
      activeUid: uid,
      pendingLookupUid: uid,
    });
  },
}));
