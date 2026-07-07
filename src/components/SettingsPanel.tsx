import { X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "./ui/card"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"
import { Button } from "./ui/button"
import { Label } from "./ui/label"
import { chooseDownloadFolder } from "../shared/api"

interface SettingsPanelProps {
  cookie: string
  onCookieChange: (value: string) => void
  downloadLocation: string
  onDownloadLocationChange: (value: string) => void
  onSave: () => void
  onBack: () => void
  savedMessage: string
}

export function SettingsPanel({
  cookie,
  onCookieChange,
  downloadLocation,
  onDownloadLocationChange,
  onSave,
  onBack,
  savedMessage,
}: SettingsPanelProps) {
  const handleChooseDownloadFolder = async () => {
    const selectedPath = await chooseDownloadFolder(downloadLocation)

    if (selectedPath.length > 0) {
      onDownloadLocationChange(selectedPath)
    }
  }

  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
          Settings
        </CardTitle>
        <CardAction>
          <Button
            type="button"
            variant="ghost"
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
          <Textarea
            id="weicookie"
            rows={6}
            value={cookie}
            onChange={(event) => onCookieChange(event.target.value)}
            placeholder="Paste your full cookie string here"
          />
        </div>

        <Button type="button" onClick={onSave} className="w-full">
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
          <div className="flex gap-2">
            <Input
              type="text"
              value={downloadLocation || ""}
              readOnly
              placeholder="Using default Downloads/WeiLens folder"
              className="min-w-0 flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleChooseDownloadFolder}
              className="shrink-0"
            >
              Choose folder
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
