# CLAUDE.md — mygridfinity.app

> Project-level rules for Claude Code. Inherits from `~/.claude/CLAUDE.md` (global v1.4.0+).
> Read `docs/HANDOFF.md` first for the full project context.

## TL;DR

Parametric Gridfinity baseplate + bin generator. Server-side OpenSCAD rendering, browser viewer, accounts, saved projects.

**Stack:** Next.js 15 · TypeScript · Tailwind v4 · shadcn/ui · self-hosted Postgres 16 · Drizzle · Better Auth · BullMQ · Redis · OpenSCAD (manifold backend) · Cloudflare R2 · Coolify on OVH VPS-2.

## Architecture (one-liner)

Web enqueues a render job → worker shells out to OpenSCAD CLI → STL goes to R2, keyed by parameter hash → browser viewer fetches the finished STL. No CAD compute in the browser.

## Repo layout

- `apps/web` — Next.js 15 app
- `apps/worker` — Node + BullMQ + OpenSCAD CLI render worker
- `apps/worker/scad/gridfinity-rebuilt-openscad` — vendored as git submodule, pinned commit
- `packages/db` — Drizzle schema + migrations + client (auth tables + app tables)
- `packages/shared` — zod schemas, cache key, shared types
- `docs/` — HANDOFF.md, SETUP.md, ARCHITECTURE.md, DEPLOY.md

## CRITICAL — security rules (non-negotiable)

These exist because of a real Cloudflare API token compromise on 2026-05-02. See `~/obsidian/main-vault/.../incident-2026-05-02.md` for context.

- **NEVER write a real token, API key, password, or secret into any file.** Not in code, tests, `.env.example`, markdown, anywhere.
- `.env.example` contains placeholder names with empty string values only.
- Real secrets live in 1Password (local) or Coolify env vars (prod). Reference by env var name only in code.
- Any task that needs a secret value: **ASK** the user. Do not invent or infer.
- Pre-commit `gitleaks` runs via lefthook. Never bypass with `--no-verify`.
- All tokens this project creates: 90-day expiry, narrow scope, IP allowlist where supported.
- Calendar reminder for token rotation goes in the user's calendar, not in the repo.

## Workflow

Five-phase per global CLAUDE.md:

1. **Plan** — restate the task, list affected files, propose approach
2. **Confirm** — wait for explicit "go" before changing files
3. **Implement** — small reviewable diffs, one concern per commit
4. **Verify** — `pnpm typecheck && pnpm lint && pnpm test` must pass before declaring done
5. **Document** — update CHANGELOG and relevant docs in the same commit

After each major phase boundary (see `HANDOFF.md` → "V1 features in order"), stop and demo to the user before starting the next.

## Commands

```bash
pnpm install
pnpm dev                            # web + worker in parallel
pnpm --filter @mygridfinity/web dev
pnpm --filter @mygridfinity/worker dev

pnpm typecheck                      # MUST pass before any commit
pnpm lint
pnpm test

pnpm db:generate                    # generate migration from schema changes
pnpm db:migrate                     # apply migrations
pnpm db:studio                      # Drizzle Studio

docker compose up -d                # local postgres + redis
docker compose down                 # stop them
```

## Code conventions

- TypeScript strict. No `any` without an inline `// any: <reason>` comment.
- Server Components by default; `"use client"` only when needed.
- shadcn primitives in `apps/web/src/components/ui` — extend, don't fork.
- Forms: `react-hook-form` + zod resolver. Zod schemas in `packages/shared`.
- DB queries through Drizzle. Raw SQL only inside generated migrations.
- Render parameters validated by zod in `packages/shared` before enqueue.
- STL cache key = `sha256(canonicalize(params))`. Same params → same key. Canonicalization = sort keys.
- Errors: throw `Error` subclasses with stable `.code` strings, never `string` errors.

## Auth — Better Auth with Drizzle adapter

- Schema in `packages/db/src/schema/auth.ts`, generated via `npx @better-auth/cli@latest generate`. Never hand-edit the schema file.
- Server config: `apps/web/src/lib/auth.ts`.
- Client hooks: `apps/web/src/lib/auth-client.ts` (`useSession`, `signIn`, `signUp`, `signOut`).
- Server-side helper: `apps/web/src/lib/auth-server.ts` exports `getSession()` (cached per request) and `requireSession()` (redirects to `/sign-in` if absent).
- All schema changes: edit Better Auth config → re-run `@better-auth/cli generate` → `pnpm db:generate && pnpm db:migrate`.
- Email/password requires email verification before sign-in succeeds.
- Google OAuth is the social fallback. GitHub optional.
- Never reach for Supabase, NextAuth, Clerk, Auth0, or any other auth library. Better Auth is the only auth in this project.

## Render pipeline

Path: `apps/web` POST `/api/render` → R2 cache check → BullMQ enqueue → `apps/worker` consumes → exec OpenSCAD CLI → upload STL to R2 → update `render_jobs` row.

- Worker `concurrency: 1` initially (VPS-2 has 6 vCores; leave 5 free for web/db/redis/os).
- Render timeout: 60s. If OpenSCAD takes longer, the params are unreasonable.
- Cache hit returns immediately with `{ cached: true, url }`.
- Cache miss returns `202 { jobId }`; client polls `/api/render/[jobId]`.
- STL upload: `gridfinity/<modelType>/v<schemaVersion>/<cacheKey>.stl`. Schema version bumps invalidate the cache cleanly.

## OpenSCAD invocation

- Working dir = SCAD library root (paths in `.scad` files are relative).
- Manifold backend flag: VERIFY against the actual Docker image. Possible: `--backend=Manifold`, `--enable=manifold`. Don't guess — run `openscad --help` and confirm.
- Parameter pass via `-D 'name=value'` — booleans pass as `true`/`false`, numbers as bare numbers, strings need OpenSCAD-quoted strings.
- Library top-level vars confirmed at pin: `gridx`, `gridy`, `style_plate`, `enable_magnet`, `chamfer_holes`, `crush_ribs` (re-verify if pin changes).

## What NOT to do (will be reverted)

- Reintroduce `openscad-wasm`, `manifold-3d`, or `opencascade.js` to the browser. The viewer loads a finished STL, period.
- Reintroduce Trace or 5S features from the archived repo.
- Add Supabase, NextAuth, Clerk, or any auth library other than Better Auth.
- Add Vercel/CF Pages/Workers as the deploy target. Coolify on the VPS is the deploy target.
- Stub out the OpenSCAD render with a fake STL "for testing." Use a small parameter set (gridx=1, gridy=1) and the real renderer.
- Bypass `gitleaks` with `--no-verify`.
- Commit `.env`, even if "just temporarily" or "to test in CI."
- Hardcode the SCAD library commit SHA in multiple places. It's `.gitmodules` only.

## Open questions for the user

- [ ] Public sharing slug strategy: random vs user-chosen vs `username/project-name`
- [ ] Whether STEP / 3MF export is in v1 or deferred
- [ ] Bin generator before or after public sharing
- [ ] Sentry vs self-hosted GlitchTip for error tracking (defer until v1 ships)

## When in doubt

1. Re-read `docs/HANDOFF.md`.
2. If it's an architecture question, the answer is probably in `HANDOFF.md` → "Architecture decisions (locked)."
3. If it's "should I add X" and X isn't in V1 scope: don't.
4. If it's about credentials or env values: **always ask**.
