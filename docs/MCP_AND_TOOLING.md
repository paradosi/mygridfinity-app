# MCP & Tooling for mygridfinity.app

> What to install in Claude Code for this project, and why. Skim, install what fits your workflow, ignore the rest.

## Install order

1. Filesystem MCP (almost certainly already configured globally — confirm)
2. **GitHub MCP** — issues, PRs, repo state
3. **OpenSCAD MCP** — render `.scad` to PNG for visual verification (the killer feature)
4. **Postgres MCP** — DB inspection during dev
5. **Tailscale MCP** — already in the user's global config; verify it's available
6. Optional: **Filesystem MCP scoped to the SCAD library** for fast lookups

## 1. GitHub MCP

**Why:** issues, PRs, branch state, commit history without leaving Claude Code's context. Especially useful for "is there an open issue against the SCAD library commit we pinned" type questions.

**Install:**

```bash
claude mcp add github --transport stdio --scope project -- \
  npx -y @modelcontextprotocol/server-github
```

**Auth:** GitHub MCP needs a personal access token. Per the security rules: create a **fine-grained PAT** scoped to:
- Repository access: `paradosi/mygridfinity-app` only (NOT all repos)
- Permissions: Issues (R/W), Pull requests (R/W), Contents (R), Metadata (R)
- Expiration: 90 days
- No `repo:delete`, no `admin:*`, no org-level scopes

Store the token in the Bitwarden vault as a secure note named `github-pat-mygridfinity`. Fetch it at session start:

```bash
export GITHUB_PERSONAL_ACCESS_TOKEN="$(bw get password github-pat-mygridfinity)"
```

