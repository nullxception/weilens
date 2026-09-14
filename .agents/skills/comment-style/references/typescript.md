# TypeScript / JSDoc

Load this reference when the file is TypeScript or JavaScript, in addition to
the generic rules in SKILL.md.

- **One sentence stays `//`**: a single plain sentence with no tags never
  gets `/** ... */` delimiters. Block form is only for comments that
  actually span multiple lines, with `/**` alone on its opening line.
- **JSDoc with tags is multi-line by nature**: a doc comment carrying tags
  (`@param`, `@returns`, `@throws`, or similar) uses multi-line block form
  with each tag on its own line, even when the prose is short. Never collapse
  it to a one-liner.
- **Block shape is opener alone on its line**: open with `/**` alone, then
  ` * ...` lines, then ` */`. Never put text on the opening line and never
  write a one-liner block for plain prose with no tags.
- **Suppressions are tool-mandated**: `eslint-disable`, `@ts-ignore`,
  `@ts-expect-error`, and `biome-ignore` directives are exempt from the
  banner and one-liner rules. If a suppression needs a reason, keep it on
  the same line or directly above.
- **Generated files are never hand-edited**: `routeTree.gen.ts`, `*.gen.ts`,
  `dist/`, `build/`, and similar generated output. Fix the generator or
  source instead.

```ts
// BAD: block delimiters for a single sentence with no tags
/** Return the initialized database handle. */

// GOOD: one sentence stays a // line comment
// Return the initialized database handle.
export function getDb() { ... }

// BAD: text on the opening line
/** Shared options: pushes carry fresh data, so the
 * fetches only need a modest staleness window. */

// GOOD: opener alone on its line
/**
 * Shared options: pushes carry fresh data, so the
 * fetches only need a modest staleness window.
 */
export const queryDefaults = { ... };

// GOOD: JSDoc with tags is multi-line by nature, exempt from one-liner ban
/**
 * @param id Entry identifier, must already exist in the cache.
 * @returns Cached items for the entry, empty array if none loaded.
 */
export function getItemsFor(id: string) { ... }

// BAD: repeated // across lines for one thought
// Build the lookup table from the cached list.
// Skip entries marked as deprecated.
const table = buildTable(cache);

// GOOD: one block comment instead of repeated // tokens
/**
 * Build the lookup table from the cached list.
 * Skip entries marked as deprecated.
 */
const table = buildTable(cache);

// GOOD: suppression with a reason, exempt from the banner and one-liner rules
// eslint-disable-next-line no-explicit-any -- upstream type is untyped
const raw = parseLoose(input) as any;
```
