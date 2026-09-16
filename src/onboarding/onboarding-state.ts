import { getSettings, saveSettings } from "@/lib/api";

import { StorageKeys } from "../storage-keys";

const STORAGE_KEY = StorageKeys.ONBOARDING_COMPLETE;
export function isOnboardingComplete(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}
export function markOnboardingComplete(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {}
  void saveSettings({ onboardingDismissed: "true" })
    .then(() => {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    })
    .catch((e) => console.error("onboarding save failed", e));
}
export async function shouldShowOnboarding(): Promise<boolean> {
  try {
    const s = await getSettings();
    if (s.onboardingDismissed === "true") return false;
    if (s.cookie) return false;
    const localDone = isOnboardingComplete();
    if (localDone) {
      try {
        await saveSettings({ onboardingDismissed: "true" });
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {}
      } catch (e) {
        console.error("onboarding migrate failed", e);
      }
      return false;
    }
    return true;
  } catch (e) {
    console.error("shouldShowOnboarding failed", e);
    return !isOnboardingComplete();
  }
}
export async function dismissOnboarding(): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {}
  try {
    await saveSettings({ onboardingDismissed: "true" });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  } catch {}
}
