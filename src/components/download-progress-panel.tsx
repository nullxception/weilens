import { useDownloadsStore } from "@/stores/useDownloadsStore";
import { CheckCircle2, XCircle, Loader2, StopCircle } from "lucide-react";
import { Progress } from "./ui/progress";
import { Button } from "./ui/button";
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import type { DownloadProgressPayload } from "@/types/rpc";
import { cancelDownloadPost } from "@/lib/api";

export function DownloadProgressPanel() {
  const downloads = useDownloadsStore((state) => state.downloads);
  const updateDownloadProgress = useDownloadsStore(
    (state) => state.updateDownloadProgress,
  );

  useEffect(() => {
    const unlistenPromise = listen<DownloadProgressPayload>(
      "download-progress",
      (ev) => {
        updateDownloadProgress(
          ev.payload.postId,
          ev.payload.index,
          ev.payload.status,
        );

        // Auto-clear after all items finish
        const updatedProgress =
          useDownloadsStore.getState().downloads[ev.payload.postId];
        if (updatedProgress) {
          const allFinished =
            updatedProgress.completed +
              updatedProgress.failed +
              updatedProgress.cancelled ===
            updatedProgress.total;
          if (allFinished) {
            setTimeout(
              () =>
                useDownloadsStore.getState().clearDownload(ev.payload.postId),
              600,
            );
          }
        }
      },
    );
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [updateDownloadProgress]);

  const entries = Object.values(downloads);
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
        Downloads
      </span>

      {/* Per-post progress */}
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
                    <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                  )
                ) : isCancelled ? (
                  <StopCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
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
                    <XCircle className="h-3 w-3" />
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
