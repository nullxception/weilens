# WeiLens

Sina Weibo viewer/downloader desktop app. Tauri v2 (Rust backend) + React 19 (Vite 8 frontend).

## Commands

```bash
bun install              # install deps
bun run tauri dev        # full app (Rust + frontend hot-reload)
bun run dev              # frontend only (vite on :1420)
bun run build            # tsc -b && vite build
bun run lint             # oxlint
bun run fmt              # oxfmt --write .
bun run check            # tsc --noEmit && oxlint && oxfmt --check .
bun run typecheck        # tsc --noEmit
```

**Verification order:**

- Frontend: `lint` → `typecheck` → `build`
- Rust backend: `cargo clippy` then `cargo build` (from `src-tauri/`)

## Project structure

```
src/                  # React frontend
  app.tsx             # root component, view routing, onboarding gate
  main.tsx            # entry point (React Query, ThemeProvider)
  index.css           # Tailwind + shadcn CSS variables
  storage-keys.ts     # localStorage key constants
  assets/             # static assets (SVG icons, etc.)
  components/
    app-shell.tsx         # main layout with sidebar
    search-form.tsx       # UID search input form
    history-panel.tsx     # recent profile lookups
    download-progress-panel.tsx
    external-link-guard.tsx
    theme-provider.tsx    # light/dark/system theme context
    ui/               # shadcn/ui components (base-nova style, lucide icons)
  feed/
    blog-feed.tsx         # infinite-scroll blog feed
    blog-card.tsx         # individual post card
    blog-card-header.tsx
    blog-card-images.tsx
    blog-card-download-actions.tsx
    blog-card-location.tsx
    image-viewer.tsx      # fullscreen image viewer with navigation
    location-dialog.tsx   # place management dialog
  hooks/
    use-mobile.ts         # mobile breakpoint detection
  lib/
    api.ts                # Tauri IPC wrappers (invoke commands)
    proxy.ts              # image proxy URL builder (platform-aware)
    remote.ts             # watermark-free URL helper
    query-client.ts       # React Query client config
    utils.ts              # cn() helper and utilities
  onboarding/
    onboarding.tsx        # first-run onboarding flow
    onboarding-state.ts   # onboarding completion tracking
  settings/
    cookie-setup-dialog.tsx   # initial cookie prompt
    settings-panel.tsx        # cookie, download dir, watermark settings
  stores/
    useAuthStore.ts       # cookie parsing + auth state
    useDownloadsStore.ts  # download progress tracking
    useHistoryStore.ts    # recent profile lookup history
    usePlacesStore.ts     # GPS places state (synced with backend DB)
    useProfileStore.ts    # current profile + API fetching (Sina Weibo)
    useSettingsStore.ts   # download path, watermark position
    useUiStore.ts         # active view, sidebar, pending lookups
  types/
    remote.ts             # Sina API response Zod schemas + TS types
    rpc.ts                # Tauri IPC types (download, dewatermark position)
    gps.ts                # GPS coordinate types

src-tauri/src/        # Rust backend
  main.rs             # entry point
  lib.rs              # Tauri builder, plugin registration, img-proxy scheme
  db.rs               # SQLite (rusqlite) place storage, CRUD commands
  download.rs         # concurrent post downloads with retry, EXIF, live photo mux
  image.rs            # image proxy handler, watermark strip merging
  exif.rs             # EXIF/GPS metadata writing
  motion.rs           # motion photo muxing
  dates.rs            # date formatting for folder structure and EXIF
  types.rs            # shared Rust types
  util.rs             # URL helpers
```

## Key architecture notes

