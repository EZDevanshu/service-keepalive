# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-16

### Added

- **Core Library (`KeepAlive`)**:
  - Programmable keep-alive scheduler with explicit `.start()`, `.stop()`, and `.pingOnce()` lifecycle.
  - Native `fetch` HTTP requests with zero heavy network dependencies.
  - Accurate high-resolution response timing via `performance.now()`.
  - Configurable timeouts using `AbortController`.
  - Configurable HTTP methods, custom headers, and optional request bodies.
  - Status matcher validation (default 2xx range, custom status code lists, or custom predicate functions).
- **Multi-Service Manager (`MultiKeepAlive`)**:
  - Support for monitoring and pinging multiple endpoints simultaneously with individual or shared schedules.
- **Intelligent Retries**:
  - Exponential, linear, and fixed backoff strategies with ±20% randomized jitter.
  - Maximum delay boundaries and cancellable sleep timers.
- **Human-Readable Duration Parsing**:
  - Supports `ms`, `s`, `m`, `h`, `d` (e.g. `10s`, `1m`, `5m`, `10m`, `1h`, `500ms`).
  - Strict validation guarding against zero, negative numbers, and malformed strings.
- **CLI & NPX Support**:
  - Executable `service-keepalive` binary.
  - Flags for `--url`, `--interval`, `--timeout`, `--method`, `--retries`, `--retry-delay`, `--header`, `--config`, `--once`, `--quiet`, `--verbose`.
  - Signal trapping for clean `SIGINT` (Ctrl+C) and `SIGTERM` shutdown.
- **Configuration & Environment Variables**:
  - Automatic loading of `keepalive.config.json`, `.keepaliverc`, and `.js`/`.mjs`/`.cjs` config files.
  - Environment variable overrides (`KEEPALIVE_URL`, `KEEPALIVE_INTERVAL`, `KEEPALIVE_TIMEOUT`, etc.).
- **Security & Secret Masking**:
  - Automatic redaction of sensitive request headers (`Authorization`, `Cookie`, `X-Api-Key`, `Token`, `Secret`) and URL query parameters in logs.
- **Developer Experience & Tooling**:
  - Dual ESM and CommonJS bundle via `tsup` with `.d.ts` and `.d.cts` declarations.
  - Comprehensive deterministic test suite powered by Vitest and local mock HTTP servers.
  - ESLint 9 flat config + Prettier.
  - Production-ready Dockerfile and GitHub Actions workflows (`ci.yml`, `keepalive.yml`, `publish.yml`).
