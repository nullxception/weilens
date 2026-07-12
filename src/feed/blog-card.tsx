import { useEffect, useState } from "react";
import type { DownloadItem } from "../types/rpc";
import type { PicDimension, PicInfo, BlogPost } from "../types/remote";
import { useUiStore } from "../stores/useUiStore";
import type { GPSData, Place } from "../types/gps";
import { Card, CardContent } from "../components/ui/card";
import { getPlaceByPost, setBlogPlace } from "../lib/api";
import { BlogCardHeader } from "./blog-card-header";
import { BlogCardLocation } from "./blog-card-location";
import { BlogCardImages } from "./blog-card-images";
import { BlogCardDownloadActions } from "./blog-card-download-actions";
import { ImageViewer } from "./image-viewer";
import {
  ThumbsUpIcon,
  MessageSquareQuoteIcon,
  RotateCwIcon,
} from "lucide-react";

interface BlogCardProps {
  blog: BlogPost;
  activeDisplayName?: string;
}

function getAspectRatio(pdm: PicDimension | undefined): string {
  if (!pdm || !pdm.width || !pdm.height) return "1 / 1";
  return `${pdm.width} / ${pdm.height}`;
}

function getPreferredImage(info: PicInfo | undefined) {
  const pic = info?.largest ?? info?.mw2000 ?? info?.original ?? info?.large;
  const thumb = info?.largecover ?? info?.bmiddle ?? info?.thumbnail;
  return {
    url: pic?.url ?? "",
    thumb: thumb,
    videoUrl: info?.type === "livephoto" && info?.video ? info?.video : null,
    picId: info?.pic_id,
  };
}

export function BlogCard({ blog, activeDisplayName }: BlogCardProps) {
  const activeUid = useUiStore((state) => state.activeUid);

  const downloadItems = (blog.pic_ids ?? [])
    .map((picId) => {
      const picData = blog.pic_infos?.[picId];
      const info = getPreferredImage(picData);
      return info ? { url: info.url, videoUrl: info.videoUrl } : null;
    })
    .filter((item): item is DownloadItem => item !== null);

  const locationTag = blog.tag_struct?.find(
    (tag) => tag.otype === "place",
  )?.tag_name;

  const blogPlaceKey =
    blog.user?.id != null ? `${blog.user.id}_${blog.mblogid}` : null;
  const [storedBlogPlace, setStoredBlogPlace] = useState<Place | null>(null);
  const [gpsLocation, setGpsLocation] = useState<GPSData | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewNonce, setViewNonce] = useState(0);

  useEffect(() => {
    if (!blogPlaceKey) return;
    const [userId, mblogid] = blogPlaceKey.split("_");
    getPlaceByPost(userId, mblogid)
      .then((place) => {
        setStoredBlogPlace(place);
        setGpsLocation({ lat: place.lat, lon: place.lon });
      })
      .catch(() => {
        setStoredBlogPlace(null);
      });
  }, [blogPlaceKey]);

  const isReposted = Boolean(
    activeUid && blog.user?.idstr && blog.user.idstr !== activeUid,
  );

  const viewerImages = (blog.pic_ids ?? [])
    .map((picId) => {
      const picData = blog.pic_infos?.[picId];
      const info = getPreferredImage(picData);
      if (!info.url) return null;
      return {
        url: info.url,
        aspectRatio: getAspectRatio(info.thumb ?? undefined),
      };
    })
    .filter((img): img is { url: string; aspectRatio: string } => img !== null);

  return (
    <div className="flex flex-col gap-1">
      <Card size="sm">
        {isReposted && (
          <div className="bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
            {activeDisplayName || activeUid || "this user"} reposted
          </div>
        )}
        <CardContent className="flex flex-col gap-2">
          <BlogCardHeader blog={blog} />

          <p
            className="post-display text-sm leading-relaxed whitespace-pre-wrap text-foreground"
            dangerouslySetInnerHTML={{ __html: blog.text }}
          />

          <BlogCardImages
            blog={blog}
            getPreferredImage={getPreferredImage}
            getAspectRatio={getAspectRatio}
            onImageClick={(idx) => {
              setViewerIndex(idx);
              setViewNonce((v) => v + 1);
              setViewerOpen(true);
            }}
          />

          <BlogCardLocation place={storedBlogPlace} />

          <div className="flex items-center justify-between gap-6 pt-1 text-xs font-medium text-muted-foreground">
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

            <BlogCardDownloadActions
              uid={blog.user?.idstr ?? "unknown_uid"}
              postId={blog.idstr}
              createdAt={blog.created_at}
              downloadItems={downloadItems}
              locationTag={locationTag}
              storedBlogPlace={storedBlogPlace}
              gpsLocation={gpsLocation}
              onPlaceChange={(p, gps) => {
                setStoredBlogPlace(p);
                setGpsLocation(gps);
                if (blog.user?.id != null) {
                  setBlogPlace(String(blog.user.id), blog.mblogid, p).catch(
                    console.error,
                  );
                }
              }}
            />
          </div>
        </CardContent>
      </Card>
      <ImageViewer
        key={viewNonce}
        images={viewerImages}
        initialIndex={viewerIndex}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />
    </div>
  );
}
