# Changelog

All notable changes to EasyJSSDK will be documented in this file.

## [Unreleased]

## [2.0.5] - 2026-09-08

### Fixed
- Settle failed WebSocket handshakes when the transport emits `error` without `close`, allowing bounded automatic retries to continue on native Node WebSocket. Late close callbacks remain fenced to their original connection generation.
- Document native/global WebSocket selection in Node and add real TCP handshake regression coverage for Node 22.12.0, 24.3.0, and the `ws` transport.

## [2.0.4] - 2026-09-01

### Fixed
- Isolated WebSocket connection generations so callbacks from an older socket cannot alter a newer connection
- Continued automatic reconnection after failed retry attempts instead of stopping permanently
- Completed manual disconnect once and prevented duplicate lifecycle listeners across reconnects
- Repaired the browser examples and rejected malformed events that omit required fields

### Security
- Raised the optional Node.js `ws` dependency to `^8.21.3` to exclude the vulnerable ranges in GHSA-58qx-3vcg-4xpx and GHSA-96hv-2xvq-fx4p

## [2.0.3] - 2026-08-31

### Fixed
- Disabled SDK logging by default and prevented tokens, payloads, raw frames, response bodies, and platform error objects from reaching console output
- Replaced raw event, identifier, and error logging in shipped examples and event-protocol documentation with fixed operational statuses

## [2.0.2] - 2026-08-28

### Added
- Pull request CI that runs the JavaScript test suite and TypeScript builds

### Changed
- Publishing now uses a single version-tag trigger and fails when tests fail
- Publishing pins npm 11 to remain compatible with the Node.js 20 release runner

### Fixed
- Aligned device flag documentation, examples, and JSON schema with WuKongIM: APP `0`, WEB `1`, and PC/Desktop `2`
