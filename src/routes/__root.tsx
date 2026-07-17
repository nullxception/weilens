import { Suspense, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Outlet } from "@tanstack/react-router";
import { invoke } from "@tauri-apps/api/core";
import { AppShell } from "@/components/app-shell";
import { CookieSetupDialog } from "@/settings/cookie-setup-dialog";
import { Onboarding } from "@/onboarding/onboarding";
import { isOnboardingComplete } from "@/onboarding/onboarding-state";
import { usePlacesStore } from "@/stores/usePlacesStore";

export function RootLayout() {
  const [showOnboarding, setShowOnboarding] = useState(
    () => !isOnboardingComplete(),
  );
  const initStore = usePlacesStore((state) => state.initStore);

  useEffect(() => {
    initStore();
    invoke("set_user_agent", { ua: navigator.userAgent });
  }, [initStore]);

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
