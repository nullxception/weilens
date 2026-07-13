"use client";

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ScrollArea } from "../components/ui/scroll-area";
import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { NominatimSearchSchema, type GPSData, type Place } from "../types/gps";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { addPlace, listPlaces, searchPlace } from "../lib/api";
import {
  BookmarkIcon,
  GlobeIcon,
  HistoryIcon,
  LoaderCircle,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { ButtonGroup } from "../components/ui/button-group";

const PAGE_SIZE = 20;

function parseCoordinateInput(input: string): GPSData | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/[()]/g, "").replace(/,/g, " ").trim();
  const parts = normalized.split(/\s+/).filter(Boolean);

  if (parts.length !== 2) return null;

  const lat = Number(parts[0]);
  const lon = Number(parts[1]);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  return { lat, lon };
}

interface SearchPlaceResult {
  place: Place;
  type: "local" | "nominatim";
}

async function searchNominatim(
  q: string,
  limit = 10,
): Promise<SearchPlaceResult[]> {
  if (!q) return [];

  const [nominatimRes, localPlaces] = await Promise.all([
    tauriFetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=${limit}`,
      { headers: { Accept: "application/json" } },
    ),
    searchPlace(q).catch(() => [] as Place[]),
  ]);

  if (!nominatimRes.ok)
    throw new Error(`Nominatim error ${nominatimRes.status}`);
  const raw = await nominatimRes.json();
  let parsed: SearchPlaceResult[];
  try {
    parsed = NominatimSearchSchema.parse(raw).map((r) => ({
      place: { lat: r.lat, lon: r.lon, name: r.display_name },
      type: "nominatim",
    }));
  } catch (err) {
    throw new Error(
      `Nominatim parse error: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }

  // interleave: local matches first, dedup by lat/lon
  const seen = new Set<string>();
  const combined: SearchPlaceResult[] = [];
  for (const r of [
    ...localPlaces.map((p) => ({ place: p, type: "local" })),
    ...parsed,
  ]) {
    const key = `${r.place.lat.toFixed(5)},${r.place.lon.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    combined.push(r as SearchPlaceResult);
  }

  return combined;
}

export default function LocationDialog({
  onSelect,
  open,
  onOpenChange,
  renderTrigger = true,
  suggestedLocation,
}: {
  onSelect?: (place: Place) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  renderTrigger?: boolean;
  suggestedLocation?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchPlaceResult[]>([]);

  // Pending coord save prompt state
  const [pendingCoord, setPendingCoord] = useState<GPSData | null>(null);
  const [saveName, setSaveName] = useState("");
  const [saveMode, setSaveMode] = useState<"ask" | "saving" | null>(null);

  const queryClient = useQueryClient();

  const {
    data: placesPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching: placesLoading,
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
    staleTime: 1000 * 60,
  });

  const places = placesPages?.pages.flatMap((p) => p.places) ?? [];
  const [scrollViewport, setScrollViewport] = useState<HTMLDivElement | null>(
    null,
  );
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

  const {
    isFetching,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ["nominatim", query],
    queryFn: async () => await searchNominatim(query, 3),
    enabled: false,
    staleTime: 1000 * 60,
  });

  const doSearch = useCallback(async () => {
    if (!query) return;

    const parsedCoords = parseCoordinateInput(query);
    if (parsedCoords) {
      // Ask user whether to save before selecting
      setPendingCoord(parsedCoords);
      setSaveName("");
      setSaveMode("ask");
      return;
    }

    setResults([]);
    try {
      const { data } = await refetch();
      if (data) setResults(data);
    } catch {
      // queryError will reflect the failure
    }
  }, [query, refetch]);

  const confirmSelect = useCallback(
    (p: Place) => {
      onSelect?.(p);
      onOpenChange?.(false);
      setPendingCoord(null);
      setSaveMode(null);
    },
    [onOpenChange, onSelect],
  );

  const handleSaveAndSelect = useCallback(() => {
    if (!pendingCoord) return;
    const trimmed = saveName.trim();
    if (trimmed) {
      addPlace({
        name: trimmed,
        lat: pendingCoord.lat,
        lon: pendingCoord.lon,
      }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: ["places"] });
    }
    confirmSelect({
      lat: pendingCoord.lat,
      lon: pendingCoord.lon,
      name: trimmed,
    });
  }, [confirmSelect, pendingCoord, queryClient, saveName]);

  const handleSkipSave = useCallback(() => {
    if (!pendingCoord) return;
    confirmSelect({ lat: pendingCoord.lat, lon: pendingCoord.lon, name: "" });
  }, [confirmSelect, pendingCoord]);

  // Sync query results into local state so we can clear them between searches
  // (Effect removed in favor of manual updates in doSearch)

  const showRecent = !isFetching && places.length > 0 && results.length === 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {renderTrigger && (
          <DialogTrigger>
            <Button>Find location</Button>
          </DialogTrigger>
        )}
        <DialogContent className="sm:max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          >
            <DialogHeader className="mb-3">
              <DialogTitle className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                Find Location
              </DialogTitle>
            </DialogHeader>

            {suggestedLocation && !isFetching && (
              <div
                className="cursor-pointer rounded-md border border-border bg-muted p-2 text-xs text-muted-foreground"
                onClick={() => {
                  setQuery(suggestedLocation);
                  void doSearch();
                }}
              >
                Post location:{" "}
                <span className="text-foreground underline">
                  {suggestedLocation}
                </span>
                <span className="ml-1">, click here to search</span>
              </div>
            )}

            <ButtonGroup className="mb-3 w-full">
              <Input
                placeholder="Singapore"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") doSearch();
                }}
              />
              <Button
                onClick={doSearch}
                disabled={isFetching}
                variant="outline"
              >
                {isFetching ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <SearchIcon />
                )}
              </Button>
            </ButtonGroup>

            {queryError && (
              <div className="mt-2 text-destructive">{String(queryError)}</div>
            )}

            {/* Save prompt for coordinate input */}
            {saveMode === "ask" && pendingCoord && (
              <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/60 p-3">
                <div className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                  Save this coordinate?
                </div>
                <div className="text-xs text-muted-foreground">
                  lat: {pendingCoord.lat}, lon: {pendingCoord.lon}
                </div>
                <Input
                  placeholder="Name (e.g. Home, Office…)"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveAndSelect();
                  }}
                  className="h-8 text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveAndSelect}
                    disabled={!saveName.trim()}
                    className="flex-1"
                  >
                    <BookmarkIcon className="mr-1 h-3.5 w-3.5" />
                    Save &amp; go
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSkipSave}
                    className="flex-1"
                  >
                    <XIcon className="mr-1 h-3.5 w-3.5" />
                    Skip
                  </Button>
                </div>
              </div>
            )}

            {/* Saved places / search results */}
            {showRecent ? (
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
                      onClick={() => {
                        onSelect?.({ lat: rp.lat, lon: rp.lon, name: rp.name });
                        onOpenChange?.(false);
                      }}
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
            ) : (
              <>
                <ScrollArea className="h-96 rounded-md border border-border">
                  {results.map((p) => (
                    <div
                      key={`${p.place.lat}-${p.place.lon}-${String(p.place.name).slice(0, 30)}`}
                      className="flex w-full cursor-pointer flex-row items-center gap-2 rounded-sm p-3 transition-colors hover:bg-muted/50"
                      onClick={() => {
                        addPlace({
                          name: p.place.name,
                          lat: p.place.lat,
                          lon: p.place.lon,
                        }).catch(console.error);
                        queryClient.invalidateQueries({ queryKey: ["places"] });
                        onSelect?.(p.place);
                        onOpenChange?.(false);
                      }}
                    >
                      {p.type == "nominatim" ? (
                        <GlobeIcon className="text-green-300/75" />
                      ) : (
                        <HistoryIcon className="text-blue-300/75" />
                      )}
                      <div className="flex flex-col">
                        <div className="text-sm">{p.place.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          lat: {p.place.lat}, lon: {p.place.lon}
                        </div>
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </>
            )}
          </motion.div>
        </DialogContent>
      </Dialog>
    </>
  );
}
