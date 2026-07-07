import type { FormEvent, ReactNode } from "react";
import { X, Menu } from "lucide-react";
import { HistoryPanel } from "./HistoryPanel";
import { SearchForm } from "./SearchForm";
import { SettingsModal } from "./SettingsModal";
import { Button } from "./ui/button";
import { useAppStore, type AppState } from "../stores/appStore";

interface AppShellProps {
  uid: string;
  isLoading: boolean;
  onUidChange: (uid: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onHistoryClick: (uid: string) => void;
  onRemoveFromHistory: (uid: string) => void;
  onClearHistory: () => void;
  onOpenSettings: () => void;
  onCloseSidebar: () => void;
  activeView: "search" | "settings";
  cookie: string;
  onCookieChange: (value: string) => void;
  downloadLocation: string;
  onDownloadLocationChange: (value: string) => void;
  onSaveCookie: () => void;
  onBackToSearch: () => void;
  savedMessage: string;
  history: {
    uid: string;
    screenName: string;
    profileImageUrl: string;
    timestamp: number;
  }[];
  historyOnSidebar: boolean;
  children: ReactNode;
}

export function AppShell({
  uid,
  isLoading,
  onUidChange,
  onSubmit,
  onHistoryClick,
  onRemoveFromHistory,
  onClearHistory,
  onOpenSettings,
  onCloseSidebar,
  activeView,
  cookie,
  onCookieChange,
  downloadLocation,
  onDownloadLocationChange,
  onSaveCookie,
  onBackToSearch,
  savedMessage,
  history,
  historyOnSidebar,
  children,
}: AppShellProps) {
  const isSidebarOpen = useAppStore((state: AppState) => state.isSidebarOpen);
  const toggleSidebar = useAppStore((state: AppState) => state.toggleSidebar);
  const showHistory = history.length > 0 && historyOnSidebar;

  return (
    <div className="min-h-screen bg-background text-foreground p-2">
      {activeView === "settings" && (
        <SettingsModal
          cookie={cookie}
          onCookieChange={onCookieChange}
          downloadLocation={downloadLocation}
          onDownloadLocationChange={onDownloadLocationChange}
          onSave={onSaveCookie}
          onBack={onBackToSearch}
          savedMessage={savedMessage}
        />
      )}

      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity duration-300 md:hidden ${isSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={onCloseSidebar}
      />

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 overflow-y-auto bg-background px-3 py-4 shadow-2xl transition-transform duration-300 ease-in-out md:hidden ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onCloseSidebar}
          className="mb-4 ml-auto flex"
          aria-label="Close sidebar"
        >
          <X />
        </Button>
        <div className="space-y-4">
          <SearchForm
            uid={uid}
            isLoading={isLoading}
            onUidChange={onUidChange}
            onSubmit={(event) => {
              onSubmit(event);
              onCloseSidebar();
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenSettings();
              onCloseSidebar();
            }}
            className="w-full"
          >
            Settings
          </Button>
          {showHistory && (
            <HistoryPanel
              history={history}
              activeUid={uid}
              onProfileClick={(profileUid) => {
                onHistoryClick(profileUid);
                onCloseSidebar();
              }}
              onRemove={onRemoveFromHistory}
              onClear={onClearHistory}
            />
          )}
        </div>
      </aside>

      {/* Mobile FAB */}
      <Button
        type="button"
        onClick={toggleSidebar}
        size="icon-lg"
        className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg md:hidden"
        aria-label="Toggle sidebar"
      >
        {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Desktop layout */}
      <div className="grid gap-2 md:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden md:block md:sticky md:self-start space-y-4">
          <SearchForm
            uid={uid}
            isLoading={isLoading}
            onUidChange={onUidChange}
            onSubmit={onSubmit}
          />
          <Button
            type="button"
            variant="outline"
            onClick={onOpenSettings}
            className="w-full"
          >
            Settings
          </Button>
          {showHistory && (
            <HistoryPanel
              history={history}
              activeUid={uid}
              onProfileClick={onHistoryClick}
              onRemove={onRemoveFromHistory}
              onClear={onClearHistory}
            />
          )}
        </aside>

        <div className="md:col-start-2 space-y-4">{children}</div>
      </div>
    </div>
  );
}
