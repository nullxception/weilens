import { useEffect } from "react"
import { BlogFeed } from "./components/BlogFeed"
import { AppShell } from "./components/AppShell"
import { useWeiLookup } from "./hooks/useWeiLookup"
import { useAppStore, type AppState } from "./stores/appStore"

function App() {
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
  } = useWeiLookup()

  const setActiveUid = useAppStore((state: AppState) => state.setActiveUid)
  const activeView = useAppStore((state: AppState) => state.activeView)
  const setActiveView = useAppStore((state: AppState) => state.setActiveView)
  const setHistoryOnSidebar = useAppStore(
    (state: AppState) => state.setHistoryOnSidebar
  )
  const setSidebarOpen = useAppStore((state: AppState) => state.setSidebarOpen)
  const pendingLookupUid = useAppStore(
    (state: AppState) => state.pendingLookupUid
  )
  const setPendingLookupUid = useAppStore(
    (state: AppState) => state.setPendingLookupUid
  )
  const historyOnSidebar =
    blogs.length > 0 || isLoading || Boolean(error) || Boolean(result)

  useEffect(() => {
    setHistoryOnSidebar(historyOnSidebar)
  }, [historyOnSidebar, setHistoryOnSidebar])

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)")
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setSidebarOpen(false)
    }
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [setSidebarOpen])

  useEffect(() => {
    if (activeView !== "settings") return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleBackToSearch()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeView])

  useEffect(() => {
    if (!pendingLookupUid) return

    setUid(pendingLookupUid)
    setActiveUid(pendingLookupUid)
    checkUid(pendingLookupUid)
    setPendingLookupUid(null)
  }, [pendingLookupUid, setActiveUid, setPendingLookupUid, setUid, checkUid])

  function handleCheck(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextUid = uid || ""
    setActiveView("search")
    checkUid(nextUid, 1)
  }

  function handleBackToSearch() {
    setActiveView("search")
  }

  return (
    <AppShell
      uid={uid}
      isLoading={isLoading}
      onUidChange={setUid}
      onSubmit={handleCheck}
      onOpenSettings={() => setActiveView("settings")}
      historyOnSidebar={historyOnSidebar}
    >
      <BlogFeed
        blogs={blogs}
        result={result}
        error={error}
        isLoading={isLoading}
        onLoadMore={handleNextPage}
        activeDisplayName={activeDisplayName}
      />
    </AppShell>
  )
}

export default App
