import React, { Suspense, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { invoke } from "@tauri-apps/api/core";
import { AppShell } from "./components/app-shell";
import { CookieSetupDialog } from "./settings/cookie-setup-dialog";
import { useUiStore } from "./stores/useUiStore";
import { useProfileStore } from "./stores/useProfileStore";
import { usePlacesStore } from "./stores/usePlacesStore";
import { Onboarding } from "./onboarding/onboarding";
import { isOnboardingComplete } from "./onboarding/onboarding-state";

const BlogFeed = React.lazy(() =>
  import("./feed/blog-feed").then((m) => ({ default: m.BlogFeed })),
);
const SettingsPanel = React.lazy(() =>
  import("./settings/settings-panel").then((m) => ({
    default: m.SettingsPanel,
  })),
);

function App() {
  const [showOnboarding, setShowOnboarding] = useState(
    () => !isOnboardingComplete(),
  );

  const activeView = useUiStore((state) => state.activeView);
  const setActiveView = useUiStore((state) => state.setActiveView);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  const pendingLookupUid = useUiStore((state) => state.pendingLookupUid);
  const setPendingLookupUid = useUiStore((state) => state.setPendingLookupUid);
  const setActiveUid = useUiStore((state) => state.setActiveUid);
  const initStore = usePlacesStore((state) => state.initStore);

  const checkUid = useProfileStore((state) => state.checkUid);
  const setUid = useProfileStore((state) => state.setUid);

  useEffect(() => {
    initStore();
    invoke("set_user_agent", { ua: navigator.userAgent });
  }, [initStore]);

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
        setActiveView("search");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeView, setActiveView]);

  useEffect(() => {
    if (!pendingLookupUid) return;
    setUid(pendingLookupUid);
    setActiveUid(pendingLookupUid);
    checkUid(pendingLookupUid);
    setPendingLookupUid(null);
  }, [pendingLookupUid, setActiveUid, setPendingLookupUid, setUid, checkUid]);

  return (
    <>
      <AnimatePresence>
        {showOnboarding && (
          <motion.div
            className="fixed inset-0 z-50"
            initial={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          >
            <Onboarding onComplete={() => setShowOnboarding(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {!showOnboarding && <CookieSetupDialog />}
      <motion.div
        initial={{ opacity: 0, scale: 1.02 }}
        animate={
          !showOnboarding
            ? { opacity: 1, scale: 1 }
            : { opacity: 0, scale: 1.02 }
        }
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      >
        <AppShell>
          <Suspense
            fallback={
              <div className="flex h-[20vh] w-full items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-muted border-t-primary" />
              </div>
            }
          >
            <AnimatePresence mode="wait">
              {activeView === "search" && (
                <motion.div
                  key={useUiStore.getState().activeUid || "empty"}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                >
                  <BlogFeed />
                </motion.div>
              )}
              {activeView === "settings" && (
                <motion.div
                  key="settings"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                >
                  <SettingsPanel />
                </motion.div>
              )}
            </AnimatePresence>
          </Suspense>
        </AppShell>
      </motion.div>
    </>
  );
}

export default App;
