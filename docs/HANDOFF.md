# mygridfinity.app — Project Handoff

> Single source of truth for Claude Code picking up this project. Read this first.

## What we're building

A parametric Gridfinity bin and baseplate generator, web-based, with accounts and saved projects. Reference for the feel we want: https://gridfinity.perplexinglabs.com/

This is a clean rewrite of the previous `paradosi/mygridfinity-app`. The old repo is archived, not extended.

## What we explicitly cut from the old repo

The previous version tried to do too much. These features are **not** part of v1 and should not be reintroduced unless explicitly asked:

- **Trace** — photo-to-cutout pipeline (OpenCV.js / VTracer / ONNX in the browser)
- **5S** — workshop audit features
- **Browser-side CAD** — `openscad-wasm`, `manifold-3d`, `opencascade.js`. We do **not** run CAD in the browser.

The old `packages/cad-engine`, `packages/trace-engine`, `packages/export-engine` structure is gone. Cherry-picking specific small components from the archive is fine; wholesale copying is not.

## Architecture decisions (locked)

These were debated and decided. Don't re-litigate them without a concrete reason.

### Server-side OpenSCAD rendering

- OpenSCAD CLI runs on the VPS, not in the browser.
- Modern OpenSCAD with the **manifold backend** for fast renders.
- Render workers consume from a BullMQ + Redis queue.
- STLs cached in Cloudflare R2 by parameter hash. Same params → same key → instant return.
- Browser viewer is `@react-three/fiber` + `STLLoader` displaying a finished STL only — no CAD compute in the browser.

### Stack (locked)

