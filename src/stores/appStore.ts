import { create } from "zustand"
import { StorageKeys } from "../shared/storageKeys"
import { invoke } from "@tauri-apps/api/core"
import type { NominatimResult } from "@/types/gps"

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
  places: Place[]
  addPlace: (place: Place) => void
  blogPlaces: BlogPlaces
  setBlogPlace: (userId: number | string, mblogid: string, place: Place) => void
  removeBlogPlace: (userId: number | string, mblogid: string) => void
  initStore: () => Promise<void>
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
    return localStorage.getItem(StorageKeys.COOKIE) ?? ""
  } catch {
    return ""
  }
}

function readDownloadLocationFromStorage() {
  try {
    return localStorage.getItem(StorageKeys.DOWNLOAD_PATH) ?? ""
  } catch {
    return ""
  }
}

function readHistoryFromStorage(): CheckedProfile[] {
  try {
    const saved = localStorage.getItem(StorageKeys.PROFILE_HISTORY)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

function readPlacesFromStorage(): Place[] {
  try {
    const recents = localStorage.getItem(StorageKeys.RECENT_PLACES)
    const recentPlaces = recents
      ? (JSON.parse(recents) as NominatimResult[])
      : []

    const saved = localStorage.getItem(StorageKeys.PLACES)
    const savedPlaces = saved ? (JSON.parse(saved) as Place[]) : []
    return [
      ...recentPlaces.map((p) => ({
        lat: p.lat,
        lon: p.lon,
        name: p.display_name,
      })),
      ...savedPlaces,
    ]
  } catch {
    return []
  }
}

function readBlogPlacesFromStorage(): BlogPlaces {
  try {
    const saved = localStorage.getItem(StorageKeys.BLOG_PLACES)
    return saved ? JSON.parse(saved) : {}
  } catch {
    return {}
  }
}

function writeHistoryToStorage(history: CheckedProfile[]) {
  try {
    localStorage.setItem(StorageKeys.PROFILE_HISTORY, JSON.stringify(history))
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
  places: readPlacesFromStorage(),
  blogPlaces: readBlogPlacesFromStorage(),
  activeUid: "",
  activeView: "search",
  pendingLookupUid: null,
  isSidebarOpen: false,
  historyOnSidebar: false,
  savedMessage: "",
  setCookie: (cookie: string) => {
    try {
      localStorage.setItem(StorageKeys.COOKIE, cookie)
    } catch (error) {
      console.error("Failed to save cookie to localStorage:", error)
    }

    set({ cookie, parsedCookie: toHttpCookieHeader(cookie) })
  },
  setDownloadLocation: (downloadLocation: string) => {
    try {
      localStorage.setItem(StorageKeys.DOWNLOAD_PATH, downloadLocation)
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
      localStorage.removeItem(StorageKeys.PROFILE_HISTORY)
    } catch (error) {
      console.error("Failed to clear history from localStorage:", error)
    }

    set({ history: [] })
  },
  addPlace: (place: Place) => {
    invoke("add_place", { place }).catch(console.error)
    set((state: AppState) => ({
      places: [place, ...state.places],
    }))
  },
  setBlogPlace: (userId: number | string, mblogid: string, place: Place) => {
    invoke("set_blog_place", {
      userId: String(userId),
      mblogid,
      place,
    }).catch(console.error)
    set((state: AppState) => {
      const key = `${userId}_${mblogid}`
      return {
        blogPlaces: { ...state.blogPlaces, [key]: place },
      }
    })
  },
  removeBlogPlace: (userId: number | string, mblogid: string) => {
    invoke("remove_blog_place", {
      userId: String(userId),
      mblogid,
    }).catch(console.error)
    set((state: AppState) => {
      const key = `${userId}_${mblogid}`
      const next = { ...state.blogPlaces }
      delete next[key]
      return { blogPlaces: next }
    })
  },
  initStore: async () => {
    try {
      const { blogPlaces, places } = await invoke<{
        blogPlaces: Record<string, Place>
        places: Place[]
      }>("list_places")

      // If SQLite is empty, check if we have data in localStorage to migrate
      if (Object.keys(blogPlaces).length === 0 && places.length === 0) {
        const localSaved = readPlacesFromStorage()
        const localBlog = readBlogPlacesFromStorage()

        if (localSaved.length > 0 || Object.keys(localBlog).length > 0) {
          // Migrate local saved places to SQLite
          for (const sp of localSaved) {
            await invoke("add_place", { place: sp })
          }
          // Migrate local blog places to SQLite
          for (const [key, bp] of Object.entries(localBlog)) {
            const idx = key.indexOf("_")
            if (idx !== -1) {
              const userId = key.substring(0, idx)
              const mblogid = key.substring(idx + 1)
              await invoke("set_blog_place", { userId, mblogid, place: bp })
            }
          }
          // Fetch again from SQLite
          const migrated = await invoke<{
            blogPlaces: Record<string, Place>
            places: Place[]
          }>("list_places")

          // Clear localStorage
          localStorage.removeItem(StorageKeys.PLACES)
          localStorage.removeItem(StorageKeys.BLOG_PLACES)

          set({
            blogPlaces: migrated.blogPlaces,
            places: migrated.places,
          })
          return
        }
      }

      set({ blogPlaces, places })
    } catch (err) {
      console.error("Failed to initialize places from SQLite:", err)
    }
  },
}))
