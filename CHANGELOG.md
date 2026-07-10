# Changelog

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
