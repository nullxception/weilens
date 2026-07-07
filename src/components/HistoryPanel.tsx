import { X } from "lucide-react"
import { Card, CardContent } from "./ui/card"
import { Button } from "./ui/button"
import { proxyImage } from "@/lib/proxy"

export interface CheckedProfile {
  uid: string
  screenName: string
  profileImageUrl: string
  timestamp: number
}

interface HistoryPanelProps {
  history: CheckedProfile[]
  activeUid: string
  onProfileClick: (uid: string) => void
  onRemove: (uid: string) => void
  onClear: () => void
}

export function HistoryPanel({
  history,
  activeUid,
  onProfileClick,
  onRemove,
  onClear,
}: HistoryPanelProps) {
  if (history.length === 0) return null

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
            Recently viewed
          </h2>
          <Button
            type="button"
            variant="destructive"
            size="xs"
            onClick={onClear}
          >
            Clear All
          </Button>
        </div>

        <div className="flex flex-col gap-1.5">
          {history.map((profile) => {
            const isActive = activeUid === profile.uid
            return (
              <div
                key={profile.uid}
                onClick={() => onProfileClick(profile.uid)}
                className={`group relative flex cursor-pointer items-center gap-2 rounded-md border p-2 shadow-sm transition-all duration-200 select-none hover:-translate-y-0.5 hover:shadow-md ${
                  isActive
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                {profile.profileImageUrl ? (
                  <img
                    src={proxyImage(profile.profileImageUrl)}
                    alt={profile.screenName}
                    className="h-7 w-7 rounded-full border border-border object-cover shadow-sm transition-transform duration-200 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-sm transition-transform duration-200 group-hover:scale-105">
                    {profile.screenName.slice(0, 2).toUpperCase()}
                  </div>
                )}

                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm leading-tight font-semibold text-foreground">
                    {profile.screenName}
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground">
                    UID: {profile.uid}
                  </span>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(profile.uid)
                  }}
                  className="scale-90 hover:bg-destructive/10 hover:text-destructive md:opacity-0 md:group-hover:scale-100 md:group-hover:opacity-100"
                  aria-label="Remove from history"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
