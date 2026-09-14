---
name: comment-style
description: "Use when writing or reviewing code comments: quiet, intent-first, non-rotting style. Not for user-facing docs, changelogs, or AGENTS.md/README (see agent-docs-hygiene)."
license: MIT
metadata:
  version: 1.7.1
  author: shuna
  hermes:
    tags: [comments, style, code-quality, refactoring]
---

# Code Comment Style

## When to Use

Load this skill at the start of every coding session, and
keep its rules in mind while writing, editing, or reviewing any code,
including refactors, new module creation, and code review. It governs the
house style for comments so they stay quiet, useful, and non-rotting.

## Vocabulary

Rules below use generic terms, concrete syntax lives in the language
reference. Examples are schematic only: `//` stands for the line token,
`/* ... */` for the block delimiters, code lines are pseudo-code
placeholders. The same shapes apply to `#`, `--`, and other tokens.

- **Line comment**: a single-line comment token.
- **Block comment**: a delimited multi-line comment.
- **Doc comment**: an API doc comment carrying machine-readable tags
  (params, returns, throws, and equivalents). The tag list is per-language.

## Rules

Apply these rules when writing or editing comments in any language.
For concrete syntax, load the matching reference
(see "Language references").

## Do not write

- **Dividers / banners**: runs of `-`, `=`, `*` used as visual separators,
  with or without text.
- **Numbered/ordered labels in any form**, they rot on reorder/insert/delete; never use order-implying labels in comments. This bans all of: numeric delimiters (`1. X`, `1) X`, `1: X`, `1 - X`, `(1) X`, `[1] X`, `#1 X`), word-form (`Step 1`, `Phase 1`, `Stage 2`, `Part 3`), ordinal words (`First,`, `Second,`, `Third,`), alphabetic (`A. X`, `B) X`, `a) X`), roman (`i) X`, `ii. X`, `IV. X`), circled/emoji digits, fractional (`1/3`, `1 of 3`, `1-3`), and numbered dividers/banners. Do not number at all, make sequence obvious from control flow / early-return / function names. If you must list, use unordered bullets inside a single multi-line block comment, or extract well-named helpers.
- **Doc-block one-liners**: a single plain sentence with no tags never gets block delimiters. Block form is only for comments that actually span multiple lines, with the opener alone on its opening line. A doc comment carrying tags on their own lines is multi-line by nature and correct, not a violation (see the language reference for the tag list).
- **Line-comment blocks**: any comment that spans multiple lines using repeated line-comment tokens, including bullet runs, which are just one form of multi-line line-comment usage. Bullets are fine inside a block comment, but the repeated line prefix is not, collapse the whole thing into one block (see "Multi-line comments as blocks"). A single-line comment on one line is fine; the rule targets repeated line tokens across lines.
- **Non-QWERTY symbols in comments**, no emoji, no em dashes, no en dashes, no smart quotes, no circled numbers, no box-drawing or other non-ASCII glyphs. If you need a pause, use comma or semicolon; for ranges use hyphen-minus `-`. Only characters found on a standard US QWERTY keyboard belong in comments.
- **Refactoring / migration narrative**: comments whose purpose is to explain why a change was made rather than what the code does now ("replaces old X", "migrated from Y", "previously we did Z").
- **Commented-out / dead code**: delete it; version control has history, and a dead block rots into a trap that looks load-bearing.
- **Tool-mandated comments are exempt**: license and copyright headers, linter suppressions, and other comments a tool or build step requires are exempt from the banner and one-liner rules. The suppression vocabulary is per-language (see the language reference). If a suppression comment needs a reason, keep it on the same line or directly above.

## Do write

- **Intent, not mechanics**: comment the why, the constraint, trade-off, or gotcha, not a restatement of what the code obviously does. A line that merely narrates the next statement is noise.
- **Purpose**: one line describing what a module/function/block does.
- **Non-obvious logic**: why a specific algorithm, constant, or edge-case handling exists.
- **Contracts**: preconditions, invariants, return-value semantics that are not evident from the signature.
- **Constraints and ordering**: non-obvious requirements that save a reader from breaking things, such as "must run after X", "not thread-safe", "do not remove, prevents double-fire".
- **References**: links to specs, RFCs, tickets.
- **Single-line comments stay line comments**: a one-sentence comment uses the line token, never a block one-liner, block delimiters are for multi-line thoughts only. Tag-based doc comments are exempt: a doc comment carrying tags is multi-line by nature even when the prose is short, so block form with each tag on its own line is correct, not a violation.
- **Trailing comments add semantics, never restate**: a trailing comment must state something the code does not say (unit, default, constraint, gotcha). A trailing comment that merely narrates the statement is noise and gets deleted.
- **TODO, FIXME, and HACK comments**: allowed, but must describe a concrete condition, not a vague intent.
- **Multi-line comments as blocks**: when a comment spans several lines and the language supports block comments, use one block comment instead of repeating the line-comment token on every line. The exact opener is per-language, and some languages opt out entirely (see the language reference).
- **Block shape is opener alone on its line**: open with the block opener alone, then continuation lines, then the closer. Never put text on the opening line and never write a one-liner block for plain prose with no tags. Tag-based doc comments with tags on their own lines are the intended multi-line form, not one-liners.
- **Generated files are never hand-edited**: a comment fix in generated output means fixing the generator or source, not the file. The generated-file patterns are per-language (see the language reference).

