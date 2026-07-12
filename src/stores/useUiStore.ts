import { create } from "zustand";

interface UiState {
  activeUid: string;
  activeView: "search" | "settings";
  pendingLookupUid: string | null;
  isSidebarOpen: boolean;
  historyOnSidebar: boolean;

  setActiveUid: (uid: string) => void;
  setActiveView: (view: "search" | "settings") => void;
  setPendingLookupUid: (uid: string | null) => void;
  setSidebarOpen: (isOpen: boolean) => void;
  setHistoryOnSidebar: (value: boolean) => void;

  closeSettings: () => void;
  toggleSidebar: () => void;
  openHistoryProfile: (uid: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeUid: "",
  activeView: "search",
  pendingLookupUid: null,
  isSidebarOpen: false,
  historyOnSidebar: false,

  setActiveUid: (activeUid: string) => set({ activeUid }),
  setActiveView: (activeView: "search" | "settings") => set({ activeView }),
  setPendingLookupUid: (pendingLookupUid: string | null) =>
    set({ pendingLookupUid }),
  setSidebarOpen: (isSidebarOpen: boolean) => set({ isSidebarOpen }),
  setHistoryOnSidebar: (historyOnSidebar: boolean) => set({ historyOnSidebar }),

  closeSettings: () => set({ activeView: "search" }),
  toggleSidebar: () =>
    set((state: UiState) => ({ isSidebarOpen: !state.isSidebarOpen })),
  openHistoryProfile: (uid: string) =>
    set({
      activeUid: uid,
      activeView: "search",
      pendingLookupUid: uid,
    }),
}));
