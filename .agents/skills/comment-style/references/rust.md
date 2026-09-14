# Rust / rustdoc

Load this reference when the file is Rust, in addition to the generic rules
in SKILL.md.

- **The block-collapse rule does not apply to doc comments**: Rust docs use
  `///` (items) and `//!` (modules), and repeated `///` / `//!` lines are
  idiomatic Rust. Never rewrite them into a `/* ... */` block. The generic
  "multi-line comments as blocks" rule covers only plain `//` comments.
- **All bans apply equally to `//` and `///`**: dividers, numbered labels,
  refactoring narrative, dead code, non-QWERTY symbols, and the intent-first
  requirement hold for doc comments too.
- **rustdoc section headers stay `///` lines**: `# Panics`, `# Errors`,
  `# Safety`, and `# Examples` are convention, keep each on its own `///`
  line, never renumber or restructure them into bullets.
- **Suppressions are tool-mandated**: `#[allow(...)]` (and similar
  attributes) are exempt from the banner and one-liner rules. Keep the
  reason on the same line or directly above.

```rust
// BAD: collapsing idiomatic /// docs into a block
/*
 * Retries the request with backoff.
 * Honors the server-sent retry-after header.
 */
fn retry(req: &Request) -> Result<Response> { ... }

// GOOD: repeated /// lines are idiomatic Rust, leave them alone
/// Retries the request with backoff.
/// Honors the server-sent retry-after header.
fn retry(req: &Request) -> Result<Response> { ... }

// GOOD: rustdoc section headers stay as /// lines
/// Opens the device and negotiates the session key.
///
/// # Errors
/// Returns `Error::Timeout` when the device does not respond in time.
///
/// # Safety
/// The caller must hold the bus lock for the whole call.
unsafe fn open() -> Result<Handle> { ... }

// GOOD: suppression with a reason, exempt from the banner and one-liner rules
#[allow(dead_code)] // kept for the upcoming multiplexing work
fn fallback_by_port() { ... }
```
