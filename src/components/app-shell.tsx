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
import { useUiStore } from "../stores/useUiStore";
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

function MainHeader() {
  const blogs = useProfileStore((state) => state.blogs);
  const activeUid = useUiStore((state) => state.activeUid);
  const showReposted = useUiStore((state) => state.showReposted);
  const setShowReposted = useUiStore((state) => state.setShowReposted);

  const repostCount = blogs.filter((blog) => {
    const authorId = blog.user?.idstr;
    return Boolean(authorId && authorId !== activeUid);
  }).length;

  const showFeedControls = blogs.length > 0;

  return (
    <div className="sticky top-0 z-10 mb-4 flex items-center gap-2 bg-background/90 p-2 backdrop-blur-md">
      <SidebarTrigger />
      {showFeedControls && (
        <div className="ml-auto flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {showReposted
              ? `${blogs.length} posts`
              : `${blogs.length - repostCount} of ${blogs.length} posts`}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowReposted(!showReposted)}
            disabled={repostCount === 0}
          >
            {showReposted ? "Hide reposts" : "Show reposts"}
          </Button>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
          <Sidebar>
            <SidebarInner />
          </Sidebar>

          <main className="w-full flex-1 overflow-y-auto">
            <MainHeader />
            {children}
          </main>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
