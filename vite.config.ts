import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Empty prefix: also read non-VITE_ vars (WEI_HOST) from .env.
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      // dev proxy plugin
      {
        name: "dev-proxy",
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            try {
              if (!req.url) return next();
              const urlObj = new URL(
                req.url,
                `http://localhost:${server.config.server.port}`,
              );
              if (urlObj.pathname !== "/proxy") return next();

              const target = urlObj.searchParams.get("for");
              if (!target) {
                res.writeHead(400, { "Content-Type": "text/plain" });
                res.end("Missing 'for' query parameter");
                return;
              }

              const fetched = await fetch(target, {
                headers: { Referer: "https://weibo.com/" },
              });
              if (!fetched.ok) {
                res.writeHead(fetched.status, { "Content-Type": "text/plain" });
                res.end(`Upstream error ${fetched.status}`);
                return;
              }

              const contentType =
                fetched.headers.get("content-type") ||
                "application/octet-stream";
              res.writeHead(200, { "Content-Type": contentType });
              const buffer = Buffer.from(await fetched.arrayBuffer());
              res.end(buffer);
            } catch {
              next();
              next();
            }
          });
        },
      },
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      host: env.WEI_HOST || "127.0.0.1",
      allowedHosts: env.WEI_ALLOWED_HOSTS
        ? env.WEI_ALLOWED_HOSTS.split(",")
            .map((h) => h.trim())
            .filter(Boolean)
        : undefined,
      port: 1420,
      strictPort: true,
      proxy: {
        "/api": "http://127.0.0.1:1421",
      },
      watch: {
        ignored: ["**/src-tauri/**", "**/target/**"],
      },
      middlewareMode: false,
    },
  };
});
