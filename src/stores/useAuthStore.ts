import { create } from "zustand";
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
    ) {
      continue;
    }

    let isHttpOnly = false;
    if (line.startsWith("#HttpOnly_")) {
      line = line.replace("#HttpOnly_", "");
      isHttpOnly = true;
    }

    const fields = line.split("\t");
    if (fields.length >= 7) {
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
  }

  return cookies;
}

/**
 * Converts a Netscape/cookie-jar format string to a plain `name=value; ...`
 * HTTP header string. If the input is already in plain format it is returned
 * unchanged.
 */
export function toHttpCookieHeader(cookie: string): string {
  const isNetscapeCookie = cookie.includes("TRUE") || cookie.includes("FALSE");
  if (cookie.includes("/") && isNetscapeCookie) {
    return parseNetscapeCookies(cookie)
      .filter((c) => c.domain.includes("weibo."))
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
  }
  return cookie;
}

function readCookieFromStorage() {
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
  setCookie: (cookie: string) => void;
  saveCookie: () => void;
  setSavedMessage: (message: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  cookie: readCookieFromStorage(),
  parsedCookie: toHttpCookieHeader(readCookieFromStorage()),
  savedMessage: "",
  setCookie: (cookie: string) => {
    try {
      localStorage.setItem(StorageKeys.COOKIE, cookie);
    } catch (error) {
      console.error("Failed to save cookie to localStorage:", error);
    }
    set({ cookie, parsedCookie: toHttpCookieHeader(cookie) });
  },
  setSavedMessage: (savedMessage: string) => set({ savedMessage }),
  saveCookie: () => {
    set({ savedMessage: "Cookie saved locally." });
    window.setTimeout(() => set({ savedMessage: "" }), 2000);
  },
}));
