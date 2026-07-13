import { useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { TrashIcon, X } from "lucide-react";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { proxyImage } from "@/lib/proxy";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useUiStore } from "../stores/useUiStore";
import { useHistoryStore } from "@/stores/useHistoryStore";

export interface CheckedProfile {
  uid: string;
  screenName: string;
  profileImageUrl: string;
  timestamp: number;
}

interface HistoryPanelProps {
  history: CheckedProfile[];
  onProfileClick?: (uid: string) => void;
}

export function HistoryPanel({ history, onProfileClick }: HistoryPanelProps) {
  const activeUid = useUiStore((state) => state.activeUid);
  const openHistoryProfile = useUiStore((state) => state.openHistoryProfile);

  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [confirmRemoveUid, setConfirmRemoveUid] = useState<string | null>(null);
  const removeFromHistory = useHistoryStore((state) => state.removeFromHistory);
  const clearHistory = useHistoryStore((state) => state.clearHistory);

  if (history.length === 0) return null;

  return (
    <>
      <ConfirmDialog
        open={confirmClearOpen}
        onOpenChange={setConfirmClearOpen}
        title="Clear history?"
        description="This will remove all recently checked profiles. This action cannot be undone."
        confirmLabel="Clear all"
        onConfirm={clearHistory}
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
          if (confirmRemoveUid !== null) removeFromHistory(confirmRemoveUid);
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

        <LayoutGroup>
          <motion.div layout className="flex flex-col gap-1.5">
            <AnimatePresence initial={false}>
              {history.map((profile) => {
                const isActive = activeUid === profile.uid;
                return (
                  <motion.div
                    key={profile.uid}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{
                      layout: { type: "spring", stiffness: 350, damping: 30 },
                      opacity: { duration: 0.15 },
                      height: { type: "spring", stiffness: 350, damping: 30 },
                    }}
                    className={`group relative flex cursor-pointer items-center gap-2 overflow-hidden rounded-md border p-2 shadow-sm transition-colors duration-200 select-none ${
                      isActive
                        ? "bg-primary/5"
                        : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
                    }`}
                    onClick={() => {
                      openHistoryProfile(profile.uid);
                      onProfileClick?.(profile.uid);
                    }}
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
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        </LayoutGroup>
      </div>
    </>
  );
}
