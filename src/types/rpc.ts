export type WmPosition = "top" | "center" | "bottom";

export type DownloadProgressStatus = "downloading" | "completed" | "failed";

export interface DownloadItem {
  url: string;
  videoUrl: string | null;
}

export interface DownloadProgressPayload {
  postId: string;
  index: number;
  total: number;
  status: DownloadProgressStatus;
  url: string;
  savedPath?: string;
}
