import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { SettingsPanel } from "./settings-panel";
import { useUiStore } from "../stores/useUiStore";

export function SettingsModal() {
  const onBack = useUiStore((state) => state.closeSettings);

  return (
    <Dialog open onOpenChange={(open) => !open && onBack()}>
      <DialogContent
        showCloseButton={false}
        className="w-full max-w-4xl! overflow-hidden p-0"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <SettingsPanel />
      </DialogContent>
    </Dialog>
  );
}
