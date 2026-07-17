import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
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
import { ArrowLeft, Gear } from "@phosphor-icons/react";
import { DownloadProgressPanel } from "./download-progress-panel";
import { useProfileStore } from "../stores/useProfileStore";
import { useLocation } from "@tanstack/react-router";

function SidebarInner() {
  const { isMobile, setOpenMobile } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const isSettingsPage = location.pathname === "/settings";

  const blogs = useProfileStore((state) => state.blogs);
  const isLoading = useProfileStore((state) => state.isLoading);
  const error = useProfileStore((state) => state.error);
  const result = useProfileStore((state) => state.result);

  const hasActiveData =
    blogs.length > 0 || isLoading || Boolean(error) || Boolean(result);

  const closeSidebar = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleNavigateSettings = () => {
    if (isSettingsPage) {
      navigate({ to: "/" });
    } else {
      navigate({ to: "/settings" });
    }
    closeSidebar();
  };

  return (
    <>
      <SidebarHeader className="p-3">
        <SearchForm />
      </SidebarHeader>
      <SidebarContent className="space-y-3 px-3 py-2">
        {hasActiveData && (
          <HistoryPanel onProfileClick={() => closeSidebar()} />
        )}
      </SidebarContent>
      <SidebarFooter className="flex flex-col gap-3 p-3">
        <DownloadProgressPanel />
        <Button
          type="button"
          variant={isSettingsPage ? "secondary" : "outline"}
          onClick={handleNavigateSettings}
          className="w-full"
        >
          {isSettingsPage ? <ArrowLeft /> : <Gear />}
          {isSettingsPage ? "Back to feed" : "Settings"}
        </Button>
      </SidebarFooter>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background text-foreground">
          <Sidebar>
            <SidebarInner />
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
