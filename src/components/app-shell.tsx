import type { ReactNode } from "react";
import { HistoryPanel } from "./history-panel";
import { SearchForm } from "./search-form";
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
import { ArrowLeftIcon, SettingsIcon } from "lucide-react";
import { DownloadProgressPanel } from "./download-progress-panel";
import { useUiStore } from "../stores/useUiStore";
import { useHistoryStore } from "../stores/useHistoryStore";

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
  historyOnSidebar,
}: {
  uid: string;
  isLoading: boolean;
  onUidChange: (uid: string) => void;
  onSubmit: (event: React.SubmitEvent<HTMLFormElement>) => void;
  onOpenSettings: () => void;
  historyOnSidebar: boolean;
}) {
  const history = useHistoryStore((state) => state.history);
  const showHistory = history.length > 0 && historyOnSidebar;
  const { isMobile, setOpenMobile } = useSidebar();
  const activeView = useUiStore((state) => state.activeView);
  const closeSettings = useUiStore((state) => state.closeSettings);
  const closeSidebar = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleOpenSettings = () => {
    if (activeView === "settings") {
      closeSettings();
    } else {
      onOpenSettings();
    }
    closeSidebar();
  };

  const isSettingsPage = activeView === "settings";

  return (
    <>
      <SidebarHeader className="p-3">
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
      <SidebarContent className="space-y-3 px-3 py-2">
        {showHistory && (
          <HistoryPanel
            history={history}
            onProfileClick={() => closeSidebar()}
          />
        )}
      </SidebarContent>
      <SidebarFooter className="flex flex-col gap-3 p-3">
        <DownloadProgressPanel />
        <Button
          type="button"
          variant={isSettingsPage ? "secondary" : "outline"}
          onClick={handleOpenSettings}
          className="w-full"
        >
          {isSettingsPage ? <ArrowLeftIcon /> : <SettingsIcon />}
          {isSettingsPage ? "Back to feed" : "Settings"}
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
  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background text-foreground">
          <Sidebar>
            <SidebarInner
              uid={uid}
              isLoading={isLoading}
              onUidChange={onUidChange}
              onSubmit={onSubmit}
              onOpenSettings={onOpenSettings}
              historyOnSidebar={historyOnSidebar}
            />
          </Sidebar>

          <main className="w-full flex-1 overflow-y-auto p-4">
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