- **OS Awareness:** Always verify platform when running system-level commands or pathing.
- **Path alias:** `@/` → `src/` (configured in vite, tsconfig)
- **Image proxy:** Rust registers `img-proxy:` custom URI scheme. Frontend uses `lib/proxy.ts` which builds URLs differently per platform: `http://img-proxy.localhost` on Windows, `img-proxy://localhost` on macOS/Linux
- **Sina Weibo API:** `useProfileStore.ts` calls `weibo.com/ajax/statuses/mymblog` using `@tauri-apps/plugin-http` (bypasses CORS). Requires a valid cookie string stored in localStorage
- **Cookie formats:** Accepts both plain `name=value` and Netscape/cookie-jar format (auto-parsed in `useAuthStore.ts`)
- **SQLite database:** `weipoint.db` in app data dir. Stores places, managed by `usePlacesStore.ts` with backend CRUD commands
- **Rust lib name:** `weilens_lib` — required to avoid Windows build conflicts
- **Tauri window:** starts hidden, shown after main webview finishes loading
- **State management:** Profile/data fetching lives in `useProfileStore.ts` (Zustand + React Query). UI state in `useUiStore.ts`. Domain stores split per concern (auth, downloads, history, places, settings)
- **Search form:** accepts UID string or full `weibo.com/u/...` URL, extracts UID automatically

## Code style

- oxfmt for formatting, oxlint for linting (`bun run check` gates both + tsc)
- TypeScript strict mode, no unused locals/parameters
- oxlint ignores `dist` and `src-tauri`

## Comment Style

House style: quiet, intent-first, non-rotting. A stale/wrong comment is worse than none.

**Never write:**

- Dividers / banners (`// ----`, `// ===`, `// ***`, `// --- accessors ---`)
- Numbered/ordered labels in any form, they rot on reorder/insert/delete; never use order-implying labels in comments. This bans all of: numeric delimiters (`// 1. X`, `// 1) X`, `// 1: X`, `// 1 - X`, `// (1) X`, `// [1] X`, `// #1 X`), word-form (`// Step 1`, `// step 1:`, `// Phase 1`, `// Stage 2`, `// Part 3`), ordinal words (`// First,`, `// Second,`, `// Third,`), alphabetic (`// A. X`, `// B) X`, `// a) X`), roman (`// i) X`, `// ii. X`, `// IV. X`), circled/emoji digits (circled 1, circled 2, emoji 1), fractional (`// 1/3`, `// 1 of 3`, `// 1-3`), and numbered dividers/banners (`// --- 1. Setup ---`, `// === Step 1 ===`). Do not number at all, make sequence obvious from control flow / early-return / function names. If you must list, use unordered dash bullets inside a single `/** */` block, or extract well-named helpers (`try_pidfile()` then `fallback_by_port()`). Bad: `// 1) pidfile` / `// 2) port scan`. Good: `// pidfile first, precise` / `// fallback via port scan, ownership not guaranteed`
- Non-QWERTY symbols in comments, no emoji, no em dashes, no en dashes, no smart quotes, no circled numbers, no box-drawing or other non-ASCII glyphs. If you need a pause, use comma or semicolon; for ranges use hyphen-minus `-`. Only characters found on a standard US QWERTY keyboard belong in comments
- Refactoring / migration narrative (`replaces old X`, `migrated from Y`, `previously we did Z`, _why_ the change was made)
- Commented-out dead code (`// const x = oldThing()`), delete it; git has history
- In TS: repeated `//` across multiple lines for one thought, collapse into one `/** ... */` block

**Always write:**

- Intent / why (constraint, trade-off, gotcha), not a restatement of mechanics the code already says
- Purpose (one line for a module/fn/block), non-obvious logic (why this constant/algo/edge-case), contracts (preconditions, invariants, return semantics), ordering constraints (`must run after X`, `not thread-safe`, `do not remove, prevents double-fire`), references (spec/RFC/ticket)

**TS block rule:** multi-line comments use `/** ... */` (open `/**`, not `/*`). Single-line `//` is fine. Exceptions: generated files (`routeTree.gen.ts`) and inline single-line `/* best-effort */` inside a function. Dash bullets (`- item`) live _inside_ the `/** */` block, not as `// -`.

During review: flag bans, prefer deleting bad comments over rewriting, and update or delete the comment when you change the code.

## Shadcn/ui

- Style: `base-nova`, base color: `neutral`, CSS variables enabled
- Add components: `bunx shadcn@latest add <component>`
- Config: `components.json`

## Gotchas

- Vite watch ignores `src-tauri/` directory
- `@tauri-apps/plugin-http` `fetch` is used instead of global `fetch` for Sina Weibo API calls (needed for custom headers and cookie passthrough)
- Download uses tokio tasks with configurable concurrency and exponential backoff retries
- No CI pipeline configured
