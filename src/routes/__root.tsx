import { Outlet } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Suspense, useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { setUserAgent } from "@/lib/api";
import { Onboarding } from "@/onboarding/onboarding";
import { shouldShowOnboarding } from "@/onboarding/onboarding-state";
import { CookieSetupDialog } from "@/settings/cookie-setup-dialog";
import { useAuthStore } from "@/stores/useAuthStore";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { usePlacesStore } from "@/stores/usePlacesStore";
import { useSettingsStore } from "@/stores/useSettingsStore";

export function RootLayout() {
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const initStore = usePlacesStore((state) => state.initStore);
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);
  const hydrateHistory = useHistoryStore((s) => s.hydrate);

  useEffect(() => {
    initStore();
    void hydrateAuth();
    void hydrateSettings();
    void hydrateHistory();
    void setUserAgent(navigator.userAgent);
    void shouldShowOnboarding().then((show) => setShowOnboarding(show));
  }, [initStore, hydrateAuth, hydrateSettings, hydrateHistory]);

  if (showOnboarding === null) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <>
      {showOnboarding ? (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          <Onboarding onComplete={() => setShowOnboarding(false)} />
        </motion.div>
      ) : (
        <>
          <CookieSetupDialog />
          <motion.div
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
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
                <Outlet />
              </Suspense>
            </AppShell>
          </motion.div>
        </>
      )}
    </>
  );
}
