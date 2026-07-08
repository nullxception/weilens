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
import { useQuery } from "@tanstack/react-query"
import { useAppStore } from "../stores/appStore"
import { ScrollArea } from "./ui/scroll-area"
import { useCallback, useEffect, useState } from "react"
import type { GPSData } from "../shared/gps"
import type { NominatimResult } from "../types/gps"
import { NominatimSearchSchema } from "../types/gps"
import { fetch as tauriFetch } from "@tauri-apps/plugin-http"
import { LoaderCircle, SearchIcon, TrashIcon } from "lucide-react"
import { ButtonGroup } from "./ui/button-group"

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
  onSelect?: (data: GPSData) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  renderTrigger?: boolean
  suggestedLocation?: string
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<NominatimResult[]>([])
  const { recentPlaces, addRecentPlace, clearRecentPlaces } = useAppStore()

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
      onSelect?.(parsedCoords)
      onOpenChange?.(false)
      return
    }

    setResults([])
    try {
      await refetch()
    } catch {}
  }, [onOpenChange, onSelect, query, refetch])

  useEffect(() => {
    if (data) setResults(data)
  }, [data])

  return (
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

        {!isFetching &&
        recentPlaces &&
        recentPlaces.length > 0 &&
        results.length === 0 ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                Recently
              </span>
              <Button
                variant="destructive"
                className="text-destructive"
                onClick={() => clearRecentPlaces()}
              >
                <TrashIcon />
                Clear
              </Button>
            </div>
            <ScrollArea className="h-96 rounded-md border border-border bg-background/60">
              {recentPlaces.map((rp) => (
                <div
                  key={`${rp.lat}-${rp.lon}-${String(rp.display_name).slice(0, 30)}`}
                  className="cursor-pointer rounded-sm p-3 transition-colors hover:bg-muted/50"
                  onClick={() => {
                    onSelect?.({ lat: rp.lat, lon: rp.lon })
                    onOpenChange?.(false)
                  }}
                >
                  <div className="text-sm">{rp.display_name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    lat: {rp.lat}, lon: {rp.lon}
                  </div>
                </div>
              ))}
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
                    addRecentPlace(p)
                    onSelect?.({ lat: p.lat, lon: p.lon })
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
  )
}
