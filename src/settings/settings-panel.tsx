import { X, ClipboardPaste, Eye, EyeOff } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { chooseDownloadDir, defaultDownloadDir } from "../lib/api";
import { useAuthStore } from "../stores/useAuthStore";
import { useUiStore } from "../stores/useUiStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { ButtonGroup } from "../components/ui/button-group";
import { Suspense, use, useState, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import type { WmPosition } from "@/types/rpc";

const systemDownloadDir = defaultDownloadDir();

function DownloadPathInput({ savedLocation }: { savedLocation: string }) {
  const dir = use(systemDownloadDir);
  return (
    <Input
      type="text"
      value={savedLocation}
      readOnly
      placeholder={dir}
      className="min-w-0 flex-1"
    />
  );
}

export function SettingsPanel() {
  const cookie = useAuthStore((state) => state.cookie);
  const setCookie = useAuthStore((state) => state.setCookie);
  const downloadLocation = useSettingsStore((state) => state.downloadLocation);
  const setDownloadLocation = useSettingsStore(
    (state) => state.setDownloadLocation,
  );
  const wmPosition = useSettingsStore((state) => state.dewatermark);
  const setWmPosition = useSettingsStore((state) => state.setWmPosition);
  const onBack = useUiStore((state) => state.closeSettings);
  const savedMessage = useAuthStore((state) => state.savedMessage);
  const saveCookie = useAuthStore((state) => state.saveCookie);
  const [blurred, setBlurred] = useState(true);
  const [pasted, setPasted] = useState(false);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setCookie(text);
        setPasted(true);
        setTimeout(() => setPasted(false), 1500);
      }
    } catch {
      // clipboard access denied or unavailable
    }
  }, [setCookie]);

  const handleChooseDownloadFolder = async () => {
    const selectedPath = await chooseDownloadDir(downloadLocation);

    if (selectedPath.length > 0) {
      setDownloadLocation(selectedPath);
    }
  };

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
          Settings
        </CardTitle>
        <CardAction>
          <Button
            type="button"
            variant="destructive"
            size="icon-sm"
            onClick={onBack}
            aria-label="Close settings"
          >
            <X />
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="weicookie">Cookie</Label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePaste}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Paste from clipboard"
              >
                {pasted ? (
                  <span className="text-green-500 text-xs font-bold">✓</span>
                ) : (
                  <ClipboardPaste className="size-3.5" />
                )}
                <span>{pasted ? "Pasted" : "Paste"}</span>
              </button>
              <button
                type="button"
                onClick={() => setBlurred((b) => !b)}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={blurred ? "Show cookie" : "Hide cookie"}
              >
                {blurred ? (
                  <EyeOff className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
                <span>{blurred ? "Show" : "Hide"}</span>
              </button>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">
            Tip: Use{" "}
            <a
              href="https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Get cookies.txt locally
            </a>{" "}
            to get cookie from Sina Weibo.
          </span>
          <div className={blurred ? "rounded-md border border-input overflow-hidden" : ""}>
            <Textarea
              id="weicookie"
              rows={6}
              value={cookie}
              onChange={(event) => setCookie(event.target.value)}
              placeholder="Paste your full cookie string here"
              className={
                blurred
                  ? "resize-none text-sm blur-sm transition-[filter] select-none border-none bg-input/20"
                  : "resize-none text-sm blur-none transition-[filter]"
              }
            />
          </div>
        </div>

        <Button
          type="button"
          onClick={saveCookie}
          className="w-full"
          variant="outline"
        >
          Save Cookie
        </Button>

        {savedMessage ? (
          <p
            className="text-xs text-green-600 dark:text-green-400"
            role="status"
          >
            {savedMessage}
          </p>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label>Download Folder</Label>
          <ButtonGroup className="w-full" onClick={handleChooseDownloadFolder}>
            <Suspense
              fallback={
                <Input
                  type="text"
                  value={downloadLocation}
                  readOnly
                  className="min-w-0 flex-1"
                />
              }
            >
              <DownloadPathInput savedLocation={downloadLocation} />
            </Suspense>
            <Button
              type="button"
              variant="outline"
              onClick={handleChooseDownloadFolder}
            >
              Choose folder
            </Button>
          </ButtonGroup>
        </div>

        <div className="flex flex-row justify-between gap-1.5">
          <Label>Default Watermark Remover</Label>
          <Select
            items={[
              { label: "Top", value: "top" },
              { label: "Center", value: "center" },
              { label: "Bottom", value: "bottom" },
            ]}
            onValueChange={(value) => setWmPosition(value as WmPosition)}
            value={wmPosition}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Position</SelectLabel>
                <SelectItem value="top">Top</SelectItem>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="bottom">Bottom</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
