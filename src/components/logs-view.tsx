import { useState } from "react";

import { AppLogView } from "./app-log-view";
import { CrashLogView } from "./crash-log-view";
import { Button } from "./ui/button";

type Tab = "app" | "crash";

export function LogsView() {
  const [tab, setTab] = useState<Tab>("app");

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b pb-2">
        <Button
          type="button"
          variant={tab === "app" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setTab("app")}
        >
          App log
        </Button>
        <Button
          type="button"
          variant={tab === "crash" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setTab("crash")}
        >
          Crash log
        </Button>
      </div>

      {tab === "app" ? <AppLogView /> : <CrashLogView />}
    </div>
  );
}
