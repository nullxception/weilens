import {
  CheckCircleIcon,
  SpinnerIcon,
  StopCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { useEffect } from "react";

import type { DownloadProgressPayload } from "@/types/rpc";

import { cancelDownloadPost } from "@/lib/api";
import { isWebMode } from "@/lib/backend";
import { useDownloadsStore } from "@/stores/useDownloadsStore";

import { Button } from "./ui/button";
import { Progress } from "./ui/progress";

function handlePayload(payload: DownloadProgressPayload) {
  const { updateDownloadProgress } = useDownloadsStore.getState();
  updateDownloadProgress(payload.postId, payload.index, payload.status);
  const updated = useDownloadsStore.getState().downloads[payload.postId];
  if (updated) {
    const allFinished =
      updated.completed + updated.failed + updated.cancelled === updated.total;
    if (allFinished)
      setTimeout(
        () => useDownloadsStore.getState().clearDownload(payload.postId),
        600,
      );
  }
}

export function DownloadProgressPanel() {
  const downloads = useDownloadsStore((state) => state.downloads);
  const updateDownloadProgress = useDownloadsStore(
    (state) => state.updateDownloadProgress,
  );

  useEffect(() => {
    if (isWebMode) {
      const es = new EventSource("/api/download/events");
      es.onmessage = (ev) => {
        try {
          handlePayload(JSON.parse(ev.data) as DownloadProgressPayload);
        } catch {}
      };
      return () => es.close();
    }
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/event").then(({ listen }) => {
      void listen<DownloadProgressPayload>("download-progress", (ev) => {
        updateDownloadProgress(
          ev.payload.postId,
          ev.payload.index,
          ev.payload.status,
        );
        const updated =
          useDownloadsStore.getState().downloads[ev.payload.postId];
        if (updated) {
          const allFinished =
            updated.completed + updated.failed + updated.cancelled ===
            updated.total;
          if (allFinished)
            setTimeout(
              () =>
                useDownloadsStore.getState().clearDownload(ev.payload.postId),
              600,
            );
        }
      }).then((fn) => {
        unlisten = fn;
      });
    });
    return () => {
      if (unlisten) unlisten();
    };
  }, [updateDownloadProgress]);

  const entries = Object.values(downloads);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
        Downloads
      </span>
      {entries.map((d) => {
        const finished = d.completed + d.failed + d.cancelled;
        const percent =
          d.total > 0 ? Math.round((finished / d.total) * 100) : 0;
        const isAllDone = finished === d.total;
        const hasError = d.failed > 0;
        const isCancelled = d.cancelled > 0;
        const isDownloading = !isAllDone && !isCancelled;
        return (
          <div
            key={d.postId}
            className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-2"
          >
            <div className="flex items-center justify-between gap-1">
              <div className="flex min-w-0 items-center gap-1.5">
                {isAllDone ? (
                  hasError ? (
                    <XCircleIcon className="h-3.5 w-3.5 shrink-0 text-destructive" />
                  ) : (
                    <CheckCircleIcon className="h-3.5 w-3.5 shrink-0 text-green-500" />
                  )
                ) : isCancelled ? (
                  <StopCircleIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <SpinnerIcon className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                )}
                <span className="truncate text-[11px] font-medium text-foreground">
                  Post …{d.postId.slice(-6)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {finished}/{d.total}
                </span>
                {isDownloading && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                    onClick={() => void cancelDownloadPost(d.postId)}
                  >
                    <XCircleIcon className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
            <Progress value={percent} />
            {hasError && (
              <span className="text-[10px] text-destructive">
                {d.failed} failed · {d.completed} saved
              </span>
            )}
            {isCancelled && !hasError && (
              <span className="text-[10px] text-muted-foreground">
                Cancelled · {d.completed} saved
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
