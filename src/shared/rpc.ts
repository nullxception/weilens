import type { GPSData } from "./gps";

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

export type AppRPC = {
  bun: {
    requests: {
      fetch: {
        params: {
          url: string;
          input?: RequestInit;
        };
        response: {
          status: number;
          statusText: string;
          body: string;
        };
      };
      chooseDownloadFolder: {
        params: {
          startingFolder?: string;
        };
        response: string;
      };
      downloadPost: {
        params: {
          uid: string;
          postId: string;
          createdAt: string;
          items: DownloadItem[];
          downloadDir?: string;
          location?: GPSData;
        };
        response: {
          savedPaths: string[];
          count: number;
        };
      };
    };
    messages: {};
  };
  webview: {
    requests: {};
    messages: {
      downloadProgress: DownloadProgressPayload;
    };
  };
};
