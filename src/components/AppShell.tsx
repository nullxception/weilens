import type { FormEvent, ReactNode } from "react"
import { HistoryPanel } from "./HistoryPanel"
import { SearchForm } from "./SearchForm"
import { SettingsModal } from "./SettingsModal"
import { Button } from "./ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "./ui/sidebar"
import { TooltipProvider } from "./ui/tooltip"
import { SettingsIcon } from "lucide-react"
import { DownloadProgressPanel } from "./DownloadProgressPanel"

interface AppShellProps {
  uid: string
  isLoading: boolean
  onUidChange: (uid: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onHistoryClick: (uid: string) => void
  onRemoveFromHistory: (uid: string) => void
  onClearHistory: () => void
  onOpenSettings: () => void
  onCloseSidebar: () => void
  activeView: "search" | "settings"
  cookie: string
  onCookieChange: (value: string) => void
  downloadLocation: string
  onDownloadLocationChange: (value: string) => void
  onSaveCookie: () => void
  onBackToSearch: () => void
  savedMessage: string
  history: {
    uid: string
    screenName: string
    profileImageUrl: string
    timestamp: number
  }[]
  historyOnSidebar: boolean
  children: ReactNode
}

function SidebarInner({
  uid,
  isLoading,
  onUidChange,
  onSubmit,
  onOpenSettings,
  showHistory,
  history,
  onHistoryClick,
  onRemoveFromHistory,
  onClearHistory,
}: {
  uid: string
  isLoading: boolean
  onUidChange: (uid: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onOpenSettings: () => void
  showHistory: boolean
  history: AppShellProps["history"]
  onHistoryClick: (uid: string) => void
  onRemoveFromHistory: (uid: string) => void
  onClearHistory: () => void
}) {
  const { isMobile, setOpenMobile } = useSidebar()
  const closeSidebar = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <>
      <SidebarHeader className="p-4">
        <SearchForm
          uid={uid}
          isLoading={isLoading}
          onUidChange={onUidChange}
          onSubmit={(event) => {
            onSubmit(event)
            closeSidebar()
          }}
        />
      </SidebarHeader>
      <SidebarContent className="space-y-4 px-4 py-2">
        {showHistory && (
          <HistoryPanel
            history={history}
            activeUid={uid}
            onProfileClick={(profileUid) => {
              onHistoryClick(profileUid)
              closeSidebar()
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
          onClick={() => {
            onOpenSettings()
            closeSidebar()
          }}
          className="w-full"
        >
          <SettingsIcon />
          Settings
        </Button>
      </SidebarFooter>
    </>
  )
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
  const showHistory = history.length > 0 && historyOnSidebar

  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background text-foreground">
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

          <Sidebar>
            <SidebarInner
              uid={uid}
              isLoading={isLoading}
              onUidChange={onUidChange}
              onSubmit={onSubmit}
              onOpenSettings={onOpenSettings}
              showHistory={showHistory}
              history={history}
              onHistoryClick={onHistoryClick}
              onRemoveFromHistory={onRemoveFromHistory}
              onClearHistory={onClearHistory}
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
  )
}
