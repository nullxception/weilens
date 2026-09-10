---
name: rust-idioms
description: >
  Use when writing or reviewing Rust in WeiLens src-tauri/src/: unwrap policy, borrow vs clone, slice params, error handling, iterators.
---

# Rust Idioms (WeiLens `src-tauri/src/`)

Source of truth for Rust taste in this repo. AGENTS.md points here; this file
is the rule, not a suggestion. Violations are reject-on-review.

## Error handling

- No `.unwrap()` in `src-tauri/src/**` outside `#[cfg(test)]`. Use `?` + `thiserror`.
- `.expect()` only for invariants that mean "bug if hit", with a reason string:
  `app.path().app_data_dir().expect("app data dir available")`. Never for user input or I/O.
- `Mutex::lock().unwrap()` is allowed only when poisoning means bug; prefer
  `expect("lock poisoned")` so the reason is explicit.
- Return `Result<T, E>` for fallible ops. No `panic!` on expected errors.
- Domain errors via `thiserror` (`DownloadError` in `types.rs`); map external
  errors at the Tauri command boundary into `String` or `DownloadError` with
  enough context to identify the post and item.

```rust
// BAD: unwrap on fallible I/O
let conn = Connection::open(db_path).unwrap();

// GOOD: propagate with ?
let conn = Connection::open(db_path)?;
```

## Borrow vs clone

- Params take `&str` not `&String`, `&[T]` not `&Vec<T>`, `&Path` not `&PathBuf`.
- No `.clone()` to satisfy the borrow checker. Borrow or restructure first.
  A `clone()` needs a reason: ownership transfer, `spawn`/`move`, retained copy
  (Tauri managed state, progress payloads, retry state).
- `format!()` never for static strings. No `format!` in hot paths; use
  `write!` into a buffer or a literal.

```rust
// BAD: clone to shut up borrowck
fn f(v: &Vec<String>) { let w = v.clone(); g(&w); }

// GOOD: borrow
fn f(v: &[String]) { g(v); }
```

## Control flow

- Use `?`, `let-else`, and `matches!()` over nested `match` for early return
  and boolean pattern tests.
- Iterators over manual indexing. No intermediate `.collect()` between
  iterator adapters; collect once at the end.
- Map insert-or-update via the entry API (`entry().or_insert_with`).
- `if let` chains over nested `if let` pyramids.

```rust
// BAD: nested match for early return
match opt { Some(v) => v, None => return Ok(()), }

// GOOD: let-else
let Some(v) = opt else { return Ok(()); };
```

## Types

- No new `Box<dyn Trait>`; prefer `impl Trait` or generics at boundaries.
- No stringly-typed APIs; use enums or newtypes for domain values.
  Tauri command payloads stay typed structs (`DownloadItem`, `Place`); status
  strings on the wire (`DownloadProgressPayload.status`) mirror
  `DownloadProgressStatus` in `src/types/rpc.ts`, keep both in sync by hand.
- Accept `impl Into<T>` / `impl AsRef<T>` at ergonomic boundaries, implement
  `From<T>` (never bare `Into`).

## Module imports (`use`)

- Functions import parent modules (`use crate::dates; dates::parse_date()`).
- Structs, enums, traits, and macros import directly (`use std::path::PathBuf; PathBuf`,
  `use serde::Deserialize; Deserialize`, `use std::sync::Arc; Arc`).
- Never use fully qualified paths in signatures, derives, or generics
  (`std::path::PathBuf`, `#[derive(serde::Serialize)]` are violations).
- Prelude clashes (e.g. `std::io::Result`) import the parent module
  (`use std::io; io::Result<Value>`).

## Observability

- `log` macros (`log::info!`, `log::warn!`, `log::error!`) via
  `tauri-plugin-log`, never `println!` in command paths.
- Log each error once, with post/item context. Never log cookie values or
  full download URLs with auth material; the cookie lives in the frontend
  store, not in Rust logs.

## During review

Flag any ban above. Prefer deleting the offending construct over working
around it. If new code adds a `#[allow(clippy::...)]`, the reason sits on the
same line and the exception is narrow, never module-wide.
