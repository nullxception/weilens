import { useCallback, useEffect, useState } from "react"
import { Dialog, DialogPortal, DialogOverlay } from "../components/ui/dialog"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { Button } from "../components/ui/button"
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react"
import { proxyImage } from "@/lib/proxy"

export interface ImageItem {
  url: string
  thumbUrl?: string
  aspectRatio?: string
}

interface ImageViewerProps {
  images: ImageItem[]
  initialIndex?: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImageViewer({
  images,
  initialIndex = 0,
  open,
  onOpenChange,
}: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  useEffect(() => {
    if (open) setCurrentIndex(initialIndex)
  }, [open, initialIndex])

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i + 1) % images.length)
  }, [images.length])

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i - 1 + images.length) % images.length)
  }, [images.length])

  const goFirst = useCallback(() => setCurrentIndex(0), [])
  const goLast = useCallback(
    () => setCurrentIndex(images.length - 1),
    [images.length]
  )

  if (images.length === 0) return null

  const current = images[currentIndex]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 z-50 bg-black/90 supports-backdrop-filter:backdrop-blur-sm" />
        <DialogPrimitive.Popup
          className="fixed inset-0 z-50 flex items-center justify-center outline-none"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "l") goNext()
            else if (e.key === "ArrowLeft" || e.key === "h") goPrev()
            else if (e.key === "Home") goFirst()
            else if (e.key === "End") goLast()
            else if (e.key === "Escape") onOpenChange(false)
          }}
        >
          {/* Close */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute top-3 right-3 z-10 text-white/70 hover:bg-white/10 hover:text-white"
            onClick={() => onOpenChange(false)}
          >
            <XIcon className="size-5" />
          </Button>

          {/* Counter */}
          {images.length > 1 && (
            <div className="absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur-sm">
              {currentIndex + 1} / {images.length}
            </div>
          )}

          {/* Prev */}
          {images.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-3 z-10 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={goPrev}
            >
              <ChevronLeftIcon className="size-6" />
            </Button>
          )}

          {/* Image */}
          <img
            key={currentIndex}
            src={proxyImage(current.url)}
            alt=""
            className="max-h-[90vh] max-w-[90vw] object-contain select-none"
            draggable={false}
          />

          {/* Next */}
          {images.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 z-10 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={goNext}
            >
              <ChevronRightIcon className="size-6" />
            </Button>
          )}
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}
