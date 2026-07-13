import { useState } from "react";
import Masonry, { ResponsiveMasonry } from "react-responsive-masonry";
import { proxyImage } from "@/lib/proxy";
import type { BlogPost } from "../types/remote";
import { getAspectRatio, getPreferredImage } from "@/lib/remote";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface BlogCardImageItemProps {
  src: string;
  aspectRatio: string;
  isLivePhoto: boolean;
  onClick: () => void;
}

function BlogCardImageItem({
  src,
  aspectRatio,
  isLivePhoto,
  onClick,
}: BlogCardImageItemProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      className="relative w-full cursor-pointer overflow-hidden rounded-md border border-border transition-opacity hover:opacity-90"
      onClick={onClick}
    >
      <Skeleton
        className="absolute inset-0 z-0 w-full rounded-md"
        style={{ aspectRatio }}
      />
      <img
        src={src}
        alt=""
        style={{ aspectRatio }}
        className={cn(
          "relative z-1 w-full object-contain transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
        )}
        onLoad={() => setLoaded(true)}
        loading="lazy"
      />
      {isLivePhoto && (
        <div className="pointer-events-none absolute top-1.5 left-1.5 z-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-[2px] select-none">
          <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
          Live Photo
        </div>
      )}
    </div>
  );
}

interface BlogCardImagesProps {
  blog: BlogPost;
  onImageClick: (idx: number) => void;
}

export function BlogCardImages({ blog, onImageClick }: BlogCardImagesProps) {
  if (!blog.pic_ids || blog.pic_ids.length === 0) return null;

  return (
    <ResponsiveMasonry
      columnsCountBreakPoints={{
        350: 2,
        750: 3,
        900: 4,
        1200: 5,
        1500: 6,
      }}
    >
      <Masonry gutter="16px">
        {blog.pic_ids.map((id, idx) => {
          const data = blog.pic_infos?.[id];
          if (!data) return null;
          const info = getPreferredImage(data);
          return info.thumb ? (
            <BlogCardImageItem
              key={id}
              src={proxyImage(info.thumb.url)}
              aspectRatio={getAspectRatio(info.thumb)}
              isLivePhoto={data?.type === "livephoto" && data?.video != null}
              onClick={() => onImageClick(idx)}
            />
          ) : null;
        })}
      </Masonry>
    </ResponsiveMasonry>
  );
}
