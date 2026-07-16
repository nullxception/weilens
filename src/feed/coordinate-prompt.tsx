import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { addPlace } from "../lib/api";
import { BookmarkIcon, XIcon } from "lucide-react";
import type { GPSData, Place } from "../types/gps";

interface CoordinatePromptProps {
  pendingCoord: GPSData;
  onConfirm: (place: Place) => void;
}

export function CoordinatePrompt({
  pendingCoord,
  onConfirm,
}: CoordinatePromptProps) {
  const [saveName, setSaveName] = useState("");
  const queryClient = useQueryClient();

  const handleSaveAndSelect = () => {
    const trimmed = saveName.trim();
    if (trimmed) {
      addPlace({
        name: trimmed,
        lat: pendingCoord.lat,
        lon: pendingCoord.lon,
      }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: ["places"] });
    }
    onConfirm({
      lat: pendingCoord.lat,
      lon: pendingCoord.lon,
      name: trimmed,
    });
  };

  const handleSkipSave = () => {
    onConfirm({ lat: pendingCoord.lat, lon: pendingCoord.lon, name: "" });
  };

  return (
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
          <BookmarkIcon className="mr-1 h-3.5 w-3.5" data-icon="inline-start" />
          Save &amp; go
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleSkipSave}
          className="flex-1"
        >
          <XIcon className="mr-1 h-3.5 w-3.5" data-icon="inline-start" />
          Skip
        </Button>
      </div>
    </div>
  );
}
