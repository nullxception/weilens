import { useAppStore, type AppState } from "@/stores/appStore"
import { CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { Progress } from "./ui/progress"

export function DownloadProgressPanel() {
  const downloads = useAppStore((state: AppState) => state.downloads)
  const entries = Object.values(downloads)
  if (entries.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
        Downloads
      </span>

      {/* Per-post progress */}
      {entries.map((d) => {
        const finished = d.completed + d.failed
        const percent = d.total > 0 ? Math.round((finished / d.total) * 100) : 0
        const isAllDone = finished === d.total
        const hasError = d.failed > 0

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
                ) : (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                )}
                <span className="truncate text-[11px] font-medium text-foreground">
                  Post …{d.postId.slice(-6)}
                </span>
              </div>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {finished}/{d.total}
              </span>
            </div>
            <Progress value={percent} />
            {hasError && (
              <span className="text-[10px] text-destructive">
                {d.failed} failed · {d.completed} saved
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
