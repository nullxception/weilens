# WeiLens

Sina Weibo viewer/downloader desktop app. Tauri v2 (Rust backend in `src-tauri/`) + React 19 (Vite frontend in `src/`).

## House Skills (read before writing code)

Repo-local taste rules, committed so they work on any PC and in isolated subagents:

- Rust idioms: `.agents/skills/rust-idioms/SKILL.md` (unwrap policy, borrow vs clone, iterators, types)
- Comment style: `.agents/skills/comment-style/SKILL.md` (quiet, intent-first, non-rotting)

## What Belongs Here

Keep this file compact. Every line must answer: "would an agent likely miss this
without help?" If not, leave it out.

**Do write:**

- Exact commands/shortcuts an agent would otherwise guess wrong, and required
  command order when it matters.
- Architecture notes not obvious from filenames (entrypoints, process topology,
  module boundaries).
- Conventions that differ from language/framework defaults.
- Setup prerequisites, env quirks, operational gotchas, and stale-behavior traps.

**Do not write:**

- The underlying commands of `package.json` scripts or any other config file,
  they are the source of truth; reference them by name only.
- Generic software advice, long tutorials, or exhaustive file trees.
- Obvious language conventions or anything derivable from a single glance at
  the code.
- Speculative claims, verify against the code before writing, and re-verify
  when touching related modules.

## Dev environment

- Runtime: **Bun** (`bun.lock` present, `"type": "module"`). Do not use npm/pnpm/npx for scripts.
- Install: `bun install`
- Tool invocation: prefer `bun <script>` (`check`/`lint`/`fmt`/...) over direct binaries. For a one-off tool with no script, try `bunx --bun <tool> <args>` first (forces Bun runtime), fall back to plain `bunx <tool> <args>` (respects node shebang) if it errors. Never execute `node_modules/.bin/*` directly. Exception: `oxfmt` must run via plain `bunx oxfmt`, it crashes under `bunx --bun` because tinypool needs node worker threads.
- Path alias: `@/*` maps to `src/*` (`tsconfig.app.json`, `vite.config.ts`).

## Run / Build