- **Framework:** Next.js 15 (App Router, RSC, Server Components by default)
- **Language:** TypeScript strict
- **Styling:** Tailwind v4 + shadcn/ui (extend, don't fork)
- **Database:** Self-hosted Postgres 16 on the VPS
- **ORM:** Drizzle (covers both auth and app schema)
- **Auth:** Better Auth with Drizzle adapter — email/password + Google OAuth
- **Queue:** BullMQ on Redis
- **Storage:** Cloudflare R2 (S3-compatible) for STL cache
- **Email:** Resend (transactional — verify, password reset)
- **Hosting:** OVH VPS-2 (US East / Vint Hill), Coolify-managed
- **CI:** GitHub Actions (typecheck, lint, test, gitleaks)
- **Admin access:** Tailscale-only

### Repository

- **Host:** GitHub (moving away from GitLab for this project)
- **Org/owner:** `paradosi`
- **Name:** `mygridfinity-app`
- **Domain:** `mygridfinity.app`
- **License:** MIT

### Gridfinity SCAD library

- **Vendored** as a git submodule at `apps/worker/scad/gridfinity-rebuilt-openscad`
- **Source:** https://github.com/kennetek/gridfinity-rebuilt-openscad
- **Pin to a specific commit SHA**, not a branch. Renders must be deterministic across deploys.

### What we rejected and why (so it doesn't come back)

- **Replicad / OpenCascade.js in the browser** — interesting tech, but a 25 MB WASM bundle plus rewriting all gridfinity geometry against a new API was too much scope for v1. Server-side OpenSCAD reuses the existing well-tested SCAD libraries.
- **Rust + Yew like Perplexing Labs** — owner is a TypeScript developer; rewriting in Rust adds months of yak-shaving for zero performance benefit (the OpenSCAD subprocess is the bottleneck regardless of language).
- **Supabase** — added vendor-SDK complexity, two-DB-connection patterns, and RLS overhead. Self-hosting Postgres + Better Auth on the existing VPS is operationally simpler and aligns with how the owner already runs infrastructure.
- **Anonymous-first / no accounts** — early framing that didn't survive contact with "users want to save and come back to projects."
- **Vercel / CF Pages / Workers** — execution time limits make them wrong for OpenSCAD renders that can take 10–30 seconds.

## V1 scope

**Goal:** ship a fast, elegant baseplate generator end-to-end. Nothing else until that works.

### V1 = baseplate only

Five user-facing controls:

1. **Size** — gridx (1–20) × gridy (1–20)
2. **Style** — thin / weighted / skeletonized / screw_together / screw_together_minimal
3. **Magnet holes** — on/off
4. **Supportless magnet holes** — on/off (`chamfer_holes`)
5. **Crush ribs** — on/off

Screw-together specifics (`d_screw`, `screw_spacing`, `n_screws`) get sensible defaults and are NOT exposed in the UI for v1.

### V1 features in order

1. Repo skeleton + tooling that builds clean
2. Postgres + Redis running locally via docker compose
3. Worker that renders one baseplate STL via OpenSCAD CLI to local disk
4. R2 upload from worker
5. API route `POST /api/render` with R2 cache check + queue enqueue
6. API route `GET /api/render/[jobId]` for polling
7. STL viewer page (Three.js) with parameter form
8. Better Auth: email/password + email verification flow
9. Google OAuth
10. Saved projects table + "My Projects" page
11. Public project sharing via `/p/<slug>` URLs

Stop and ship after each step works. Don't build ahead.

## Architecture diagram

```
                    ┌─────────────┐
                    │  Cloudflare │  DNS, optional proxy (flip-able)
                    │     DNS     │
                    └──────┬──────┘
                           ↓
                  ┌────────────────┐
                  │   OVH VPS-2    │
                  │  (Coolify)     │
                  │                │
                  │  ┌──────────┐  │
                  │  │ Next.js  │──┼──── Better Auth + Drizzle ───┐
                  │  └─────┬────┘  │                              ↓
                  │        ↓       │                       ┌────────────┐
                  │  ┌──────────┐  │                       │ Postgres 16│
                  │  │  Redis   │  │  ←─────────────────── │            │
                  │  │ (BullMQ) │  │                       └────────────┘
                  │  └─────┬────┘  │
                  │        ↓       │
                  │  ┌──────────┐  │   exec OpenSCAD CLI
                  │  │  Worker  │──┼──→ → STL
                  │  └─────┬────┘  │
                  └────────┼───────┘
                           ↓
                    ┌──────────────┐
                    │ Cloudflare R2│  parameter-hash keyed
                    │ (STL cache)  │
                    └──────────────┘

  Tailscale: admin SSH + Coolify dashboard (no public ports)
  GitHub Actions: CI on push/PR
  Resend: transactional email
```

## Repo layout

```
mygridfinity-app/
├── .github/workflows/ci.yml
├── .editorconfig
├── .env.example
├── .gitignore
├── .npmrc
├── CLAUDE.md                        # rules for Claude Code
├── LICENSE
├── README.md
├── docker-compose.yml               # local dev: postgres + redis
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── turbo.json
├── apps/
│   ├── web/                         # Next.js 15
│   └── worker/                      # Node + BullMQ + OpenSCAD CLI
│       ├── Dockerfile
│       └── scad/
│           └── gridfinity-rebuilt-openscad/   # git submodule
├── packages/
│   ├── db/                          # Drizzle schema + migrations + client
│   └── shared/                      # zod schemas + cache key + types
└── docs/
    ├── HANDOFF.md                   # this file
    ├── SETUP.md                     # executable setup checklist
    ├── ARCHITECTURE.md              # render flow detail
    └── DEPLOY.md                    # Coolify runbook
```

## Critical security rules (non-negotiable)

These exist because the owner had a real Cloudflare account compromise on 2026-05-02 — a stolen API token was used to deploy a malicious Worker serving ClickFix to ~63k page-loads over 9 days. The lessons are baked into how this project handles credentials.

**See `~/.claude/CLAUDE.md` (global v1.4.0+) for the full security rules. Project-specific reinforcements:**

- **NEVER write a real token, API key, password, or secret into any file in this repo.** Not in code, not in `.env.example`, not in tests, not in markdown.
- `.env.example` contains placeholder names with empty values only.
- Real secrets live in the owner's Bitwarden vault (local dev) or Coolify env vars (prod). Reference by env var name only.
- Tokens created for this project must have: 90-day expiry, narrow scope (single resource where possible), IP allowlist where the issuer supports it.
- Pre-commit `gitleaks` runs on every commit. Never bypass with `--no-verify`.
- If a secret is accidentally committed, rotate it immediately (don't just `git rebase` — assume it's already in someone's clone).

## Things to verify, not assume

These are flagged because guessing is how subtle bugs reach production. Each must be confirmed against the actual environment.

1. **OpenSCAD CLI flag for the manifold backend** on the version we ship. Possible: `--backend=Manifold`, `--enable=manifold`, or a config option. Run `openscad --help` against the chosen Docker image to confirm.
2. **Library parameter names** match what `BaseplateParams` sends. Pin a commit, then `grep` that commit's `gridfinity-rebuilt-baseplate.scad` to confirm: `gridx`, `gridy`, `style_plate`, `enable_magnet`, `chamfer_holes`, `crush_ribs`.
3. **OpenSCAD Docker base image** — the apt-shipped `openscad` on Debian/Ubuntu is too old for the manifold backend. Options to evaluate: `openscad/openscad:nightly`, AppImage in a slim base, or build from source. Pin the image digest once chosen.
4. **R2 bucket access pattern** — public bucket with custom domain `stl.mygridfinity.app` (simpler) vs private bucket with signed URLs from the API (lets us add per-user authorization later). Lock in before hardcoding.
5. **Worker concurrency** — set to **1** initially for VPS-2 (6 vCores, but we want 5 free for web + db + redis + os). Adjust only after measuring queue depth in real use.

## Open product questions (defer until v1 ships)

Don't build for these. Note them and move on.

- Public sharing slug strategy: random slugs vs user-chosen vs `username/project-name`
- Whether to support exporting STEP / 3MF in addition to STL
- Whether to add bin support (different `.scad` entry, same render pipeline) before or after public sharing
- Pricing / paid tier (probably never for v1, but accounts open the door)
- Project versioning / history

## Workflow

Five-phase per global CLAUDE.md (v1.4.0+):

1. **Plan** — restate the task, list affected files, propose approach
2. **Confirm** — wait for explicit "go" from the user before changing files
3. **Implement** — small reviewable diffs, one concern per commit
4. **Verify** — `pnpm typecheck && pnpm lint && pnpm test` must pass before declaring done
5. **Document** — update CHANGELOG and relevant docs in the same commit

After each major phase (see "V1 features in order"), stop and demo to the user before continuing.

## When in doubt

- Re-read this file first.
- If the question is architectural, the decision is probably in "Architecture decisions (locked)" or "What we rejected."
- If the question is "should I add this feature/library/abstraction" and it's not in V1 scope: don't.
- If the question is about a specific file's contents: ask the user to look it up rather than guessing.
- If the question is about credentials or environment values: **always ask, never invent**.
