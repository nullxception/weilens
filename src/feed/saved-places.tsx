import { useCallback, useEffect, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ScrollArea } from "../components/ui/scroll-area";
import { listPlaces } from "../lib/api";
import { LoaderCircle } from "lucide-react";
import type { Place } from "../types/gps";

const PAGE_SIZE = 20;

interface SavedPlacesProps {
  onSelect: (place: Place) => void;
  placesLoading: boolean;
}

export function SavedPlaces({ onSelect, placesLoading }: SavedPlacesProps) {
  const {
    data: placesPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["places"],
    queryFn: async ({ pageParam }) => {
      return await listPlaces({ limit: PAGE_SIZE, offset: pageParam });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const fetched = allPages.reduce((sum, p) => sum + p.places.length, 0);
      return fetched < lastPage.total ? fetched : undefined;
    },
  });

  const places = placesPages?.pages.flatMap((p) => p.places) ?? [];
  const [scrollViewport, setScrollViewport] = useState<HTMLDivElement | null>(null);

  const vpRefCallback = useCallback((node: HTMLDivElement | null) => {
    setScrollViewport(node);
  }, []);

  const checkAndLoadMore = useCallback(() => {
    if (!scrollViewport) return;
    if (!hasNextPage || isFetchingNextPage) return;

    const remaining =
      scrollViewport.scrollHeight -
      scrollViewport.scrollTop -
      scrollViewport.clientHeight;

    if (remaining <= 150) {
      fetchNextPage();
    }
  }, [scrollViewport, hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    if (!scrollViewport) return;

    checkAndLoadMore(); // fill viewport if needed
    scrollViewport.addEventListener("scroll", checkAndLoadMore, {
      passive: true,
    });
    return () => {
      scrollViewport.removeEventListener("scroll", checkAndLoadMore);
    };
  }, [scrollViewport, checkAndLoadMore]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
          Saved places
        </span>
        {placesLoading && (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        )}
      </div>
      <ScrollArea
        viewportRef={vpRefCallback}
        className="h-80 rounded-md border border-border bg-background/60"
      >
        {places.map((rp) => (
          <div
            key={`${rp.lat}-${rp.lon}-${String(rp.name).slice(0, 30)}`}
            className="cursor-pointer rounded-sm p-3 transition-colors hover:bg-muted/50"
            onClick={() => onSelect({ lat: rp.lat, lon: rp.lon, name: rp.name })}
          >
            <div className="text-sm">{rp.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              lat: {rp.lat}, lon: {rp.lon}
            </div>
          </div>
        ))}
        {isFetchingNextPage && (
          <div className="flex justify-center py-3">
            <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
