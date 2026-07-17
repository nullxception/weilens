import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";

import "./index.css";
import { ThemeProvider } from "@/components/theme-provider.tsx";
import { ExternalLinkGuard } from "./components/external-link-guard.tsx";
import { queryClient } from "./lib/query-client";
import { router } from "./router";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ExternalLinkGuard />
        <main data-ui-scroll-container>
          <RouterProvider router={router} />
        </main>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
