import { useState, useEffect } from "react"
import { type DownloadProgressStatus, type DownloadItem } from "../shared/rpc"
import type { WeiPost } from "../shared/WeiSchema"
import { getNoWatermarkUrl } from "../shared/WeiTricks"
import { useAppStore, type AppState } from "../stores/appStore"
import type { GPSData } from "../shared/gps"
import { Card, CardContent } from "./ui/card"
import { Button } from "./ui/button"
import { Progress, ProgressLabel, ProgressValue } from "./ui/progress"
import { downloadPost, onDownloadProgress } from "../shared/api"
import LocationDialog from "./LocationDialog"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./ui/dropdown-menu"

interface BlogCardProps {
  blog: WeiPost
  activeUid?: string
  activeDisplayName?: string
}

function getPreferredImageUrl(
  picInfo: NonNullable<WeiPost["pic_infos"]>[string] | undefined
) {
  // largest > original > large > mw2000 > bmiddle > thumbnail
  return (
    picInfo?.largest?.url ??
    picInfo?.original?.url ??
    picInfo?.large?.url ??
    picInfo?.mw2000?.url ??
    picInfo?.bmiddle?.url ??
    picInfo?.thumbnail?.url
  )
}

export function BlogCard({
  blog,
  activeUid,
  activeDisplayName,
}: BlogCardProps) {
  const downloadLocation = useAppStore(
    (state: AppState) => state.downloadLocation
  )

  const downloadItems = (blog.pic_ids ?? [])
    .map((picId) => {
      const picData = blog.pic_infos?.[picId]
      const url = getPreferredImageUrl(picData)
      const videoUrl =
        picData?.type === "livephoto" && picData?.video ? picData.video : null
      return url ? { url, videoUrl } : null
    })
    .filter((item): item is DownloadItem => item !== null)

  const locationTag = blog.tag_struct?.find(
    (tag) => tag.otype === "place"
  )?.tag_name

  const [downloadProgress, setDownloadProgress] = useState<{
    total: number
    items: DownloadProgressStatus[]
  } | null>(null)
  const clearProgressLater = () => {
    setTimeout(() => {
      setDownloadProgress(null)
    }, 3000)
  }
  useEffect(() => {
    let mounted = true
    const setup = async () => {
      const unlisten = await onDownloadProgress((payload) => {
        if (!mounted) return
        if (payload.postId !== blog.idstr) return

        setDownloadProgress((prev) => {
          if (!prev) return prev

          const items = [...prev.items]
          items[payload.index] = payload.status

          const next = {
            ...prev,
            items,
          }

          const allFinished = items.every(
            (s) => s === "completed" || s === "failed"
          )

          if (allFinished) clearProgressLater()

          return next
        })
      })

      return unlisten
    }

    let unlistenFn: (() => void) | undefined
    setup().then((u) => (unlistenFn = u))

    return () => {
      mounted = false
      if (unlistenFn) unlistenFn()
    }
  }, [blog.idstr])

  const [gpsLocation, setGpsLocation] = useState<GPSData | null>(null)
  const [locationDialogOpen, setLocationDialogOpen] = useState(false)

  const handleDownloadWithLocation = async (loc?: GPSData | null) => {
    if (loc) setGpsLocation(loc)
    setDownloadProgress({
      total: downloadItems.length,
      items: Array(downloadItems.length).fill("downloading"),
    })

    try {
      await downloadPost({
        uid: blog.user?.idstr ?? "unknown_uid",
        postId: blog.idstr,
        createdAt: blog.created_at,
        items: downloadItems,
        downloadDir: downloadLocation || undefined,
        location: loc ?? gpsLocation ?? undefined,
      })
    } catch (error) {
      console.error("Failed to start download", error)

      setDownloadProgress((prev) => {
        if (!prev) return prev

        return {
          ...prev,
          items: prev.items.map((status) =>
            status === "downloading" ? "failed" : status
          ),
        }
      })

      clearProgressLater()
    }
  }

  const completed =
    downloadProgress?.items.filter((s) => s === "completed").length ?? 0

  const failed =
    downloadProgress?.items.filter((s) => s === "failed").length ?? 0

  const downloading =
    downloadProgress?.items.filter((s) => s === "downloading").length ?? 0

  const finished = completed + failed

  const progressPercent = downloadProgress
    ? Math.round((finished / downloadProgress.total) * 100)
    : 0

  const isReposted = Boolean(
    activeUid && blog.user?.idstr && blog.user.idstr !== activeUid
  )

  return (
    <div className="flex flex-col gap-1">
      {isReposted && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
          Reposted by {activeDisplayName || activeUid || "this user"}
        </div>
      )}

      <Card size="sm">
        <CardContent className="flex flex-col gap-2">
          {/* Author row */}
          <div className="flex items-center gap-3">
            {blog.user?.profile_image_url && (
              <img
                src={`http://localhost:18327/?url=${encodeURIComponent(blog.user.profile_image_url)}`}
                alt={blog.user.screen_name}
                className="h-8 w-8 rounded-full border border-border"
              />
            )}
            <div>
              <p className="text-sm font-semibold text-foreground">
                {blog.user?.screen_name || "Unknown User"}
              </p>
              <p className="text-xs text-muted-foreground">
                {blog.created_at}{" "}
                {blog.region_name ? `• ${blog.region_name}` : ""}
              </p>
            </div>
          </div>

          {/* Post text */}
          <p
            className="text-sm leading-relaxed whitespace-pre-wrap text-foreground"
            dangerouslySetInnerHTML={{ __html: blog.text }}
          />

          {/* Images grid */}
          {blog.pic_ids && blog.pic_ids.length > 0 && blog.pic_infos && (
            <div className="grid grid-cols-3 gap-1.5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {blog.pic_ids.map((picId) => {
                const picData = blog.pic_infos?.[picId]
                const picUrl = getPreferredImageUrl(picData)
                const noWatermarkPic = picUrl
                  ? getNoWatermarkUrl(picUrl)
                  : picUrl
                const aspectRatio =
                  picData?.original?.width && picData?.original?.height
                    ? `${picData.original.width} / ${picData.original.height}`
                    : picData?.large?.width && picData?.large?.height
                      ? `${picData.large.width} / ${picData.large.height}`
                      : picData?.bmiddle?.width && picData?.bmiddle?.height
                        ? `${picData.bmiddle.width} / ${picData.bmiddle.height}`
                        : undefined
                return picUrl ? (
                  <div key={picId} className="relative w-full">
                    <img
                      src={`http://localhost:18327/?url=${encodeURIComponent(noWatermarkPic ?? "")}`}
                      alt=""
                      style={{ aspectRatio }}
                      className="w-full rounded-md border border-border object-contain"
                    />
                    {picData?.type === "livephoto" &&
                      picData?.video != null && (
                        <div className="pointer-events-none absolute top-1.5 left-1.5 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-[2px] select-none">
                          <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
                          Live Photo
                        </div>
                      )}
                  </div>
                ) : null
              })}
            </div>
          )}

          {/* Footer: stats + download */}
          <div className="flex items-center justify-between gap-6 border-t border-border pt-1.5 text-xs font-medium text-muted-foreground">
            <div className="flex gap-6">
              <span>Reposts: {blog.reposts_count ?? 0}</span>
              <span>Comments: {blog.comments_count ?? 0}</span>
              <span>Likes: {blog.attitudes_count ?? 0}</span>
              {downloadItems.length > 0 && (
                <span>Images: {downloadItems.length}</span>
              )}
            </div>
            {downloadItems.length > 0 && (
              <div>
                {downloadProgress ? (
                  <Progress value={progressPercent} className="w-48">
                    <ProgressLabel>
                      {finished}/{downloadProgress.total}
                      {downloading > 0 && ` • ${downloading} downloading`}
                      {failed > 0 && ` • ${failed} failed`}
                    </ProgressLabel>

                    <ProgressValue>{() => `${progressPercent}%`}</ProgressValue>
                  </Progress>
                ) : (
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <Button type="button" variant="outline" size="xs">
                          Download images
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-42">
                        <DropdownMenuItem
                          onSelect={() => void handleDownloadWithLocation(null)}
                          onClick={() => void handleDownloadWithLocation(null)}
                        >
                          Download normally
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => setLocationDialogOpen(true)}
                          onClick={() => setLocationDialogOpen(true)}
                        >
                          Download with location
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <LocationDialog
                      renderTrigger={false}
                      open={locationDialogOpen}
                      onOpenChange={setLocationDialogOpen}
                      suggestedLocation={locationTag}
                      onSelect={(p) => {
                        setGpsLocation(p)
                        void handleDownloadWithLocation(p)
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
