# CSS

Load this reference when the file is CSS, in addition to the generic rules
in SKILL.md.

- **No line comments in plain CSS**: every comment is `/* ... */`.
  Single-line `/* ... */` is the normal form, not an exception to any rule.
- **Multi-line notes use one block**: opener alone on its line, then
  ` * ...` lines, then ` */`, same shape as other languages.
- **Never `/** ... */`**: the double-star opener has no doc meaning in CSS,
  always use single-star `/*`.
- **All bans apply equally**: dividers, numbered labels, refactoring
  narrative, dead code, non-QWERTY symbols, and the intent-first
  requirement hold for `/* ... */` comments too.
- **SCSS is different**: `.scss` files support `//` line comments, so the
  generic line-comment rules apply there with `//` as the line token.

```css
/* GOOD: single-line /* ... */ is the normal CSS form, not a violation */
/* Primary - industrial blue */
--color-primary: #1d4ed8;

/* GOOD: multi-line note is one block, opener alone on its line */
/*
 * Focus ring stays visible on dark tiles,
 * do not remove for aesthetic reasons.
 */
:focus-visible {
  outline: 2px solid var(--color-accent);
}

/* BAD: double-star opener means nothing in CSS, use single-star */
/** Sidebar tokens, muted neutrals. */
```
