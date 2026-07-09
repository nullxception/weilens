import { create } from "zustand"
import type { NominatimResult } from "../types/gps"

export interface Place {
  lat: number
  lon: number
  name: string
}

export type BlogPlaces = Record<string, Place>

export interface CheckedProfile {
  uid: string
  screenName: string
  profileImageUrl: string
  timestamp: number
}

export interface PostDownloadState {
  postId: string
  total: number
  completed: number
  failed: number
  items: Record<number, "downloading" | "completed" | "failed">
}

export interface AppState {
  /** Raw cookie string as entered by the user. */
  cookie: string
  /**
   * Cookie ready to use as an HTTP header value.
   * Netscape/cookie-jar format is automatically converted to
   * `name=value; name2=value2` on store write.
   */
  parsedCookie: string
  downloadLocation: string
  history: CheckedProfile[]
  activeUid: string
  activeView: "search" | "settings"
  pendingLookupUid: string | null
  isSidebarOpen: boolean
  historyOnSidebar: boolean
  savedMessage: string
  setCookie: (cookie: string) => void
  setActiveUid: (uid: string) => void
  setDownloadLocation: (downloadLocation: string) => void
  setActiveView: (view: "search" | "settings") => void
  setPendingLookupUid: (uid: string | null) => void
  setSidebarOpen: (isOpen: boolean) => void
  setHistoryOnSidebar: (value: boolean) => void
  setSavedMessage: (message: string) => void
  saveCookie: () => void
  closeSettings: () => void
  openHistoryProfile: (uid: string) => void
  toggleSidebar: () => void
  addToHistory: (
    uid: string,
    screenName: string,
    profileImageUrl: string
  ) => void
  removeFromHistory: (uid: string) => void
  clearHistory: () => void
  downloads: Record<string, PostDownloadState>
  startDownload: (postId: string, total: number) => void
  updateDownloadProgress: (
    postId: string,
    index: number,
    status: "downloading" | "completed" | "failed"
  ) => void
  clearDownload: (postId: string) => void
  clearDownloads: () => void
  recentPlaces: NominatimResult[]
  addRecentPlace: (place: NominatimResult) => void
  removeRecentPlace: (index: number) => void
  clearRecentPlaces: () => void
  savedPlaces: Place[]
  addSavedPlace: (place: Place) => void
  removeSavedPlace: (index: number) => void
  blogPlaces: BlogPlaces
  setBlogPlace: (userId: number | string, mblogid: string, place: Place) => void
  removeBlogPlace: (userId: number | string, mblogid: string) => void
}

type NetscapeCookie = {
  domain: string
  includeSubdomains: boolean
  path: string
  secure: boolean
  expires: number
  name: string
  value: string
  httpOnly: boolean
}

function parseNetscapeCookies(text: string): NetscapeCookie[] {
  const cookies: NetscapeCookie[] = []

  for (let line of text.split("\n")) {
    if (
      !line.trim() ||
      (line.startsWith("#") && !line.startsWith("#HttpOnly_"))
    ) {
      continue
    }

    let isHttpOnly = false
    if (line.startsWith("#HttpOnly_")) {
      line = line.replace("#HttpOnly_", "")
      isHttpOnly = true
    }

    const fields = line.split("\t")
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
      })
    }
  }

  return cookies
}

/**
 * Converts a Netscape/cookie-jar format string to a plain `name=value; ...`
 * HTTP header string. If the input is already in plain format it is returned
 * unchanged.
 */
export function toHttpCookieHeader(cookie: string): string {
  const isNetscapeCookie = cookie.includes("TRUE") || cookie.includes("FALSE")
  if (cookie.includes("/") && isNetscapeCookie) {
    return parseNetscapeCookies(cookie)
      .filter((c) => c.domain.includes("weibo."))
      .map((c) => `${c.name}=${c.value}`)
      .join("; ")
  }
  return cookie
}

function readCookieFromStorage() {
  try {
    return localStorage.getItem("wei_cookie") ?? ""
  } catch {
    return ""
  }
}

