import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import type { UnlistenFn } from "@tauri-apps/api/event"
import type { DownloadItem, DownloadProgressPayload } from "./rpc"
import type { GPSData } from "./gps"

export async function chooseDownloadFolder(
  startingFolder?: string
): Promise<string> {
  return invoke<string>("choose_download_folder", { startingFolder })
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

export async function onDownloadProgress(
  cb: (payload: DownloadProgressPayload) => void
): Promise<UnlistenFn> {
  const unlisten = await listen<DownloadProgressPayload>(
    "download-progress",
    (event) => {
      cb(event.payload)
    }
  )
  return unlisten
}
