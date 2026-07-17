import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { DownloadItem } from "../types/rpc";
import type { BlogPost, Pic } from "../types/remote";
import { useUiStore } from "../stores/useUiStore";
import { useProfileStore } from "../stores/useProfileStore";
import type { GPSData, Place } from "../types/gps";
import { Card, CardContent } from "../components/ui/card";
import { getPlaceByPost, setBlogPlace } from "../lib/api";
import { BlogCardHeader } from "./blog-card-header";
import { BlogCardLocation } from "./blog-card-location";
import { BlogCardImages } from "./blog-card-images";
import { BlogCardDownloadActions } from "./blog-card-download-actions";
import { ImageViewer } from "./image-viewer";
import { ThumbsUp, ChatCircleText, ArrowsClockwise } from "@phosphor-icons/react";
import { getPreferredImage } from "@/lib/remote";

interface BlogCardProps {
  blog: BlogPost;
}

export function BlogCard({ blog }: BlogCardProps) {
  const activeUid = useUiStore((state) => state.activeUid);
  const activeDisplayName = useProfileStore((state) => state.activeDisplayName);

  const downloadItems = (blog.pic_ids ?? [])
    .map((id) => {
      const data = blog.pic_infos?.[id];
      if (!data) return null;
      const info = getPreferredImage(data);
      return { url: info.preferred.url, videoUrl: info.videoUrl };
    })
    .filter((item): item is DownloadItem => item !== null);

  const locationTag = blog.tag_struct?.find(
    (tag) => tag.otype === "place",
  )?.tag_name;

  const blogPlaceKey =
    blog.user?.id != null ? `${blog.user.id}_${blog.mblogid}` : null;

  const queryClient = useQueryClient();

  // Use React Query for place data — cached per (userId, mblogid)
  const { data: storedBlogPlace } = useQuery<Place | null>({
    queryKey: blogPlaceKey ? ["place", blogPlaceKey] : ["place", "none"],
    queryFn: async () => {
      if (!blogPlaceKey) return null;
      const [userId, mblogid] = blogPlaceKey.split("_");
      return getPlaceByPost(userId, mblogid);
    },
    enabled: !!blogPlaceKey,
    retry: 0,
  });

  const [gpsLocation, setGpsLocation] = useState<GPSData | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewNonce, setViewNonce] = useState(0);

  // Keep gpsLocation in sync with place data
  const updateGpsLocation = useCallback(
    (place: Place | null) => {
      if (place) {
        setGpsLocation({ lat: place.lat, lon: place.lon });
      } else {
        setGpsLocation(null);
      }
    },
    [],
  );

  // Invalidate on place change
  const handlePlaceChange = useCallback(
    (place: Place) => {
      updateGpsLocation(place);
      queryClient.invalidateQueries({ queryKey: ["place", blogPlaceKey] });
    },
    [queryClient, blogPlaceKey, updateGpsLocation],
  );

  const isReposted = Boolean(
    activeUid && blog.user?.idstr && blog.user.idstr !== activeUid,
  );

  const viewerImages = (blog.pic_ids ?? [])
    .map((id) => {
      const data = blog.pic_infos?.[id];
      if (!data) return null;
      const info = getPreferredImage(data);
      if (!info.preferred) return null;
      return info.preferred;
    })
    .filter((img): img is Pic => img !== null);

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
            onImageClick={(idx) => {
              setViewerIndex(idx);
              setViewNonce((v) => v + 1);
              setViewerOpen(true);
            }}
          />

          <BlogCardLocation place={storedBlogPlace ?? null} />

          <div className="flex items-center justify-between gap-6 pt-1 text-xs font-medium text-muted-foreground">
            <div className="flex gap-4">
              <span>
                <ThumbsUp className="inline h-4" />{" "}
                {blog.attitudes_count ?? 0}
              </span>
              <span>
                <ChatCircleText className="inline h-4" />{" "}
                {blog.comments_count ?? 0}
              </span>
              <span>
                <ArrowsClockwise className="inline h-4" />{" "}
                {blog.reposts_count ?? 0}
              </span>
            </div>

            <BlogCardDownloadActions
              uid={blog.user?.idstr ?? "unknown_uid"}
              postId={blog.idstr}
              createdAt={blog.created_at}
              downloadItems={downloadItems}
              locationTag={locationTag}
              storedBlogPlace={storedBlogPlace ?? null}
              gpsLocation={gpsLocation}
              onPlaceChange={(p) => {
                handlePlaceChange(p);
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
