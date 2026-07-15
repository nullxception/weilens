# Changelog

## [0.2.0] - 2026-07-16

### Added

- Onboarding flow and enhanced settings panel
- Motion animations on onboarding, app shell, BlogFeed, image viewer, and location dialog
- AnimatePresence for BlogFeed state transitions
- Settings view (transitioned from modal to dedicated view)
- Image loading states and skeleton placeholders
- Stateful UID tracking and feed transitions
- Clickable user screen name to open profile
- Per-post download cancellation
- Medium-width image loading in viewer
- Lazy-loaded BlogFeed with extended view types for explore/downloads
- PA-san branding

### Changed

- Migrate profile state from hook to zustand store
- Split appStore into domain-specific stores
- Split BlogCard into smaller components
- Introduce DownloadTask struct to encapsulate download state
- Internalize history management in HistoryPanel
- Centralize tauri invoke usage in api.ts
- Centralize remote image utility functions
- Centralize fallback user agent
- Rename profile lookup hook and migrate types to remote
- Rename crate from tauri_native_lib to weilens_lib
- Synchronize backend and frontend schema properties
- Update image handling to use Pic type and explicit dimensions
- Optimize dewatermark
- Use webview user-agent for all HTTP requests
- Remove redundant request headers from image proxy
- Adjust image viewer layout and loader positioning
- Reduce default window dimensions
- Reduce width of download progress bar
- Update shadcn theming
- Replace magic strings and unwraps with proper error types
- Simplify iterator usage in db and motion modules
- Simplify download path handling and remove unused host parsing
- Simplify metadata error handling
- Stabilize search view key for animations
- Add dev and build vscode tasks and zed config files
- Improve component typing and fix react-hooks warnings
- Update prettier and reformat files
- Add AGENTS.md with project structure and verification details

### Fixed

- Mux failure partial success, proxy timeout, DB race
- Abort HTTP requests immediately on cancel via tokio::select
- Improve download cancellation coverage
- Correct ExifVersion tag encoding
- Add missing response headers to image proxy
- Resolve set-state-in-effect lint errors
- Fix clippy warnings

### Performance

- Optimize image delivery and loading performance
- Streamline URL segment extraction

## [0.1.5] - 2026-07-11

### Added

- Initial support for MotionPhoto muxing
- Few EXIF Randomization
- Infinite scroll on blog feed
- Fullscreen image viewer for blog card images
- Option to select watermark position to remove
- Custom coordinate saving feature
- Cookie setup dialog
- Confirmation dialog for destructive actions

### Changed

- Migrate places state from zustand to backend with pagination
- Store places in SQL
- Centralize localStorage keys
- Streamline EXIF patching
- Remove limit on recent profiles and places
- Restructure preferred image loading for blog
- Miscellaneous UI improvements

### Fixed

- Forward upstream cache headers in img-proxy
- Image aspect ratio
- Blog custom emoji size

## [0.1.0] - 2026-07-08

- Initial release
