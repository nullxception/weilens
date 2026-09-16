import { ArrowClockwiseIcon, CopyIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { readCrashLog } from "@/lib/api";

import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";

export function CrashLogView() {
  const [follow, setFollow] = useState(true);
  const [filter, setFilter] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, refetch, isFetching, isError } = useQuery({
    queryKey: ["crash-log"],
    queryFn: () => readCrashLog(500),
    refetchInterval: false,
  });

  const lines = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter((l: string) => l.toLowerCase().includes(q));
  }, [lines, filter]);

  useEffect(() => {
    if (!follow) return;
    bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [filtered, follow]);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(filtered.join("\n"));
    } catch {
      // clipboard unavailable, ignore
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Crash log</h2>
          <p className="text-sm text-muted-foreground">
            Panics and fatal signals captured from crash.log.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm">
            <Checkbox
              checked={follow}
              onCheckedChange={(v) => setFollow(v === true)}
            />
            Follow
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <ArrowClockwiseIcon className={isFetching ? "animate-spin" : ""} />
            Refresh
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={copyAll}>
            <CopyIcon />
            Copy
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter…"
          className="w-full max-w-sm sm:w-64"
        />
        <span className="text-xs text-muted-foreground">
          {filtered.length}/{lines.length} lines
        </span>
        {filter && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFilter("")}
          >
            Clear
          </Button>
        )}
      </div>

      <div className="max-h-[60vh] overflow-auto rounded-md border bg-muted/20 p-3 font-mono text-xs leading-5">
        {isError ? (
          <div className="py-8 text-center text-muted-foreground">
            Failed to load crash.log.
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No crashes recorded yet.
          </div>
        ) : (
          filtered.map((line: string, i: number) => (
            <div
              key={`${i}-${line.slice(0, 32)}`}
              className="break-all whitespace-pre-wrap"
            >
              {line}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
