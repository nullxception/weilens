import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { SettingsPanel } from "./SettingsPanel";

interface SettingsModalProps {
  cookie: string;
  onCookieChange: (value: string) => void;
  downloadLocation: string;
  onDownloadLocationChange: (value: string) => void;
  onSave: () => void;
  onBack: () => void;
  savedMessage: string;
}

export function SettingsModal({
  cookie,
  onCookieChange,
  downloadLocation,
  onDownloadLocationChange,
  onSave,
  onBack,
  savedMessage,
}: SettingsModalProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onBack()}>
      <DialogContent
        showCloseButton={false}
        className="w-full max-w-4xl! p-0 overflow-hidden"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <SettingsPanel
          cookie={cookie}
          onCookieChange={onCookieChange}
          downloadLocation={downloadLocation}
          onDownloadLocationChange={onDownloadLocationChange}
          onSave={onSave}
          onBack={onBack}
          savedMessage={savedMessage}
        />
      </DialogContent>
    </Dialog>
  );
}
