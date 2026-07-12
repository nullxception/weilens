import Masonry, { ResponsiveMasonry } from "react-responsive-masonry";
import { proxyImage } from "@/lib/proxy";
import type { BlogPost, PicDimension, PicInfo } from "../types/remote";

interface BlogCardImagesProps {
  blog: BlogPost;
  onImageClick: (idx: number) => void;
  getPreferredImage: (info: PicInfo | undefined) => {
    url: string;
    thumb: PicDimension | undefined | null;
    videoUrl: string | null;
    picId: string | undefined;
  };
  getAspectRatio: (pdm: PicDimension | undefined) => string;
}

export function BlogCardImages({
  blog,
  onImageClick,
  getPreferredImage,
  getAspectRatio,
}: BlogCardImagesProps) {
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
        {blog.pic_ids.map((picId, idx) => {
          const picData = blog.pic_infos?.[picId];
          const info = getPreferredImage(picData);
          return info.thumb ? (
            <div
              key={picId}
              className="relative w-full cursor-pointer overflow-hidden rounded-md border border-border transition-opacity hover:opacity-90"
              onClick={() => onImageClick(idx)}
            >
              <img
                src={proxyImage(info.thumb.url)}
                alt=""
                style={{ aspectRatio: getAspectRatio(info.thumb) }}
                className="w-full object-contain"
              />
              {picData?.type === "livephoto" && picData?.video != null && (
                <div className="pointer-events-none absolute top-1.5 left-1.5 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-[2px] select-none">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
                  Live Photo
                </div>
              )}
            </div>
          ) : null;
        })}
      </Masonry>
    </ResponsiveMasonry>
  );
}
