# WeiLens

Sina Weibo viewer/downloader desktop app. Tauri v2 (Rust backend) + React 19 (Vite 8 frontend).

## Commands

```bash
bun install              # install deps
bun run tauri dev        # full app (Rust + frontend hot-reload)
bun run dev              # frontend only (vite on :1420)
bun run build            # tsc -b && vite build
bun run lint             # eslint .
bun run typecheck        # tsc --noEmit
bun run format           # prettier --write "**/*.{ts,tsx}"
```

**Verification order:** `lint` → `typecheck` → `build`

Rust side: `cargo build` / `cargo clippy` from `src-tauri/`. No separate Rust test suite in use.

## Project structure

```
src/                  # React frontend
  components/ui/      # shadcn/ui components (base-nova style, lucide icons)
  feed/               # blog feed, blog cards, image viewer, location dialog
  hooks/              # useWeiLookup (core data fetching hook)
  lib/api.ts          # Tauri IPC wrappers (invoke commands)
  lib/proxy.ts        # image proxy URL builder (platform-aware)
  lib/wei-tricks.ts   # watermark-free URL helper
  stores/appStore.ts  # Zustand store (cookie, history, downloads, settings)
  types/              # Zod schemas + TS types for Wei API, RPC, GPS
  settings/           # cookie setup, settings panel/modal
  storage-keys.ts     # localStorage key constants

src-tauri/src/        # Rust backend
  lib.rs              # Tauri builder, plugin registration, img-proxy scheme
  db.rs               # SQLite (rusqlite) place storage, CRUD commands
  download.rs         # concurrent post downloads with retry, EXIF, live photo mux
  image.rs            # image proxy handler, watermark strip merging
  exif.rs             # EXIF/GPS metadata writing
  motion.rs           # motion photo muxing
  types.rs            # shared Rust types
```

## Key architecture notes

- **Path alias:** `@/` → `src/` (configured in vite, tsconfig)
- **Image proxy:** Rust registers `img-proxy:` custom URI scheme. Frontend uses `lib/proxy.ts` which builds URLs differently per platform: `http://img-proxy.localhost` on Windows, `img-proxy://localhost` on macOS/Linux
- **Sina Weibo API:** `use-wei-Lookup.ts` calls `weibo.com/ajax/statuses/mymblog` using `@tauri-apps/plugin-http` (bypasses CORS). Requires a valid cookie string stored in localStorage
- **Cookie formats:** Accepts both plain `name=value` and Netscape/cookie-jar format (auto-parsed in `appStore.ts`)
- **SQLite database:** `weipoint.db` in app data dir. Stores places with a localStorage → SQLite migration on first run
- **Dev proxy:** Vite plugin at `/proxy?for=<url>` for dev-mode image proxying
- **Rust lib name:** `tauri_native_lib` (not `weilens`) — required to avoid Windows build conflicts
- **Tauri window:** starts hidden, shown after main webview finishes loading

## Code style

- Prettier: semicolons, double quotes, trailing commas (all), LF, 2-space indent
- `prettier-plugin-tailwindcss` auto-sorts Tailwind classes (`cn` and `cva` configured as tailwind functions)
- TypeScript strict mode, no unused locals/parameters
- ESLint ignores `dist` and `src-tauri`

## Shadcn/ui

- Style: `base-nova`, base color: `neutral`, CSS variables enabled
- Add components: `bunx shadcn@latest add <component>`
- Config: `components.json`

## Gotchas

- Vite watch ignores `src-tauri/` and `wei-v1/` directories
- `@tauri-apps/plugin-http` `fetch` is used instead of global `fetch` for Sina Weibo API calls (needed for custom headers and cookie passthrough)
- Download uses tokio tasks with configurable concurrency and exponential backoff retries
- No CI pipeline configured