Scripts (`package.json` is the source of truth, don't restate them here):
`bun tauri dev` (full app, `beforeDevCommand` serves Vite on `:1420`), `bun dev` (frontend only, no Rust backend), `bun build` (`tsc -b && vite build`), `bun preview`, `bun tauri` (Tauri CLI passthrough), `bun check`, `bun typecheck`.

> **Port note**: `tauri.conf.json` `devUrl` is `http://localhost:1420` with Vite `strictPort`. `bun dev` alone cannot serve `invoke()` calls; use `bun tauri dev` for any IPC/download/db feature.

## Lint & check

- `bun lint` — `oxlint` only (ignores `dist/`, `src-tauri/`, `src/components/ui/`)
- `bun check` — `tsc --noEmit && oxlint && oxfmt --check .`
- `bun fmt` — `oxfmt --write .`

Config: `.oxlintrc.json`, `.oxfmtrc.json` (sorts imports, sorts Tailwind classes via `src/index.css` / `clsx,cn,cva,tv`).

## Testing

- **Frontend**: no test runner, no `*.test.*` under `src/`. Verify with `bun build`.
- **Rust**: `cargo test` from `src-tauri/` (single unit test in `types.rs`, no `tests/` dir).
- Run `bun check` before submitting frontend changes; add `cargo clippy` + `cargo test` when `src-tauri/` changed.

## Structure

- `src/main.tsx` — entry (QueryClientProvider, ThemeProvider, code-based TanStack Router in `src/router.ts`)
- `src/routes/` — `__root`, index, settings (no router plugin, routes wired by hand)
- `src/stores/` — zustand per concern (`useAuthStore`, `useProfileStore`, `useDownloadsStore`, `useHistoryStore`, `usePlacesStore`, `useSettingsStore`, `useUiStore`)
- `src/types/remote.ts` — Zod schemas for Sina API responses; `src/types/rpc.ts` — Tauri IPC shapes; `src/types/gps.ts`
- `src/lib/api.ts` — `invoke()` wrappers (only caller of Tauri commands); `proxy.ts` (img-proxy URL builder); `remote.ts` (image variant picker); `query-client.ts`; `storage-keys.ts` (localStorage keys)
- `src-tauri/src/` — `lib.rs` (builder, plugins, `img-proxy` scheme, command registry), `db.rs` (`weipoint.db` places in app data dir), `download.rs` (semaphore concurrency + backoff + progress events), `image.rs` (proxy handler), `exif.rs`, `motion.rs`, `dates.rs`, `types.rs`, `util.rs`

## Conventions

- Strict TS: `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`/`noUnusedParameters`, `strict`. Use `import type` for types.
- Tauri commands are the IPC boundary: `#[tauri::command]` fns registered in `lib.rs` `invoke_handler!`, called from TS only via `src/lib/api.ts`. `src/types/rpc.ts` mirrors payload shapes by hand; keep it in sync when Rust signatures change.
- Sina API responses are validated with Zod in `src/types/remote.ts` at the fetch boundary (`useProfileStore.ts` fetches `weibo.com/ajax/statuses/mymblog` via `@tauri-apps/plugin-http`, needs a valid cookie).
- Download progress flows Rust `emit("download-progress", DownloadProgressPayload)` → `listen` in `download-progress-panel.tsx`.
- Image proxy: Rust registers the `img-proxy` URI scheme (`lib.rs`); TS builds URLs in `proxyImage()` with a platform split (Windows `http://img-proxy.localhost`, elsewhere `img-proxy://localhost`). New image sources must also be added to the CSP in `tauri.conf.json`.
- External links open in the system browser (navigation plugin in `lib.rs` + `ExternalLinkGuard`); do not add in-app external navigation.
- Server data lives in React Query (`queryClient` defaults: 5min stale, 30min gc, no refetch on window focus); UI/domain state lives in zustand stores. Don't mix the two.
- Styling: Tailwind v4 via `@tailwindcss/vite`; `cn()` helper in `src/lib/utils.ts`.
- shadcn: style `base-nova`, base color `neutral`, phosphor icons (`components.json`).
- Rust lib name `weilens_lib` works around a Windows bin/lib name conflict (see `Cargo.toml`); do not rename.
- Rust taste (unwrap policy, borrow vs clone, iterators, types): `.agents/skills/rust-idioms/SKILL.md`; violations are reject-on-review.

## Comment Style

House style: quiet, intent-first, non-rotting. A stale/wrong comment is worse than none.
Full rule with samples lives in `.agents/skills/comment-style/SKILL.md`; load it before writing or reviewing any comment.

## Committing

Key reminders:

- Run `bun check` (+ `cargo clippy` + `cargo test` if `src-tauri/` changed) before submitting. No green, no merge.
- Do **not** commit `dist/`, `*.local`, `node_modules`, or `weipoint.db` (lives in the app data dir, outside the repo).

## Troubleshooting

- **Blank window that never shows?** The Tauri window starts hidden until the main webview fires `Finished` (`lib.rs` `on_page_load`); the frontend failed to load, check the Vite/devUrl side.
- **`invoke()` fails under `bun dev`?** Expected, no Rust backend there. Use `bun tauri dev`.
- **Weibo API auth failures?** Cookie lives in localStorage (`wei_cookie`); re-check it in settings, both plain and Netscape formats are accepted.
- **Need to test while the app runs?** Never kill or restart the user's running `bun tauri dev`; verify frontend-only via `bun dev` or `bun build` instead.

## Gotchas

- `src-tauri/` is ignored by Vite watch, oxlint, and oxfmt; use cargo tooling for Rust.
- `oxfmt --check` / `oxlint` ignore `src/components/ui/` (shadcn) and `bun.lock`; `tsc` covers `src/` + `vite.config.ts` only.
