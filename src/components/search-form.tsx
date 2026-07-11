import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { LoaderCircle, SearchIcon } from "lucide-react";
import { useAppStore, type AppState } from "../stores/appStore";
import { ButtonGroup } from "./ui/button-group";

interface SearchFormProps {
  uid: string;
  isLoading: boolean;
  onUidChange: (uid: string) => void;
  onSubmit: (event: React.SubmitEvent<HTMLFormElement>) => void;
}

function extractUid(value: string): string {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/u\/(\d+)/);
    if (match) return match[1];
  } catch {
    // not a valid URL, fall through to trimmed value
  }
  return trimmed;
}

export function SearchForm({
  uid,
  isLoading,
  onUidChange,
  onSubmit,
}: SearchFormProps) {
  const setActiveUid = useAppStore((state: AppState) => state.setActiveUid);

  const handleUidChange = (value: string) => {
    onUidChange(extractUid(value));
  };

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    const nextUid = extractUid(uid);
    setActiveUid(nextUid);
    onSubmit(event);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <ButtonGroup>
        <Input
          id="uid"
          type="text"
          value={uid}
          onChange={(event) => handleUidChange(event.target.value)}
          placeholder="UID or weibo.com/u/… URL"
        />
        <Button
          type="submit"
          disabled={isLoading}
          variant="outline"
          aria-label="Search"
        >
          {isLoading ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <SearchIcon />
          )}
        </Button>
      </ButtonGroup>
    </form>
  );
}
