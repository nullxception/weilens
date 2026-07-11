import type { ReactNode } from "react";
import { HistoryPanel } from "./history-panel";
import { SearchForm } from "./search-form";
import { SettingsModal } from "../settings/settings-modal";
import { Button } from "./ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "./ui/sidebar";
import { TooltipProvider } from "./ui/tooltip";
import { SettingsIcon } from "lucide-react";
import { DownloadProgressPanel } from "./download-progress-panel";
import { useAppStore, type AppState } from "../stores/appStore";

interface AppShellProps {
  uid: string;
  isLoading: boolean;
  onUidChange: (uid: string) => void;
  onSubmit: (event: React.SubmitEvent<HTMLFormElement>) => void;
  onOpenSettings: () => void;
  historyOnSidebar: boolean;
  children: ReactNode;
}

function SidebarInner({
  uid,
  isLoading,
  onUidChange,
  onSubmit,
  onOpenSettings,
  showHistory,
  history,
}: {
  uid: string;
  isLoading: boolean;
  onUidChange: (uid: string) => void;
  onSubmit: (event: React.SubmitEvent<HTMLFormElement>) => void;
  onOpenSettings: () => void;
  showHistory: boolean;
  history: AppShellProps["historyOnSidebar"] extends never
    ? never
    : {
        uid: string;
        screenName: string;
        profileImageUrl: string;
        timestamp: number;
      }[];
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const onHistoryClick = useAppStore(
    (state: AppState) => state.openHistoryProfile,
  );
  const onRemoveFromHistory = useAppStore(
    (state: AppState) => state.removeFromHistory,
  );
  const onClearHistory = useAppStore((state: AppState) => state.clearHistory);
  const closeSidebar = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleOpenSettings = () => {
    onOpenSettings();
    closeSidebar();
  };

  return (
    <>
      <SidebarHeader className="p-4">
        <SearchForm
          uid={uid}
          isLoading={isLoading}
          onUidChange={onUidChange}
          onSubmit={(event) => {
            onSubmit(event);
            closeSidebar();
          }}
        />
      </SidebarHeader>
      <SidebarContent className="space-y-4 px-4 py-2">
        {showHistory && (
          <HistoryPanel
            history={history}
            onProfileClick={(profileUid) => {
              onHistoryClick(profileUid);
              closeSidebar();
            }}
            onRemove={onRemoveFromHistory}
            onClear={onClearHistory}
          />
        )}
      </SidebarContent>
      <SidebarFooter className="flex flex-col gap-3 p-4">
        <DownloadProgressPanel />
        <Button
          type="button"
          variant="outline"
          onClick={handleOpenSettings}
          className="w-full"
        >
          <SettingsIcon />
          Settings
        </Button>
      </SidebarFooter>
    </>
  );
}

export function AppShell({
  uid,
  isLoading,
  onUidChange,
  onSubmit,
  onOpenSettings,
  historyOnSidebar,
  children,
}: AppShellProps) {
  const activeView = useAppStore((state: AppState) => state.activeView);
  const history = useAppStore((state: AppState) => state.history);
  const showHistory = history.length > 0 && historyOnSidebar;

  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background text-foreground">
          {activeView === "settings" && <SettingsModal />}

          <Sidebar>
            <SidebarInner
              uid={uid}
              isLoading={isLoading}
              onUidChange={onUidChange}
              onSubmit={onSubmit}
              onOpenSettings={onOpenSettings}
              showHistory={showHistory}
              history={history}
            />
          </Sidebar>

          <main className="w-full flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mb-4 flex items-center gap-2">
              <SidebarTrigger />
            </div>
            {children}
          </main>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
