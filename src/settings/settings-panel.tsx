import { X } from "lucide-react";
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
import { useAppStore, type AppState } from "../stores/appStore";
import { ButtonGroup } from "../components/ui/button-group";
import { Suspense, use } from "react";
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
  const cookie = useAppStore((state: AppState) => state.cookie);
  const setCookie = useAppStore((state: AppState) => state.setCookie);
  const downloadLocation = useAppStore(
    (state: AppState) => state.downloadLocation,
  );
  const setDownloadLocation = useAppStore(
    (state: AppState) => state.setDownloadLocation,
  );
  const wmPosition = useAppStore((state: AppState) => state.wmPosition);
  const setWmPosition = useAppStore((state: AppState) => state.setWmPosition);
  const onBack = useAppStore((state: AppState) => state.closeSettings);
  const savedMessage = useAppStore((state: AppState) => state.savedMessage);
  const saveCookie = useAppStore((state: AppState) => state.saveCookie);

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
          <Label htmlFor="weicookie">Cookie</Label>
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
          <Textarea
            id="weicookie"
            rows={6}
            value={cookie}
            onChange={(event) => setCookie(event.target.value)}
            placeholder="Paste your full cookie string here"
          />
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
