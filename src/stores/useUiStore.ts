import { create } from "zustand";
import { useHistoryStore } from "./useHistoryStore";

export type ViewKey = "search" | "settings" | "explore" | "downloads";
interface UiState {
  activeUid: string;
  activeView: ViewKey;
  pendingLookupUid: string | null;
  isSidebarOpen: boolean;

  setActiveUid: (uid: string) => void;
  setActiveView: (view: ViewKey) => void;
  setPendingLookupUid: (uid: string | null) => void;
  setSidebarOpen: (isOpen: boolean) => void;

  closeSettings: () => void;
  toggleSidebar: () => void;
  openHistoryProfile: (uid: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeUid: "",
  activeView: "search",
  pendingLookupUid: null,
  isSidebarOpen: false,

  setActiveUid: (activeUid: string) => set({ activeUid }),
  setActiveView: (activeView: ViewKey) => set({ activeView }),
  setPendingLookupUid: (pendingLookupUid: string | null) =>
    set({ pendingLookupUid }),
  setSidebarOpen: (isSidebarOpen: boolean) => set({ isSidebarOpen }),

  closeSettings: () => set({ activeView: "search" }),
  toggleSidebar: () =>
    set((state: UiState) => ({ isSidebarOpen: !state.isSidebarOpen })),
  openHistoryProfile: (uid: string) => {
    useHistoryStore.getState().moveToFront(uid);
    set({
      activeUid: uid,
      activeView: "search",
      pendingLookupUid: uid,
    });
  },
}));
