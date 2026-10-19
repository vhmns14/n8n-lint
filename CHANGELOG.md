# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-10-19

### Added

- CLI `n8n-lint [paths]` for n8n workflow exports (single workflow or `export:workflow --all` arrays).
- 17 rules:
  - security: `hardcoded-secret`, `webhook-no-auth`, `pin-data`, `insecure-http`, `dangerous-code`, `embedded-credentials`
  - reliability: `unhandled-errors`, `http-resilience`, `unreachable-node`, `disabled-node`, `duplicate-node-name`, `no-trigger`, `large-code-node`
  - hygiene: `default-node-name`, `missing-metadata`, `outdated-type-version`, `deprecated-node`
- Output formats: pretty, JSON, SARIF 2.1.0, GitHub Actions annotations; `--sarif` to write SARIF alongside another format.
- `--fail-on` severity threshold and exit codes 0/1/2.
- `--fix` (pinData), `--fix-disabled`, `--fix-names`.
- `.n8nlintrc.json` with per-rule severity and options, ignore globs, and per-file overrides.
- Inline disables through node notes (`n8n-lint-disable`) and sticky notes (`n8n-lint-disable-workflow`).
- Composite GitHub Action with optional SARIF upload, and three workflow templates.

[Unreleased]: https://github.com/vhmns14/n8n-lint/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/vhmns14/n8n-lint/releases/tag/v0.1.0
