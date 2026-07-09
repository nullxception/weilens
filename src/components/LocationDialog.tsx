"use client"

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog"
import { Input } from "./ui/input"
import { Button } from "./ui/button"
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { type Place } from "../stores/appStore"
import { ScrollArea } from "./ui/scroll-area"
import { useCallback, useEffect, useState } from "react"
import type { GPSData } from "../shared/gps"
import type { NominatimResult } from "../types/gps"
import { NominatimSearchSchema } from "../types/gps"
import { invoke } from "@tauri-apps/api/core"
import { fetch as tauriFetch } from "@tauri-apps/plugin-http"
import { BookmarkIcon, LoaderCircle, SearchIcon, XIcon } from "lucide-react"
import { ButtonGroup } from "./ui/button-group"

const PAGE_SIZE = 20

function parseCoordinateInput(input: string): GPSData | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const normalized = trimmed.replace(/[()]/g, "").replace(/,/g, " ").trim()
  const parts = normalized.split(/\s+/).filter(Boolean)

  if (parts.length !== 2) return null

  const lat = Number(parts[0])
  const lon = Number(parts[1])

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null

  return { lat, lon }
}

async function searchNominatim(
  q: string,
  limit = 10
): Promise<NominatimResult[]> {
  if (!q) return []
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=${limit}`
  const res = await tauriFetch(url, {
    headers: { Accept: "application/json" },
  })
  if (!res.ok) throw new Error(`Nominatim error ${res.status}`)
  const raw = await res.json()
  try {
    // validate + coerce types using shared Zod schema
    const parsed = NominatimSearchSchema.parse(raw) as NominatimResult[]
    return parsed.slice(0, limit)
  } catch (err: any) {
    throw new Error(`Nominatim parse error: ${err?.message ?? String(err)}`)
  }
}

export default function LocationDialog({
  onSelect,
  open,
  onOpenChange,
  renderTrigger = true,
  suggestedLocation,
}: {
  onSelect?: (data: GPSData, name: string) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  renderTrigger?: boolean
  suggestedLocation?: string
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<NominatimResult[]>([])

  // Pending coord save prompt state
  const [pendingCoord, setPendingCoord] = useState<GPSData | null>(null)
  const [saveName, setSaveName] = useState("")
  const [saveMode, setSaveMode] = useState<"ask" | "saving" | null>(null)

  const queryClient = useQueryClient()

  const {
    data: placesPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching: placesLoading,
  } = useInfiniteQuery({
    queryKey: ["places"],
    queryFn: async ({ pageParam }) => {
      const res = await invoke<{
        places: Place[]
        total: number
      }>("list_places", { limit: PAGE_SIZE, offset: pageParam })
      return res
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const fetched = allPages.reduce((sum, p) => sum + p.places.length, 0)
      return fetched < lastPage.total ? fetched : undefined
    },
    staleTime: 1000 * 60,
  })

  const places = placesPages?.pages.flatMap((p) => p.places) ?? []
  const [scrollViewport, setScrollViewport] = useState<HTMLDivElement | null>(
    null
  )
  const vpRefCallback = useCallback((node: HTMLDivElement | null) => {
    setScrollViewport(node)
  }, [])

  const checkAndLoadMore = useCallback(() => {
    if (!scrollViewport) return
    if (!hasNextPage || isFetchingNextPage) return

    const remaining =
      scrollViewport.scrollHeight -
      scrollViewport.scrollTop -
      scrollViewport.clientHeight

    if (remaining <= 150) {
      fetchNextPage()
    }
  }, [scrollViewport, hasNextPage, isFetchingNextPage, fetchNextPage])

  useEffect(() => {
    if (!scrollViewport) return

    checkAndLoadMore() // fill viewport if needed
    scrollViewport.addEventListener("scroll", checkAndLoadMore, {
      passive: true,
    })
    return () => {
      scrollViewport.removeEventListener("scroll", checkAndLoadMore)
    }
  }, [scrollViewport, checkAndLoadMore])

  const {
    data,
    isFetching,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ["nominatim", query],
    queryFn: async () => await searchNominatim(query, 3),
    enabled: false,
    staleTime: 1000 * 60,
  })

  const doSearch = useCallback(async () => {
    if (!query) return

    const parsedCoords = parseCoordinateInput(query)
    if (parsedCoords) {
      // Ask user whether to save before selecting
      setPendingCoord(parsedCoords)
      setSaveName("")
      setSaveMode("ask")
      return
    }

    setResults([])
    try {
      await refetch()
    } catch {}
  }, [query, refetch])

  const confirmSelect = useCallback(
    (coord: GPSData, name: string) => {
      onSelect?.(coord, name)
      onOpenChange?.(false)
      setPendingCoord(null)
      setSaveMode(null)
    },
    [onOpenChange, onSelect]
  )

  const handleSaveAndSelect = useCallback(() => {
    if (!pendingCoord) return
    const trimmed = saveName.trim()
    if (trimmed) {
      invoke("add_place", {
        place: {
          name: trimmed,
          lat: pendingCoord.lat,
          lon: pendingCoord.lon,
        },
      }).catch(console.error)
      queryClient.invalidateQueries({ queryKey: ["places"] })
    }
    confirmSelect(pendingCoord, trimmed)
  }, [confirmSelect, pendingCoord, queryClient, saveName])

  const handleSkipSave = useCallback(() => {
    if (!pendingCoord) return
    confirmSelect(pendingCoord, "")
  }, [confirmSelect, pendingCoord])

  useEffect(() => {
    if (data) setResults(data)
  }, [data])

  const showRecent = !isFetching && places.length > 0 && results.length === 0

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {renderTrigger && (
          <DialogTrigger>
            <Button>Find location</Button>
          </DialogTrigger>
        )}
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Find Location
            </DialogTitle>
          </DialogHeader>

          {suggestedLocation && !isFetching && (
            <div
              className="cursor-pointer rounded-md border border-border bg-muted p-2 text-xs text-muted-foreground"
              onClick={() => {
                setQuery(suggestedLocation)
                void doSearch()
              }}
            >
              Post location:{" "}
              <span className="text-foreground underline">
                {suggestedLocation}
              </span>
              <span className="ml-1">, click here to search</span>
            </div>
          )}

          <ButtonGroup className="w-full">
            <Input
              placeholder="Singapore"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") doSearch()
              }}
            />
            <Button onClick={doSearch} disabled={isFetching} variant="outline">
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
                  if (e.key === "Enter") handleSaveAndSelect()
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
                      onSelect?.({ lat: rp.lat, lon: rp.lon }, rp.name)
                      onOpenChange?.(false)
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
                    key={`${p.lat}-${p.lon}-${String(p.display_name).slice(0, 30)}`}
                    className="cursor-pointer rounded-sm p-3 transition-colors hover:bg-muted/50"
                    onClick={() => {
                      invoke("add_place", {
                        place: {
                          name: p.display_name,
                          lat: p.lat,
                          lon: p.lon,
                        },
                      }).catch(console.error)
                      queryClient.invalidateQueries({ queryKey: ["places"] })
                      onSelect?.({ lat: p.lat, lon: p.lon }, p.display_name)
                      onOpenChange?.(false)
                    }}
                  >
                    <div className="text-sm">{p.display_name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      lat: {p.lat}, lon: {p.lon}
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
