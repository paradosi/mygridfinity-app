# mygridfinity.app

Parametric Gridfinity baseplate and bin generator. Server-side OpenSCAD rendering, browser viewer, accounts, saved projects.

## Stack

Next.js 15 · TypeScript strict · Tailwind v4 · shadcn/ui · Postgres 16 · Drizzle · Better Auth · BullMQ · Redis · OpenSCAD (manifold backend) · Cloudflare R2 · Coolify on OVH VPS-2.

## Repo layout

```
apps/
  web/              # Next.js 15 — App Router, RSC by default
  worker/           # Node + BullMQ + OpenSCAD CLI
packages/
  db/               # Drizzle schema + migrations + client
  shared/           # zod schemas + cache key + shared types
docs/
  HANDOFF.md        # why we're building this, what's locked
  SETUP.md          # executable setup checklist
  MCP_AND_TOOLING.md
```

## Local dev

Prereqs: Node 20+, pnpm 11, Docker Desktop, OpenSCAD (local — for verification only).

```bash
pnpm install
docker compose up -d              # postgres + redis
cp .env.example .env              # fill values from your Bitwarden vault (`bw get ...`)
pnpm db:generate
pnpm db:migrate
pnpm dev                          # web + worker in parallel
```

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
```

All three must pass before any commit. `lefthook` enforces this pre-commit (with `gitleaks`).

## Documentation

- [docs/HANDOFF.md](docs/HANDOFF.md) — architecture decisions, what we cut, what's locked
- [docs/SETUP.md](docs/SETUP.md) — VPS hardening, Coolify, repo bootstrap
- [docs/MCP_AND_TOOLING.md](docs/MCP_AND_TOOLING.md) — Claude Code MCPs and helpers
- [CLAUDE.md](CLAUDE.md) — project rules for Claude Code

## License

MIT — see [LICENSE](LICENSE).
