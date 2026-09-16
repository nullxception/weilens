import { create } from "zustand";

import { getSettings, saveSettings } from "@/lib/api";
import { isWebMode } from "@/lib/backend";

import { StorageKeys } from "../storage-keys";

type NetscapeCookie = {
  domain: string;
  includeSubdomains: boolean;
  path: string;
  secure: boolean;
  expires: number;
  name: string;
  value: string;
  httpOnly: boolean;
};
function parseNetscapeCookies(text: string): NetscapeCookie[] {
  const cookies: NetscapeCookie[] = [];
  for (let line of text.split("\n")) {
    if (
      !line.trim() ||
      (line.startsWith("#") && !line.startsWith("#HttpOnly_"))
    )
      continue;
    let isHttpOnly = false;
    if (line.startsWith("#HttpOnly_")) {
      line = line.replace("#HttpOnly_", "");
      isHttpOnly = true;
    }
    const fields = line.split("\t");
    if (fields.length >= 7)
      cookies.push({
        domain: fields[0].trim(),
        includeSubdomains: fields[1].trim().toUpperCase() === "TRUE",
        path: fields[2].trim(),
        secure: fields[3].trim().toUpperCase() === "TRUE",
        expires: parseInt(fields[4].trim(), 10),
        name: fields[5].trim(),
        value: fields[6].trim().replace(/\r$/, ""),
        httpOnly: isHttpOnly,
      });
  }
  return cookies;
}
export function toHttpCookieHeader(cookie: string): string {
  const isNetscapeCookie = cookie.includes("TRUE") || cookie.includes("FALSE");
  if (cookie.includes("/") && isNetscapeCookie)
    return parseNetscapeCookies(cookie)
      .filter((c) => c.domain.includes("weibo."))
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
  return cookie;
}
function readCookieFromStorage(): string {
  try {
    return localStorage.getItem(StorageKeys.COOKIE) ?? "";
  } catch {
    return "";
  }
}

interface AuthState {
  cookie: string;
  parsedCookie: string;
  savedMessage: string;
  hydrated: boolean;
  setCookie: (cookie: string) => void;
  saveCookie: () => void;
  setSavedMessage: (message: string) => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  cookie: readCookieFromStorage(),
  parsedCookie: toHttpCookieHeader(readCookieFromStorage()),
  savedMessage: "",
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const s = await getSettings();
      const serverCookie = s.cookie ?? "";
      const localCookie = readCookieFromStorage();
      if (!serverCookie && localCookie) {
        try {
          await saveSettings({ cookie: localCookie });
          try {
            localStorage.removeItem(StorageKeys.COOKIE);
          } catch {}
          set({
            cookie: localCookie,
            parsedCookie: toHttpCookieHeader(localCookie),
            hydrated: true,
          });
          return;
        } catch (e) {
          console.error("cookie migrate failed", e);
          set({
            cookie: localCookie,
            parsedCookie: toHttpCookieHeader(localCookie),
            hydrated: true,
          });
          return;
        }
      }
      if (serverCookie) {
        try {
          localStorage.removeItem(StorageKeys.COOKIE);
        } catch {}
        set({
          cookie: serverCookie,
          parsedCookie: toHttpCookieHeader(serverCookie),
          hydrated: true,
        });
        return;
      }
      set({ hydrated: true });
    } catch (e) {
      console.error("auth hydrate failed", e);
      set({ hydrated: true });
    }
  },
  setCookie: (cookie: string) => {
    void saveSettings({ cookie })
      .then(() => {
        try {
          localStorage.removeItem(StorageKeys.COOKIE);
        } catch {}
      })
      .catch((e) => console.error("saveSettings failed", e));
    if (!isWebMode) {
      try {
        localStorage.setItem(StorageKeys.COOKIE, cookie);
      } catch (e) {
        console.error("localStorage set failed", e);
      }
    }
    set({ cookie, parsedCookie: toHttpCookieHeader(cookie) });
  },
  setSavedMessage: (savedMessage: string) => set({ savedMessage }),
  saveCookie: () => {
    set({ savedMessage: "Cookie saved locally." });
    window.setTimeout(() => set({ savedMessage: "" }), 2000);
  },
}));
