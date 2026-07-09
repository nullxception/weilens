export const StorageKeys = {
  COOKIE: "wei_cookie",
  DOWNLOAD_PATH: "download_path",
  PROFILE_HISTORY: "profile_history",
  RECENT_PLACES: "recent_places",
  PLACES: "places",
  BLOG_PLACES: "blog_places",
  THEME: "vite-ui-theme",
} as const

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys]
