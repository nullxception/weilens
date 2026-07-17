import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Dialog, DialogPortal, DialogOverlay } from "../components/ui/dialog";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Button } from "../components/ui/button";
import { cn } from "@/lib/utils";
import { CaretLeft, CaretRight, Spinner, X } from "@phosphor-icons/react";
import { proxyImage } from "@/lib/proxy";
import type { Pic } from "@/types/remote";

interface ImageViewerProps {
  images: Pic[];
  initialIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ImageViewerImage({ item }: { item: Pic }) {
  const [loaded, setLoaded] = useState(false);
  // use smaller size for faster loading
  const displayUrl = item.url.replace(
    "/" + item.url.split("/")[3] + "/",
    "/mw690/",
  );
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="flex h-full w-full items-center justify-center overflow-hidden"
    >
      {!loaded && (
        <Spinner className="absolute size-8 animate-spin text-white/70" />
      )}
      <img
        src={proxyImage(displayUrl)}
        alt=""
        className={cn(
          "relative z-1 max-h-full max-w-full rounded-sm object-contain transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
        )}
        style={{ aspectRatio: `${item.width} / ${item.height}` }}
        onLoad={() => setLoaded(true)}
      />
    </motion.div>
  );
}

export function ImageViewer({
  images,
  initialIndex = 0,
  open,
  onOpenChange,
}: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const goFirst = useCallback(() => setCurrentIndex(0), []);
  const goLast = useCallback(
    () => setCurrentIndex(images.length - 1),
    [images.length],
  );

  if (images.length === 0) return null;

  const current = images[currentIndex];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 z-50 bg-black/90 duration-200 supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          className="fixed inset-0 z-50 flex items-center justify-center duration-200 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-90 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-90"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "l") goNext();
            else if (e.key === "ArrowLeft" || e.key === "h") goPrev();
            else if (e.key === "Home") goFirst();
            else if (e.key === "End") goLast();
            else if (e.key === "Escape") onOpenChange(false);
          }}
        >
          {/* Close */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute top-3 right-3 z-20 text-white/70 hover:bg-white/10 hover:text-white"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-5" />
          </Button>

          {/* Counter */}
          {images.length > 1 && (
            <div className="absolute top-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur-sm">
              {currentIndex + 1} / {images.length}
            </div>
          )}

          {/* Prev */}
          {images.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-3 z-20 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={goPrev}
            >
              <CaretLeft className="size-6" />
            </Button>
          )}

          {/* Image with skeleton */}
          <AnimatePresence mode="wait">
            {current.url ? (
              <ImageViewerImage key={currentIndex} item={current} />
            ) : (
              <div className="text-sm text-white/50">No image</div>
            )}
          </AnimatePresence>

          {/* Next */}
          {images.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 z-20 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={goNext}
            >
              <CaretRight className="size-6" />
            </Button>
          )}
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
