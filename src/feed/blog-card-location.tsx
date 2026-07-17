import { MapPin } from "@phosphor-icons/react";
import type { Place } from "../types/gps";

interface BlogCardLocationProps {
  place: Place | null;
}

export function BlogCardLocation({ place }: BlogCardLocationProps) {
  if (!place) return null;

  return (
    <div className="mt-1 flex items-center gap-1 text-xs">
      <MapPin className="h-4 w-4 shrink-0" />
      <span className="truncate rounded-sm bg-green-500/10 px-2 py-1">
        {place.name ?? `${place.lat}, ${place.lon}`}
      </span>
    </div>
  );
}
