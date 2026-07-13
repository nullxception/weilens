import { useState } from "react";
import type { DownloadItem, WmPosition } from "../types/rpc";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useDownloadsStore } from "../stores/useDownloadsStore";
import type { GPSData, Place } from "../types/gps";
import { Button } from "../components/ui/button";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "../components/ui/progress";
import { cancelDownloadPost, downloadPost } from "../lib/api";
import LocationDialog from "./location-dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../components/ui/dropdown-menu";
import {
  DownloadIcon,
  EraserIcon,
  FileXIcon,
  Loader2Icon,
  XCircleIcon,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

interface BlogCardDownloadActionsProps {
  uid: string;
  postId: string;
  createdAt: string;
  downloadItems: DownloadItem[];
  locationTag?: string;
  storedBlogPlace: Place | null;
  gpsLocation: GPSData | null;
  onPlaceChange: (place: Place, gpsLocation: GPSData) => void;
}

const wmPositions = [
  { label: "Top", value: "top" },
  { label: "Center", value: "center" },
  { label: "Bottom", value: "bottom" },
];

export function BlogCardDownloadActions({
  uid,
  postId,
  createdAt,
  downloadItems,
  locationTag,
  storedBlogPlace,
  gpsLocation,
  onPlaceChange,
}: BlogCardDownloadActionsProps) {
  const downloadLocation = useSettingsStore((state) => state.downloadLocation);
  const defaultDewatermark = useSettingsStore((state) => state.dewatermark);
  const startDownload = useDownloadsStore((state) => state.startDownload);
  const clearDownload = useDownloadsStore((state) => state.clearDownload);
  const downloadProgress = useDownloadsStore(
    (state) => state.downloads[postId] ?? null,
  );

  const [dewatermark, setDewatermark] =
    useState<WmPosition>(defaultDewatermark);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);

  const clearProgressLater = () => {
    setTimeout(() => clearDownload(postId), 600);
  };

  const handleDownload = async (loc?: GPSData | null) => {
    startDownload(postId, downloadItems.length);

    try {
      await downloadPost({
        uid: uid,
        blogId: postId,
        date: createdAt,
        items: downloadItems,
        target: downloadLocation || undefined,
        gps: loc ?? gpsLocation ?? undefined,
        dewatermark: dewatermark,
      });
    } catch (error) {
      console.error("Failed to start download", error);
      clearProgressLater();
    }
  };

  const completed = downloadProgress?.completed ?? 0;
  const failed = downloadProgress?.failed ?? 0;
  const cancelled = downloadProgress?.cancelled ?? 0;
  const downloading = downloadProgress
    ? downloadProgress.total - completed - failed - cancelled
    : 0;
  const finished = completed + failed + cancelled;
  const progressPercent = downloadProgress
    ? Math.round((finished / downloadProgress.total) * 100)
    : 0;

  if (downloadItems.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {downloadProgress ? (
        <div className="flex items-center gap-1.5">
          <Progress value={progressPercent} className="w-36">
            <ProgressLabel>
              {finished}/{downloadProgress.total}
              {downloading > 0 && ` • ${downloading}`}
              {downloading > 0 && (
                <Loader2Icon className="inline h-5 w-5 animate-spin pr-1 pl-1" />
              )}
              {failed > 0 && ` • ${failed} failed`}
              {failed > 0 && <FileXIcon className="inline h-5 w-5 pr-1 pl-1" />}
              {cancelled > 0 && ` • ${cancelled}`}
              {cancelled > 0 && (
                <XCircleIcon className="inline h-5 w-5 pr-1 pl-1" />
              )}
            </ProgressLabel>

            <ProgressValue>{() => `${progressPercent}%`}</ProgressValue>
          </Progress>
          {downloading > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
              onClick={() => void cancelDownloadPost(postId)}
            >
              <XCircleIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Select
            items={wmPositions}
            onValueChange={(value) => setDewatermark(value as WmPosition)}
            value={dewatermark}
          >
            <SelectTrigger size="sm" className="w-32">
              <EraserIcon />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>WM Remover</SelectLabel>
                {wmPositions.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
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
                onSelect={() => void handleDownload(storedBlogPlace ?? null)}
                onClick={() => void handleDownload(storedBlogPlace ?? null)}
              >
                Download normally
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setLocationDialogOpen(true)}
                onClick={() => setLocationDialogOpen(true)}
              >
                {storedBlogPlace
                  ? "Change location & download"
                  : "Download with location"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <LocationDialog
            renderTrigger={false}
            open={locationDialogOpen}
            onOpenChange={setLocationDialogOpen}
            suggestedLocation={locationTag}
            onSelect={(p) => {
              onPlaceChange(p, { lat: p.lat, lon: p.lon });
              void handleDownload({
                lat: p.lat,
                lon: p.lon,
              });
            }}
          />
        </div>
      )}
    </div>
  );
}
