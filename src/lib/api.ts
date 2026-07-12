import { invoke } from "@tauri-apps/api/core";
import type { DownloadItem, WmPosition } from "../types/rpc";
import type { GPSData } from "../types/gps";

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
  items: DownloadItem[];
  downloadDir?: string | undefined;
  location?: GPSData | undefined;
  wmPosition: WmPosition;
}): Promise<{ savedPaths: string[]; count: number }> {
  return invoke("download_post", params) as Promise<{
    savedPaths: string[];
    count: number;
  }>;
}

export async function cancelDownloadPost(postId: string): Promise<void> {
  return invoke("cancel_download_post", { postId });
}
