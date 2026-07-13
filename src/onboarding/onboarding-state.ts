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
  } catch {
    // storage unavailable — let them through anyway
  }
}
