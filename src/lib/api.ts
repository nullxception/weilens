import { invoke } from "@tauri-apps/api/core";
import type { DownloadItem, WmPosition } from "../types/rpc";
import type { GPSData, Place } from "../types/gps";

export async function defaultDownloadDir(): Promise<string> {
  return invoke<string>("default_download_dir");
}

export async function chooseDownloadDir(
  startingFolder?: string,
): Promise<string> {
  return invoke<string>("choose_download_dir", { startingFolder });
}

export async function downloadPost(params: {
  uid: string;
  blogId: string;
  date: string;
  dewatermark: WmPosition;
  items: DownloadItem[];
  target?: string | undefined;
  gps?: GPSData | undefined;
}): Promise<{ savedPaths: string[]; count: number }> {
  return invoke("download_post", { request: params }) as Promise<{
    savedPaths: string[];
    count: number;
  }>;
}

export async function cancelDownloadPost(blogId: string): Promise<void> {
  return invoke("cancel_download_post", { blogId });
}

export async function listPlaces(payload: {
  limit: number;
  offset: number;
}): Promise<{ places: Place[]; total: number }> {
  return invoke("list_places", payload);
}

export async function searchPlace(query: string): Promise<Place[]> {
  return invoke<Place[]>("search_place", { query });
}

export async function addPlace(place: Place): Promise<void> {
  return invoke("add_place", { place });
}

export async function getPlaceByPost(
  uid: string,
  blogId: string,
): Promise<Place> {
  return invoke<Place>("get_place_by_post", { uid, blogId });
}

export async function setBlogPlace(
  uid: string,
  blogId: string,
  place: Place,
): Promise<void> {
  return invoke("set_blog_place", { uid, blogId, place });
}
