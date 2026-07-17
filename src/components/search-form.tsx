import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { SpinnerIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";
import { useProfileStore } from "../stores/useProfileStore";
import { ButtonGroup } from "./ui/button-group";

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

export function SearchForm() {
  const uid = useProfileStore((state) => state.uid);
  const isLoading = useProfileStore((state) => state.isLoading);
  const setUid = useProfileStore((state) => state.setUid);
  const checkUid = useProfileStore((state) => state.checkUid);
  const navigate = useNavigate();

  const handleUidChange = (value: string) => {
    setUid(extractUid(value));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextUid = extractUid(uid);
    checkUid(nextUid, 1);
    navigate({ to: "/" });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <ButtonGroup className="w-full">
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
            <SpinnerIcon className="animate-spin" />
          ) : (
            <MagnifyingGlassIcon />
          )}
        </Button>
      </ButtonGroup>
    </form>
  );
}
