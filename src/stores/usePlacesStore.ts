import { create } from "zustand";
import { StorageKeys } from "../storage-keys";
import { NominatimResultSchema, PlaceSchema, type Place } from "@/types/gps";
import { addPlace, listPlaces, setBlogPlace } from "@/lib/api";

function readPlacesFromStorage(): Place[] {
  try {
    const recents = localStorage.getItem(StorageKeys.RECENT_PLACES);
    const recentPlaces = recents
      ? NominatimResultSchema.array().parse(JSON.parse(recents))
      : [];

    const saved = localStorage.getItem(StorageKeys.PLACES);
    const savedPlaces = saved
      ? PlaceSchema.array().parse(JSON.parse(saved))
      : [];
    return [
      ...recentPlaces.map((p) => ({
        lat: p.lat,
        lon: p.lon,
        name: p.display_name,
      })),
      ...savedPlaces,
    ];
  } catch {
    return [];
  }
}

function readBlogPlacesFromStorage(): Record<string, Place> {
  try {
    const saved = localStorage.getItem(StorageKeys.BLOG_PLACES);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

interface PlacesState {
  initStore: () => Promise<void>;
}

export const usePlacesStore = create<PlacesState>(() => ({
  initStore: async () => {
    try {
      const { total } = await listPlaces({ limit: 10, offset: 0 });

      // If SQLite is empty, check if we have data in localStorage to migrate
      if (total === 0) {
        const localSaved = readPlacesFromStorage();
        const localBlog = readBlogPlacesFromStorage();

        if (localSaved.length > 0 || Object.keys(localBlog).length > 0) {
          // Migrate local saved places to SQLite
          for (const sp of localSaved) {
            await addPlace(sp);
          }
          // Migrate local blog places to SQLite
          for (const [key, bp] of Object.entries(localBlog)) {
            const idx = key.indexOf("_");
            if (idx !== -1) {
              const userId = key.substring(0, idx);
              const mblogid = key.substring(idx + 1);
              await setBlogPlace(userId, mblogid, bp);
            }
          }
          // Clear localStorage
          localStorage.removeItem(StorageKeys.PLACES);
          localStorage.removeItem(StorageKeys.BLOG_PLACES);
          return;
        }
      }
    } catch (err) {
      console.error("Failed to initialize places from SQLite:", err);
    }
  },
}));