function readDownloadLocationFromStorage() {
  try {
    return localStorage.getItem("wei_download_location") ?? ""
  } catch {
    return ""
  }
}

function readHistoryFromStorage(): CheckedProfile[] {
  try {
    const saved = localStorage.getItem("wei_profile_history")
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

function readRecentPlacesFromStorage(): NominatimResult[] {
  try {
    const saved = localStorage.getItem("wei_recent_places")
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

function writeRecentPlacesToStorage(places: NominatimResult[]) {
  try {
    localStorage.setItem("wei_recent_places", JSON.stringify(places))
  } catch (error) {
    console.error("Failed to save recent places to localStorage:", error)
  }
}

function readSavedPlacesFromStorage(): Place[] {
  try {
    const saved = localStorage.getItem("wei_places")
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

function writeSavedPlacesToStorage(places: Place[]) {
  try {
    localStorage.setItem("wei_places", JSON.stringify(places))
  } catch (error) {
    console.error("Failed to save places to localStorage:", error)
  }
}

function readBlogPlacesFromStorage(): BlogPlaces {
  try {
    const saved = localStorage.getItem("wei_blog_places")
    return saved ? JSON.parse(saved) : {}
  } catch {
    return {}
  }
}

function writeBlogPlacesToStorage(places: BlogPlaces) {
  try {
    localStorage.setItem("wei_blog_places", JSON.stringify(places))
  } catch (error) {
    console.error("Failed to save blog places to localStorage:", error)
  }
}

function writeHistoryToStorage(history: CheckedProfile[]) {
  try {
    localStorage.setItem("wei_profile_history", JSON.stringify(history))
  } catch (error) {
    console.error("Failed to save history to localStorage:", error)
  }
}

export const useAppStore = create<AppState>((set) => ({
  cookie: readCookieFromStorage(),
  parsedCookie: toHttpCookieHeader(readCookieFromStorage()),
  downloadLocation: readDownloadLocationFromStorage(),
  history: readHistoryFromStorage(),
  downloads: {},
  startDownload: (postId: string, total: number) =>
    set((state: AppState) => {
      const items: Record<number, "downloading" | "completed" | "failed"> = {}
      for (let i = 0; i < total; i++) {
        items[i] = "downloading"
      }
      return {
        downloads: {
          ...state.downloads,
          [postId]: {
            postId,
            total,
            completed: 0,
            failed: 0,
            items,
          },
        },
      }
    }),
  updateDownloadProgress: (
    postId: string,
    index: number,
    status: "downloading" | "completed" | "failed"
  ) =>
    set((state: AppState) => {
      const postDownload = state.downloads[postId]
      if (!postDownload) return {}

      const items = { ...postDownload.items, [index]: status }
      let completed = 0
      let failed = 0
      Object.values(items).forEach((s) => {
        if (s === "completed") completed++
        if (s === "failed") failed++
      })

      return {
        downloads: {
          ...state.downloads,
          [postId]: {
            ...postDownload,
            completed,
            failed,
            items,
          },
        },
      }
    }),
  clearDownload: (postId: string) =>
    set((state: AppState) => {
      const next = { ...state.downloads }
      delete next[postId]
      return { downloads: next }
    }),
  clearDownloads: () => set({ downloads: {} }),
  recentPlaces: readRecentPlacesFromStorage(),
  savedPlaces: readSavedPlacesFromStorage(),
  blogPlaces: readBlogPlacesFromStorage(),
  activeUid: "",
  activeView: "search",
  pendingLookupUid: null,
  isSidebarOpen: false,
  historyOnSidebar: false,
  savedMessage: "",
  setCookie: (cookie: string) => {
    try {
      localStorage.setItem("wei_cookie", cookie)
    } catch (error) {
      console.error("Failed to save cookie to localStorage:", error)
    }

    set({ cookie, parsedCookie: toHttpCookieHeader(cookie) })
  },
  setDownloadLocation: (downloadLocation: string) => {
    try {
      localStorage.setItem("wei_download_location", downloadLocation)
    } catch (error) {
      console.error("Failed to save download location to localStorage:", error)
    }

    set({ downloadLocation })
  },
  setActiveUid: (activeUid: string) => set({ activeUid }),
  setActiveView: (activeView: "search" | "settings") => set({ activeView }),
  setPendingLookupUid: (pendingLookupUid: string | null) =>
    set({ pendingLookupUid }),
  setSidebarOpen: (isSidebarOpen: boolean) => set({ isSidebarOpen }),
  setHistoryOnSidebar: (historyOnSidebar: boolean) => set({ historyOnSidebar }),
  setSavedMessage: (savedMessage: string) => set({ savedMessage }),
  saveCookie: () => {
    set({ savedMessage: "Cookie saved locally." })
    window.setTimeout(() => set({ savedMessage: "" }), 2000)
  },
  closeSettings: () => set({ activeView: "search" }),
  openHistoryProfile: (uid: string) =>
    set((state: AppState) => ({
      activeUid: uid,
      activeView: "search",
      pendingLookupUid: uid,
      history: state.history,
    })),
  toggleSidebar: () =>
    set((state: AppState) => ({ isSidebarOpen: !state.isSidebarOpen })),
  addToHistory: (uid: string, screenName: string, profileImageUrl: string) =>
    set((state: AppState) => {
      const filtered = state.history.filter((item) => item.uid !== uid)
      const nextHistory = [
        {
          uid,
          screenName,
          profileImageUrl,
          timestamp: Date.now(),
        },
        ...filtered,
      ]

      writeHistoryToStorage(nextHistory)

      return { history: nextHistory }
    }),
  removeFromHistory: (uid: string) =>
    set((state: AppState) => {
      const nextHistory = state.history.filter((item) => item.uid !== uid)
      writeHistoryToStorage(nextHistory)

      return { history: nextHistory }
    }),
  clearHistory: () => {
    try {
      localStorage.removeItem("wei_profile_history")
    } catch (error) {
      console.error("Failed to clear history from localStorage:", error)
    }

    set({ history: [] })
  },
  addRecentPlace: (place: NominatimResult) =>
    set((state: AppState) => {
      // dedupe by lat+lon+display_name
      const key = `${place.lat}_${place.lon}_${place.display_name}`
      const filtered = state.recentPlaces.filter(
        (p: NominatimResult) => `${p.lat}_${p.lon}_${p.display_name}` !== key
      )
      const next = [place, ...filtered]
      writeRecentPlacesToStorage(next)
      return { recentPlaces: next }
    }),
  removeRecentPlace: (index: number) =>
    set((state: AppState) => {
      const next = state.recentPlaces.filter(
        (_: unknown, i: number) => i !== index
      )
      writeRecentPlacesToStorage(next)
      return { recentPlaces: next }
    }),
  clearRecentPlaces: () => {
    try {
      localStorage.removeItem("wei_recent_places")
    } catch (error) {
      console.error("Failed to clear recent places:", error)
    }
    set({ recentPlaces: [] })
  },
  addSavedPlace: (place: Place) =>
    set((state: AppState) => {
      const next = [place, ...state.savedPlaces]
      writeSavedPlacesToStorage(next)
      return { savedPlaces: next }
    }),
  removeSavedPlace: (index: number) =>
    set((state: AppState) => {
      const next = state.savedPlaces.filter(
        (_: unknown, i: number) => i !== index
      )
      writeSavedPlacesToStorage(next)
      return { savedPlaces: next }
    }),
  setBlogPlace: (userId: number | string, mblogid: string, place: Place) =>
    set((state: AppState) => {
      const key = `${userId}_${mblogid}`
      const next = { ...state.blogPlaces, [key]: place }
      writeBlogPlacesToStorage(next)
      return { blogPlaces: next }
    }),
  removeBlogPlace: (userId: number | string, mblogid: string) =>
    set((state: AppState) => {
      const key = `${userId}_${mblogid}`
      const next = { ...state.blogPlaces }
      delete next[key]
      writeBlogPlacesToStorage(next)
      return { blogPlaces: next }
    }),
}))
