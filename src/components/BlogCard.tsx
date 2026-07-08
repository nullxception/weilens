import { useState } from "react"
import { type DownloadItem } from "../shared/rpc"
import type { PicDimension, PicInfo, WeiPost } from "../shared/WeiSchema"
import { useAppStore, type AppState } from "../stores/appStore"
import type { GPSData } from "../shared/gps"
import { Card, CardContent } from "./ui/card"
import { Button } from "./ui/button"
import { Progress, ProgressLabel, ProgressValue } from "./ui/progress"
import { downloadPost } from "../shared/api"
import LocationDialog from "./LocationDialog"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./ui/dropdown-menu"
import { proxyImage } from "@/lib/proxy"
import Masonry, { ResponsiveMasonry } from "react-responsive-masonry"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import {
  DownloadIcon,
  MessageSquareQuoteIcon,
  RotateCwIcon,
  ThumbsUpIcon,
} from "lucide-react"

interface BlogCardProps {
  blog: WeiPost
  activeDisplayName?: string
}

function getAspectRatio(pdm: PicDimension | undefined): string {
  if (!pdm || !pdm.width || !pdm.height) return "1 / 1"
  return `${pdm.width} / ${pdm.height}`
}

function getPreferredImage(info: PicInfo | undefined) {
  // largest > mw2000/original > large >
  const pic = info?.largest ?? info?.mw2000 ?? info?.original ?? info?.large
  // largecover > bmiddle > thumbnail
  const thumb = info?.largecover ?? info?.bmiddle ?? info?.thumbnail

  return {
    url: pic?.url ?? "",
    thumb: thumb,
    videoUrl: info?.type === "livephoto" && info?.video ? info?.video : null,
    picId: info?.pic_id,
  }
}

export function BlogCard({ blog, activeDisplayName }: BlogCardProps) {
  const downloadLocation = useAppStore(
    (state: AppState) => state.downloadLocation
  )
  const activeUid = useAppStore((state: AppState) => state.activeUid)
  const startDownload = useAppStore((state: AppState) => state.startDownload)
  const clearDownload = useAppStore((state: AppState) => state.clearDownload)
  const downloadProgress = useAppStore(
    (state: AppState) => state.downloads[blog.idstr] ?? null
  )

  const downloadItems = (blog.pic_ids ?? [])
    .map((picId) => {
      const picData = blog.pic_infos?.[picId]
      const info = getPreferredImage(picData)
      return info ? { url: info.url, videoUrl: info.videoUrl } : null
    })
    .filter((item): item is DownloadItem => item !== null)

  const locationTag = blog.tag_struct?.find(
    (tag) => tag.otype === "place"
  )?.tag_name

  const [gpsLocation, setGpsLocation] = useState<GPSData | null>(null)
  const [locationDialogOpen, setLocationDialogOpen] = useState(false)

  const clearProgressLater = () => {
    setTimeout(() => clearDownload(blog.idstr), 3000)
  }

  const handleDownloadWithLocation = async (loc?: GPSData | null) => {
    if (loc) setGpsLocation(loc)
    startDownload(blog.idstr, downloadItems.length)

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
      clearProgressLater()
    }
  }

  const completed = downloadProgress?.completed ?? 0
  const failed = downloadProgress?.failed ?? 0
  const downloading = downloadProgress
    ? downloadProgress.total - completed - failed
    : 0
  const finished = completed + failed
  const progressPercent = downloadProgress
    ? Math.round((finished / downloadProgress.total) * 100)
    : 0

  const isReposted = Boolean(
    activeUid && blog.user?.idstr && blog.user.idstr !== activeUid
  )

  return (
    <div className="flex flex-col gap-1">
      <Card size="sm">
        {isReposted && (
          <div className="bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
            {activeDisplayName || activeUid || "this user"} reposted
          </div>
        )}
        <CardContent className="flex flex-col gap-2">
          {/* Author row */}
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage
                src={proxyImage(blog.user?.profile_image_url ?? "")}
              />
              <AvatarFallback>
                {blog.user?.screen_name?.charAt(0) ?? "U"}
              </AvatarFallback>
            </Avatar>

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
            className="post-display text-sm leading-relaxed whitespace-pre-wrap text-foreground"
            dangerouslySetInnerHTML={{ __html: blog.text }}
          />

          {/* Images grid */}
          <ResponsiveMasonry
            columnsCountBreakPoints={{
              350: 3,
              750: 4,
              900: 5,
              1200: 6,
              1500: 7,
            }}
          >
            <Masonry gutter="16px">
              {blog.pic_ids &&
                blog.pic_ids.length > 0 &&
                blog.pic_infos &&
                blog.pic_ids.map((picId) => {
                  const picData = blog.pic_infos?.[picId]
                  const info = getPreferredImage(picData)
                  return info.thumb ? (
                    <div
                      key={picId}
                      className="relative w-full overflow-hidden rounded-md border border-border"
                    >
                      <img
                        src={proxyImage(info.thumb.url)}
                        alt=""
                        style={{ aspectRatio: getAspectRatio(info.thumb) }}
                        className="w-full object-contain"
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
            </Masonry>
          </ResponsiveMasonry>

          {/* Footer: stats + download */}
          <div className="flex items-center justify-between gap-6 pt-2 text-xs font-medium text-muted-foreground">
            <div className="flex gap-4">
              <span>
                <ThumbsUpIcon className="inline h-4" />{" "}
                {blog.attitudes_count ?? 0}
              </span>
              <span>
                <MessageSquareQuoteIcon className="inline h-4" />{" "}
                {blog.comments_count ?? 0}
              </span>
              <span>
                <RotateCwIcon className="inline h-4" />{" "}
                {blog.reposts_count ?? 0}
              </span>
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
                        <Button type="button" variant="outline" size="sm">
                          <DownloadIcon className="inline h-4" />
                          Download
                          {downloadItems.length > 0
                            ? ` ${downloadItems.length} images`
                            : "image"}
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
