import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { useAuthStore } from "../stores/useAuthStore";
import { useUiStore } from "../stores/useUiStore";

export function CookieSetupDialog() {
  const cookie = useAuthStore((state) => state.cookie);
  const setActiveView = useUiStore((state) => state.setActiveView);
  const [isOpen, setIsOpen] = useState(!cookie);

  const handleGoToSettings = () => {
    setActiveView("settings");
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="w-full max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">
            Sina Weibo Cookie Setup Required
          </DialogTitle>
          <DialogDescription className="mt-1.5 text-muted-foreground">
            You need to configure your Sina Weibo cookie in Settings to load
            blogs, posts, and media successfully.
          </DialogDescription>
        </DialogHeader>

        <Button type="button" onClick={handleGoToSettings} className="w-full">
          Go to Settings
        </Button>
      </DialogContent>
    </Dialog>
  );
}
