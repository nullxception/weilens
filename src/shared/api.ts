import { invoke } from "@tauri-apps/api/core"
import type { DownloadItem } from "./rpc"
import type { GPSData } from "./gps"

export async function defaultDownloadDir(): Promise<string> {
  return invoke<string>("default_download_dir")
}

export async function chooseDownloadDir(
  startingFolder?: string
): Promise<string> {
  return invoke<string>("choose_download_dir", { startingFolder })
}

export async function downloadPost(params: {
  uid: string
  postId: string
  createdAt: string
  items: DownloadItem[]
  downloadDir?: string | undefined
  location?: GPSData | undefined
}): Promise<{ savedPaths: string[]; count: number }> {
  return invoke("download_post", params) as Promise<{
    savedPaths: string[]
    count: number
  }>
}
