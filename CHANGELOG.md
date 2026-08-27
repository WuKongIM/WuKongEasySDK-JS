# Changelog

All notable changes to EasyJSSDK will be documented in this file.

## [2.0.2] - 2026-08-28

### Added
- Pull request CI that runs the JavaScript test suite and TypeScript builds

### Changed
- Publishing now uses a single version-tag trigger and fails when tests fail
- Publishing pins npm 11 to remain compatible with the Node.js 20 release runner

### Fixed
- Aligned device flag documentation, examples, and JSON schema with WuKongIM: APP `0`, WEB `1`, and PC/Desktop `2`
