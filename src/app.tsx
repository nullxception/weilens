import React, { Suspense, useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AppShell } from "./components/app-shell";
import { CookieSetupDialog } from "./settings/cookie-setup-dialog";
import { useProfileLookup } from "./hooks/use-profile-lookup";
import { useUiStore } from "./stores/useUiStore";
import { usePlacesStore } from "./stores/usePlacesStore";
import { Skeleton } from "./components/ui/skeleton";
import { Onboarding } from "./onboarding/onboarding";
import { isOnboardingComplete } from "./onboarding/onboarding-state";

const BlogFeed = React.lazy(() =>
  import("./feed/blog-feed").then((m) => ({ default: m.BlogFeed })),
);

function App() {
  const [showOnboarding, setShowOnboarding] = useState(
    () => !isOnboardingComplete(),
  );
  const {
    uid,
    setUid,
    blogs,
    activeDisplayName,
    result,
    error,
    isLoading,
    hasMore,
    checkUid,
    handleNextPage,
  } = useProfileLookup();

  const setActiveUid = useUiStore((state) => state.setActiveUid);
  const activeView = useUiStore((state) => state.activeView);
  const setActiveView = useUiStore((state) => state.setActiveView);
  const setHistoryOnSidebar = useUiStore((state) => state.setHistoryOnSidebar);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  const pendingLookupUid = useUiStore((state) => state.pendingLookupUid);
  const setPendingLookupUid = useUiStore((state) => state.setPendingLookupUid);
  const initStore = usePlacesStore((state) => state.initStore);
  const historyOnSidebar =
    blogs.length > 0 || isLoading || Boolean(error) || Boolean(result);

  useEffect(() => {
    initStore();
    invoke("set_user_agent", { ua: navigator.userAgent });
  }, [initStore]);

  useEffect(() => {
    setHistoryOnSidebar(historyOnSidebar);
  }, [historyOnSidebar, setHistoryOnSidebar]);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setSidebarOpen(false);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [setSidebarOpen]);

  const handleBackToSearch = useCallback(() => {
    setActiveView("search");
  }, [setActiveView]);

  useEffect(() => {
    if (activeView !== "settings") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleBackToSearch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeView, handleBackToSearch]);

  useEffect(() => {
    if (!pendingLookupUid) return;

    setUid(pendingLookupUid);
    setActiveUid(pendingLookupUid);
    checkUid(pendingLookupUid);
    setPendingLookupUid(null);
  }, [pendingLookupUid, setActiveUid, setPendingLookupUid, setUid, checkUid]);

  function handleCheck(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextUid = uid || "";
    setActiveView("search");
    checkUid(nextUid, 1);
  }

  return (
    <>
      {showOnboarding && (
        <Onboarding onComplete={() => setShowOnboarding(false)} />
      )}
      {!showOnboarding && <CookieSetupDialog />}
      <AppShell
        uid={uid}
        isLoading={isLoading}
        onUidChange={setUid}
        onSubmit={handleCheck}
        onOpenSettings={() => setActiveView("settings")}
        historyOnSidebar={historyOnSidebar}
      >
        <Suspense
          fallback={
            <div className="flex flex-col gap-3">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          }
        >
          {activeView === "search" && (
            <BlogFeed
              blogs={blogs}
              result={result}
              error={error}
              isLoading={isLoading}
              hasMore={hasMore}
              onLoadMore={handleNextPage}
              activeDisplayName={activeDisplayName}
            />
          )}
        </Suspense>
      </AppShell>
    </>
  );
}

export default App;