## Language references

Concrete syntax, tag lists, suppression vocabulary, block shape, and
generated-file patterns live in the references, not here. SKILL.md is
self-contained and copy-safe: to reuse it in a single-language project,
delete the references you do not need and drop their table rows, no
other edits needed.

| File                       | When to load                   |
| -------------------------- | ------------------------------ |
| `references/typescript.md` | TypeScript or JavaScript files |
| `references/rust.md`       | Rust files                     |
| `references/css.md`        | CSS or SCSS files              |

## Examples

Schematic only. `//` is the line token, `/* ... */` the block delimiters,
code lines are pseudo-code. Copy-paste-ready examples in real syntax
live in the language references.

```
// BAD: dividers plus refactoring narrative
// ----------
// Merge results - replaces the old cache!
// ----------
merge_cached(...)

// GOOD: one sentence stays a line comment
// Merge cached items into the shared list.
merge_cached(...)

// BAD: block delimiters for a single sentence
/* Return the initialized handle. */

// GOOD: one sentence stays a line comment
// Return the initialized handle.
get_handle(...)

// BAD: refactoring narrative describes history, not current behavior
// The old holder grew too large so we split it.

// BAD: numbered steps force a renumber when one moves
// Normalize the request:
// 1. Coerce field A for the callee.
// 2. Drop field B when rejected.

// GOOD: unordered bullets, each line removable without renumbering
/*
 * Normalize the request:
 * - Coerce field A for the callee.
 * - Drop field B when rejected.
 */

// BAD: numbered labels force a renumber when one moves
// 1) primary source
// 2) fallback scan

// GOOD: no numbers, sequence is obvious from the helper names
// primary source first
// fallback via slow scan

// GOOD: even better, extract well-named functions, no step list needed
coerced = coerce_field_a(payload)
cleaned = drop_field_b(coerced)

// BAD: N line-comment tokens for one thought
// Build the lookup from the cache.
// Skip deprecated entries.
table = build_table(cache)

// BAD: text on the opening line
/* Shared retry defaults: pushes are fresh, so a
 * short staleness window suffices. */

// GOOD: opener on its own line, where the language supports it
/*
 * Shared retry defaults: pushes are fresh, so a
 * short staleness window suffices.
 */
table = build_table(cache)

// BAD: multi-line line-comment block, even with bullets
// Transient-only state, never persisted:
// - hover highlight (transient)
// - detail open/close (ephemeral)

// GOOD: bullet affordance preserved inside a block
/*
 * Transient-only state, never persisted:
 * - hover highlight (transient)
 * - detail open/close (ephemeral)
 */
```

```
// BAD: dead code looks load-bearing, rots fast
// cached = lookup(key)

// GOOD: delete it, version history has it if needed

// BAD: narrates mechanics the code already says
// loop over items and add each to the table
for each item: table.add(item)

// GOOD: states the non-obvious why (dedupe, keep highest scoring)
// last write wins, duplicate ids resolve to the higher-scored entry
for each item: table.add(item)

// GOOD: trailing comment adds semantics (unit, default)
timeout = get_timeout(5000)  // 5s by default

// BAD: trailing comment restates the statement, delete it
count += 1  // increment count

// GOOD: TODO and HACK point forward with a concrete condition
// HACK: remove once #4213 is fixed
result = patch_legacy(data)

// BAD: vague TODO, just delete it
// TODO: clean this up later
```

## Rationale

- Dividers add visual noise without information
- Refactoring comments age poorly, they describe history, not current behavior
- Numbered step comments rot the moment steps are reordered, inserted, or deleted
- Repeating the line-comment token N times is more noise than one block delimiter
- Commented-out code is a trap, it looks intentional and silently rots
- A stale or wrong comment is worse than none: readers trust comments, so a lie spreads
- Future readers care about what the code does, not how we got here
- Version history preserves the past if anyone needs it

## Enforcement

- During code review, flag any comment matching the "Do not write" patterns
- Prefer deleting bad comments over rewriting them, less is more
- If you change code, update or delete its comment, a wrong comment is worse than none
- If a block needs structure, use separate well-named functions instead of banner comments
