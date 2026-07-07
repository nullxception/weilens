import { Input } from "./ui/input"
import { Button } from "./ui/button"
import { Label } from "./ui/label"
import { LoaderCircle, SearchIcon } from "lucide-react"

interface SearchFormProps {
  uid: string
  isLoading: boolean
  onUidChange: (uid: string) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}

function extractUid(value: string): string {
  const trimmed = value.trim()
  try {
    const url = new URL(trimmed)
    const match = url.pathname.match(/\/u\/(\d+)/)
    if (match) return match[1]
  } catch {}
  return trimmed
}

export function SearchForm({
  uid,
  isLoading,
  onUidChange,
  onSubmit,
}: SearchFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <Label htmlFor="uid">Wei UID or URL</Label>
      <div className="flex gap-2">
        <Input
          id="uid"
          type="text"
          value={uid}
          onChange={(event) => onUidChange(extractUid(event.target.value))}
          placeholder="UID or weibo.com/u/… URL"
          className="min-w-0 flex-1"
        />
        <Button
          type="submit"
          disabled={isLoading}
          size="sm"
          className="shrink-0"
        >
          {isLoading ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <SearchIcon />
          )}
        </Button>
      </div>
    </form>
  )
}
