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