(For the project-global GitHub MCP that ships with the user's `everything-claude-code` plugin, this env var is already wired — no per-project install needed.)

## 2. OpenSCAD MCP — the killer one

**Why:** without this, Claude Code edits `.scad` files and parameter generators blind. With it, Claude can render the result, look at the PNG, and verify the geometry came out right before handing back. The iteration loop on parametric CAD tightens dramatically.

**Recommended:** `quellant/openscad-mcp` (Python/FastMCP, designed for Claude Code, has a one-liner install).

**Install:**

```bash
# Prerequisites: OpenSCAD must be on the local Mac for this MCP to work
brew install openscad

# Verify which version + manifold support
openscad --help | grep -i manifold
openscad --version

# If the brew version is too old for manifold, install nightly:
# https://openscad.org/downloads.html#snapshots

# Install the MCP
claude mcp add openscad --transport stdio --scope project -- \
  uv run --with git+https://github.com/quellant/openscad-mcp.git openscad-mcp

# If openscad isn't on PATH:
# claude mcp add openscad --transport stdio --scope project \
#   --env OPENSCAD_PATH=/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD -- \
#   uv run --with git+https://github.com/quellant/openscad-mcp.git openscad-mcp
```

**Verify:**

```bash
claude mcp                         # should list "openscad" with status connected
```

**Usage prompt for Claude Code:**

Add to `CLAUDE.md` (or use ad-hoc in a session):

> When modifying `.scad` files, parameter schemas (`packages/shared/src/schemas/*.ts`), or the worker's parameter-to-CLI translation (`apps/worker/src/render.ts`): after the change, render the affected configuration with the OpenSCAD MCP and visually verify the geometry before declaring the change complete. For baseplate changes, render at minimum gridx=2, gridy=2 with the modified options.

**Note:** the local Mac OpenSCAD is for *verification only*. The actual production renders happen on the VPS in the worker container. Two different installs, both pinned versions when possible.

## 3. Postgres MCP

**Why:** schema introspection, query verification, "what's actually in `render_jobs` right now" without dropping to `psql`. Speeds up debugging Drizzle query bugs significantly.

**Install:**

```bash
claude mcp add postgres --transport stdio --scope project -- \
  npx -y @modelcontextprotocol/server-postgres "postgresql://postgres:postgres@localhost:5432/mygridfinity"
```

**Security note:** the connection string above is for **local dev only**. Never configure the Postgres MCP against the production database. If a production DB read is genuinely needed, the user runs the query themselves or sets up a read-only Tailscale-only proxy.

## 4. Tailscale MCP (already configured globally)

User already has this in their global Claude Code config per `userMemories`. Verify it's available:

```bash
claude mcp                         # tailscale should appear
```

**Why useful here:** confirming the VPS Tailscale node status, getting the hostname for SSH config, sanity-checking that the box is reachable when something seems broken.

## 5. Filesystem MCP scoped to SCAD library (optional)

**Why:** the gridfinity-rebuilt-openscad library has its own structure (`src/core/*.scad`, `src/helpers/*.scad`) and frequent grepping is faster with a scoped filesystem MCP than `fs.readFile` round trips.

If the user has a generic filesystem MCP globally, this is redundant — skip. Otherwise:

```bash
claude mcp add scad-lib --transport stdio --scope project -- \
  npx -y @modelcontextprotocol/server-filesystem \
  "/path/to/repo/apps/worker/scad/gridfinity-rebuilt-openscad"
```

## Helpers (not MCPs, but worth installing)

These run on the local Mac as part of the dev loop.

### lefthook (pre-commit hooks)

Already covered in `SETUP.md` Phase 4.3. Recap:

```bash
brew install lefthook gitleaks
lefthook install
```

Configures pre-commit gitleaks scan, typecheck on TS file changes, lint on TS/JS file changes.

### Drizzle Kit + Drizzle Studio

Already in `package.json` scripts. `pnpm db:studio` opens a browser-based DB GUI. Useful for poking at `render_jobs` and `projects` rows without `psql`.

### OpenSCAD (local)

Required for the OpenSCAD MCP above. Install once via brew or via the dev snapshot from openscad.org if manifold backend is needed locally. The actual production OpenSCAD lives in the worker Docker image — different binary, but same library version expectations.

### gh CLI

```bash
brew install gh
gh auth login
```

Required for repo creation in `SETUP.md` Phase 4.1. Also useful for `gh pr create`, `gh issue create` from terminal. The GitHub MCP covers most of this from Claude Code's side, but `gh` is handy for shell scripts and quick manual ops.

### Bitwarden CLI (`bw`)

```bash
brew install bitwarden-cli
bw login                          # email + master password (+ 2FA)
export BW_SESSION="$(bw unlock --raw)"
```

`BW_SESSION` lives in the current shell only. Each new terminal needs `bw unlock` again, or persist the export in a (gitignored, machine-local) file you `source`.

#### Naming convention for vault items

Each project secret gets one Bitwarden item, named `mygridfinity-<purpose>`:

- `mygridfinity-vps-coolify-env` — the Coolify VPS `.env` backup (secure note)
- `mygridfinity-vps-admin` — VPS Coolify admin login (login item)
- `mygridfinity-better-auth-secret` — Better Auth signing secret (secure note or password field)
- `mygridfinity-google-oauth` — Google OAuth client_id + client_secret (login item with custom fields)
- `mygridfinity-r2-stl` — R2 access keys (login item with custom fields)
- `mygridfinity-resend` — Resend API key (secure note)
- `github-pat-mygridfinity` — GitHub fine-grained PAT (secure note)

Custom fields on a login item are accessed by name: `bw get item <name> | jq -r '.fields[] | select(.name=="client-id").value'`.

#### Local `.env` workflow

`.env.example` is committed (placeholder names, empty values). `.env` is gitignored and built locally by fetching from Bitwarden:

```bash
cp .env.example .env
# Then for each variable, fetch from Bitwarden and paste into .env. Examples:
bw get password mygridfinity-better-auth-secret
bw get item mygridfinity-r2-stl | jq -r '.fields[] | select(.name=="access-key-id").value'
```

There is no native `bw run --env-file` equivalent to `op run`. If you want runtime injection without persisting `.env` to disk, write a small wrapper script that reads `.env.template` and substitutes `bw get ...` calls — keep it out of the repo (or in a `bin/` dir, gitignored if it contains item IDs you'd rather not publish).

`.env` is **never** committed. `gitleaks` runs pre-commit to enforce this.

## Verification checklist

After installing the above, in a fresh Claude Code session:

```bash
claude mcp                         # all MCPs listed, all connected
claude mcp call github list_repositories   # quick smoke test
claude mcp call openscad render_to_png ... # smoke test if any .scad available
claude mcp call postgres query "select 1"  # smoke test against local DB
```

## What NOT to install

- Generic "filesystem" MCPs scoped to the user's home directory — too broad, gives Claude access to unrelated repos and personal files. Scope to the project root or specific sub-paths.
- Any MCP that requires production credentials for normal operation (production Postgres, production R2 admin, etc.). Production access is on-demand and goes through Tailscale + manual auth, not MCPs.
- "AI 3D model generation" MCPs (e.g., text-to-CAD MCPs) — not what we're building. The library is parametric; we don't want LLMs designing the geometry.
- Cloudflare MCPs that require the API token. Per the recent incident, CF tokens are tightly scoped, short-lived, and not suitable for always-on MCP use.

## Updating the user's global CLAUDE.md

Suggest the user add (if not already there):

```markdown
## MCP discipline

- Per-project MCPs go in project scope (`--scope project`). User-global MCPs go in user scope. No mixing.
- MCPs that require credentials fetch from the Bitwarden vault (`bw get ...`) at session start; never embed real tokens.
- Production database/storage access is never wired into an MCP. Always on-demand, manual auth.
- After installing a new MCP, run `claude mcp` to verify it's connected before relying on it.
```
