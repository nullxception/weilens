import { useState } from "react";
import { TrashIcon, X } from "lucide-react";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { proxyImage } from "@/lib/proxy";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useAppStore, type AppState } from "../stores/appStore";

export interface CheckedProfile {
  uid: string;
  screenName: string;
  profileImageUrl: string;
  timestamp: number;
}

interface HistoryPanelProps {
  history: CheckedProfile[];
  onProfileClick: (uid: string) => void;
  onRemove: (uid: string) => void;
  onClear: () => void;
}

export function HistoryPanel({
  history,
  onProfileClick,
  onRemove,
  onClear,
}: HistoryPanelProps) {
  const activeUid = useAppStore((state: AppState) => state.activeUid);

  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [confirmRemoveUid, setConfirmRemoveUid] = useState<string | null>(null);

  if (history.length === 0) return null;

  return (
    <>
      <ConfirmDialog
        open={confirmClearOpen}
        onOpenChange={setConfirmClearOpen}
        title="Clear history?"
        description="This will remove all recently checked profiles. This action cannot be undone."
        confirmLabel="Clear all"
        onConfirm={onClear}
      />

      <ConfirmDialog
        open={confirmRemoveUid !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmRemoveUid(null);
        }}
        title="Remove from history?"
        description="This profile will be removed from your recent history."
        confirmLabel="Remove"
        onConfirm={() => {
          if (confirmRemoveUid !== null) onRemove(confirmRemoveUid);
        }}
      />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
            Recently
          </h2>
          <Button
            type="button"
            variant="destructive"
            size="xs"
            onClick={() => setConfirmClearOpen(true)}
          >
            <TrashIcon />
            Clear
          </Button>
        </div>

        <div className="flex flex-col gap-1.5">
          {history.map((profile) => {
            const isActive = activeUid === profile.uid;
            return (
              <div
                key={profile.uid}
                onClick={() => onProfileClick(profile.uid)}
                className={`group relative flex cursor-pointer items-center gap-2 rounded-md border p-2 shadow-sm transition-all duration-200 select-none hover:-translate-y-0.5 hover:shadow-md ${
                  isActive
                    ? "bg-primary/5"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                <Avatar className="h-7 w-7">
                  {profile.profileImageUrl ? (
                    <AvatarImage
                      src={proxyImage(profile.profileImageUrl)}
                      alt={profile.screenName}
                    />
                  ) : (
                    <AvatarFallback>
                      {profile.screenName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>

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
                    e.stopPropagation();
                    setConfirmRemoveUid(profile.uid);
                  }}
                  className="scale-90 hover:bg-destructive/10 hover:text-destructive md:opacity-0 md:group-hover:scale-100 md:group-hover:opacity-100"
                  aria-label="Remove from history"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
