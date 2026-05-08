# Changelog

All notable changes to this project will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial monorepo scaffold: Next.js 15 web app, Node BullMQ worker, Drizzle db package, shared zod package.
- Root tooling: pnpm workspaces, Turbo, TypeScript strict, lefthook + gitleaks pre-commit, GitHub Actions CI.
- `docker-compose.yml` for local Postgres 16 + Redis 7.
- Handoff documentation (`docs/HANDOFF.md`, `docs/SETUP.md`, `docs/MCP_AND_TOOLING.md`).

### Changed
- Switched secret store from 1Password to Bitwarden (`bw` CLI). Updated `CLAUDE.md`, `docs/HANDOFF.md`, `docs/SETUP.md`, `docs/MCP_AND_TOOLING.md`, `README.md`. Vault item naming convention documented in `docs/MCP_AND_TOOLING.md`.

### Vendored
- `apps/worker/scad/gridfinity-rebuilt-openscad` — pinned to upstream `910e22d860` (tag `2.0.0`, 2025-08-31). All six v1 baseplate parameters (`gridx`, `gridy`, `style_plate`, `enable_magnet`, `chamfer_holes`, `crush_ribs`) verified present at this SHA.

### Added (V1 step 3 — worker render path)
- `packages/shared/src/schemas/baseplate.ts` — zod `BaseplateParamsSchema` with strict bounds and `style_plate` string→int mapping for OpenSCAD.
- `packages/shared/src/cache-key.ts` — `cacheKey(modelType, params)` = `<modelType>/v<schemaVersion>/<sha256(canonical(params))>`.
- `apps/worker/src/render.ts` — `renderBaseplate()` spawns OpenSCAD CLI with `-D` defines, working dir = SCAD library root, 60s timeout, writes STL to local cache, returns `{ stlPath, cacheKey, durationMs, bytes }`. Cache hit short-circuits without re-rendering. `RenderError` carries `.code` and `stderr`.
- `apps/worker/src/queue.ts` — BullMQ `Worker` on `render` queue, concurrency from env (default 1), wraps `renderBaseplate`.
- `apps/worker/src/index.ts` — boot queue worker with SIGTERM/SIGINT graceful drain.
- `apps/worker/src/scripts/smoke.ts` — non-queue smoke: renders the smallest baseplate end-to-end via real OpenSCAD.
- Smoke verified: 1×1 thin plate → 141 KB STL in ~2.3s. Cache hit on re-run: 0 ms.
- E2E verified: BullMQ job (gridx=2, gridy=2, weighted, magnets on) → worker rendered 1.2 MB STL in ~8.6s.
