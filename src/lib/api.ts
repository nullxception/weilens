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
  postId: string;
  createdAt: string;
  wmPosition: WmPosition;
  items: DownloadItem[];
  downloadDir?: string | undefined;
  location?: GPSData | undefined;
}): Promise<{ savedPaths: string[]; count: number }> {
  return invoke("download_post", { request: params }) as Promise<{
    savedPaths: string[];
    count: number;
  }>;
}

export async function cancelDownloadPost(postId: string): Promise<void> {
  return invoke("cancel_download_post", { postId });
}

export async function listPlaces(payload: {
  limit: number;
  offset: number;
}): Promise<{ places: Place[]; total: number }> {
  return invoke("list_places", payload);
}

export async function searchPlace(forQuery: string): Promise<Place[]> {
  return invoke<Place[]>("search_place", { for: forQuery });
}

export async function addPlace(place: Place): Promise<void> {
  return invoke("add_place", { place });
}

export async function getPlaceByPost(
  userId: string,
  mblogid: string,
): Promise<Place> {
  return invoke<Place>("get_place_by_post", { userId, mblogid });
}

export async function setBlogPlace(
  userId: string,
  mblogid: string,
  place: Place,
): Promise<void> {
  return invoke("set_blog_place", { userId, mblogid, place });
}
