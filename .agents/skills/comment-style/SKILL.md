---
name: comment-style
description: >
  Use when writing or reviewing code comments in WeiLens: quiet, intent-first, non-rotting. TS and Rust variants.
---

# Comment Style (WeiLens)

Source of truth for comment taste in this repo. AGENTS.md points here; this
file is the rule, not a suggestion. A stale or wrong comment is worse than
none: readers trust comments, so a lie spreads.

## Never write

- **Dividers / banners**: `// ---- something ----`, `// ========`,
  `// *** ... ***`, `// --- accessors ---`.
- **Numbered/ordered labels in any form**. They rot on reorder/insert/delete.
  This bans numeric delimiters (`// 1. X`, `// 1) X`, `// 1: X`, `// 1 - X`,
  `// (1) X`, `// [1] X`, `// #1 X`), word-form (`// Step 1`, `// Phase 1`,
  `// Stage 2`, `// Part 3`), ordinal words (`// First,`, `// Second,`,
  `// Third,`), alphabetic (`// A. X`, `// B) X`), roman (`// i) X`, `// IV. X`),
  fractional (`// 1/3`, `// 1 of 3`), and numbered dividers
  (`// --- 1. Setup ---`). Do not number at all: make sequence obvious from
  control flow, early-return, or well-named helpers
  (`parse_plain_pair()` then `parse_netscape_jar()`).
- **Non-QWERTY symbols in comments**: no emoji, no em/en dashes, no smart
  quotes, no box-drawing or other non-ASCII glyphs. For a pause use comma or
  semicolon; for ranges use hyphen-minus `-`.
- **Refactoring / migration narrative**: `replaces old X`, `migrated from Y`,
  `previously we did Z`. Describe what the code does now, not the history.
  Git has history.
- **Commented-out / dead code**: `// const x = oldThing()`. Delete it.

```ts
// BAD: numbered steps rot when one moves
// 1) plain pair
// 2) Netscape jar

// GOOD: no numbers, sequence from helper names
// plain pair first, common case
// fallback to Netscape jar, per useAuthStore parsing
```

## Always write

- **Intent, not mechanics**: the why, constraint, trade-off, or gotcha.
  A line restating the next statement is noise.
- **Purpose**: one line for a module/fn/block.
- **Non-obvious logic**: why this constant, algorithm, or edge-case exists.
- **Contracts**: preconditions, invariants, return semantics not evident
  from the signature.
- **Constraints and ordering**: `must run after X`, `not thread-safe`,
  `do not remove, prevents double-fire`.
- **References**: spec, RFC, ticket (Sina `mymblog` response shape, Nominatim usage policy).
- **TODO / FIXME / HACK**: allowed only with a concrete condition
  (`HACK: remove once upstream fixes #4213`), never vague
  (`TODO: clean this up later`).

```ts
// BAD: narrates mechanics the code already says
// loop over pic infos and pick the largest variant
for (const p of pics) pick(p);

// GOOD: states the non-obvious why
// Sina larges carry watermarks, oslarge is the clean fallback
for (const p of pics) pick(p);
```

## TS block rule (src only)

- A single sentence stays `//`, never a `/** ... */` one-liner.
- A multi-line thought collapses into one `/** ... */` block: opener `/**`
  alone on its line, then ` * ...` lines, then ` */`. Never text on the
  opening line, never repeated `//` across lines for one thought.
- Dash bullets live inside the block, not as `// -` lines.
- JSDoc with tags (`@param`, `@returns`, `@throws`) stays multi-line block
  form with each tag on its own line, even when prose is short.
- Exceptions: inline single-line `/* best-effort */` inside a function,
  CSS single-line `/* ... */` (one star, never `/**`).

```ts
// BAD: text on the /** opening line
/** Shared query defaults: no backend push, so the
 * fetches need a modest staleness window. */

// GOOD: opener alone, then * lines
/**
 * Shared query defaults: no backend push, so the
 * fetches need a modest staleness window.
 */
```

## Rust notes

- Rust docs use `///` (items) and `//!` (modules). The TS `/** */` collapse
  rule does not apply; repeated `///` lines are idiomatic Rust.
- The bans above (dividers, numbering, narrative, dead code, non-QWERTY,
  intent-first) apply equally to `//` and `///` comments.
- Tauri command impls (`download_post`, `list_places`, `set_blog_place`)
  comment the IPC-relevant invariant, not the Tauri plumbing.

## Tool-mandated comments are exempt

License/copyright headers, eslint-disable / `@ts-ignore` / `#[allow(...)]`
directives, and anything else a tool requires are exempt from the banner and
one-liner rules. Keep a suppression reason on the same line or directly above.

## During review

Flag any ban above. Prefer deleting bad comments over rewriting them; less is
more. If you change code, update or delete its comment. If a block needs
structure, extract well-named functions instead of banner comments.
