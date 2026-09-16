import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";

import { RootLayout } from "./routes/__root";
import { IndexPage } from "./routes/index";
import { LogsPage } from "./routes/logs";
import { SettingsPage } from "./routes/settings";

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: IndexPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const logsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/logs",
  component: LogsPage,
});

const routeTree = rootRoute.addChildren([indexRoute, settingsRoute, logsRoute]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPendingMinMs: 300,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
