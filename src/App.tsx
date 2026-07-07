import { useEffect, useState } from "react";
import { BlogFeed } from "./components/BlogFeed";
import { AppShell } from "./components/AppShell";
import { useWeiLookup } from "./hooks/useWeiLookup";
import { useAppStore, type AppState } from "./stores/appStore";

function App() {
  const [cookieSavedMessage, setCookieSavedMessage] = useState("");
  const {
    uid,
    setUid,
    blogs,
    activeDisplayName,
    result,
    error,
    isLoading,
    checkUid,
    handleNextPage,
  } = useWeiLookup();

  const cookie = useAppStore((state: AppState) => state.cookie);
  const setCookie = useAppStore((state: AppState) => state.setCookie);
  const downloadLocation = useAppStore((state: AppState) => state.downloadLocation);
  const setDownloadLocation = useAppStore((state: AppState) => state.setDownloadLocation);
  const history = useAppStore((state: AppState) => state.history);
  const activeView = useAppStore((state: AppState) => state.activeView);
  const setActiveView = useAppStore((state: AppState) => state.setActiveView);
  const setSidebarOpen = useAppStore((state: AppState) => state.setSidebarOpen);
  const removeFromHistory = useAppStore((state: AppState) => state.removeFromHistory);
  const clearHistory = useAppStore((state: AppState) => state.clearHistory);
  const historyOnSidebar =
    blogs.length > 0 || isLoading || Boolean(error) || Boolean(result);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setSidebarOpen(false);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [setSidebarOpen]);

  useEffect(() => {
    if (activeView !== "settings") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleBackToSearch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeView]);

  function handleCheck(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActiveView("search");
    checkUid(uid || "", 1);
  }

  function handleHistoryClick(profileUid: string) {
    setUid(profileUid);
    setActiveView("search");
    checkUid(profileUid);
  }

  function handleSaveCookie() {
    setCookieSavedMessage("Cookie saved locally.");
    setTimeout(() => setCookieSavedMessage(""), 2000);
  }

  function handleBackToSearch() {
    setActiveView("search");
  }

  return (
    <AppShell
      uid={uid}
      isLoading={isLoading}
      onUidChange={setUid}
      onSubmit={handleCheck}
      onHistoryClick={handleHistoryClick}
      onRemoveFromHistory={removeFromHistory}
      onClearHistory={clearHistory}
      onOpenSettings={() => setActiveView("settings")}
      onCloseSidebar={() => setSidebarOpen(false)}
      activeView={activeView}
      cookie={cookie}
      onCookieChange={setCookie}
      downloadLocation={downloadLocation}
      onDownloadLocationChange={setDownloadLocation}
      onSaveCookie={handleSaveCookie}
      onBackToSearch={handleBackToSearch}
      savedMessage={cookieSavedMessage}
      history={history}
      historyOnSidebar={historyOnSidebar}
    >
      <BlogFeed
        blogs={blogs}
        result={result}
        error={error}
        isLoading={isLoading}
        onLoadMore={handleNextPage}
        history={history}
        activeUid={uid}
        activeDisplayName={activeDisplayName}
        onHistoryClick={handleHistoryClick}
        onRemoveFromHistory={removeFromHistory}
        onClearHistory={clearHistory}
      />
    </AppShell>
  );
}

export default App;
