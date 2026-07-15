import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";

import "./index.css";
import { ThemeProvider } from "@/components/theme-provider.tsx";
import { ExternalLinkGuard } from "./components/external-link-guard.tsx";
import { queryClient } from "./lib/query-client";
import App from "./app.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ExternalLinkGuard />
        <main data-ui-scroll-container>
          <App />
        </main>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
