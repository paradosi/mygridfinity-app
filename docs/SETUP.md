# mygridfinity.app — Setup Checklist

> Executable, ordered. Stop at each ⛔ and confirm before proceeding. Read `HANDOFF.md` first.

## Conventions

- 🟢 = run on the VPS (`mygridfinity-vps`, OVH VPS-2)
- 🔵 = run on the user's Mac
- ⛔ = stop and verify with the user before continuing
- All commands assume the working directory shown in the heading

## State at handoff

User has completed:

- ✅ OVH VPS-2 provisioned (Vint Hill, Ubuntu 24.04 LTS)
- ✅ SSH key with passphrase added to the VPS
- ✅ `apt update && apt upgrade -y` completed
- ✅ Installed: `unattended-upgrades`, `ufw`, `fail2ban`
- ✅ Tailscale installed and authed (verify with `tailscale status`)
- ✅ Docker installed (verify with `docker ps` — should not require `sudo`)

User has NOT done:

- ❌ SSH hardening (`/etc/ssh/sshd_config.d/`)
- ❌ UFW configuration / enable
- ❌ `fail2ban` enabled
- ❌ Hostname / timezone set
- ❌ Coolify install
- ❌ Mac `~/.ssh/config` cleanup
- ❌ Repository creation
- ❌ Anything app-related

## Lifeline rule (read every time)

Before any change to SSH, UFW, or anything that could lock the user out of the VPS:

1. Open a **second SSH session** in a separate terminal.
2. Make the change in the first session.
3. Verify the second session still works.
4. Open a **third fresh SSH session** to confirm new connections succeed.
5. Only then close the original.

Never run `ufw enable` without first confirming port 22 is allowed AND the second session is open.

## Phase 1 — VPS hardening (🟢 on VPS)

### 1.1 Confirm baseline state

```bash
tailscale status                  # node should be connected, get the hostname
docker ps                         # should print empty table, no permission error
sudo ufw status                   # likely "inactive" — that's fine for now
systemctl is-active fail2ban      # may say "inactive" — we'll start it below
```

If `docker ps` says permission denied, the user needs to log out and back in for the `docker` group to take effect.

Capture the Tailscale hostname for later: `tailscale status | head -1` (looks like `100.x.y.z mygridfinity-vps`). Also `tailscale ip -4`.

### 1.2 Hostname and timezone

```bash
sudo hostnamectl set-hostname mygridfinity-vps
sudo timedatectl set-timezone America/New_York

# Make the prompt obvious so the user knows when they're on the VPS
cat >> ~/.bashrc <<'EOF'
# Distinct prompt for VPS — red [VPS] prefix
export PS1='\[\033[01;31m\][VPS]\[\033[00m\] \u@\h:\w\$ '
EOF
```

User should `exec bash` or reconnect to see the new prompt.

### 1.3 SSH hardening

⛔ Open a second SSH session before editing.

```bash
sudo tee /etc/ssh/sshd_config.d/99-hardening.conf > /dev/null <<'EOF'
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
UsePAM yes
X11Forwarding no
PrintMotd no
ClientAliveInterval 300
ClientAliveCountMax 2
EOF

sudo sshd -t                      # MUST exit 0 before reload
sudo systemctl reload ssh
```

⛔ From the second SSH session, confirm it still works. Open a third fresh session from the Mac to confirm new connections succeed. Only then proceed.

### 1.4 fail2ban enable

```bash
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd
```

Expect to see "Jail list: sshd" and "Currently banned: 0".

### 1.5 UFW — Tailscale-only SSH

⛔ Verify Tailscale is connected before this step. Losing both Tailscale and public SSH = OVH web console recovery.

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Tailscale — full access from tailnet
sudo ufw allow in on tailscale0

# Public — only HTTP/HTTPS for the app itself
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# NOTE: not allowing 22/tcp publicly — Tailscale handles SSH
# NOTE: not allowing 8000/tcp publicly — Coolify dashboard is Tailscale-only

sudo ufw enable                   # answer "y"
sudo ufw status verbose
```

⛔ Verification:

- 🔵 From Mac with Tailscale up: `ssh mygridfinity-vps` should succeed.
- 🔵 From Mac with Tailscale paused: `ssh ubuntu@<public-ip>` should hang/timeout.

If public SSH still works, UFW didn't take — investigate before proceeding.

## Phase 2 — Coolify install (🟢 on VPS)

### 2.1 Install

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
```

Wait for completion (~3-5 minutes). Note the URL and one-time admin token printed at the end.

### 2.2 First login

⛔ Open the URL **immediately** and complete setup:

1. Create admin account — strong password, save to 1Password.
2. **Enable 2FA** before doing anything else.
3. In Settings → Configuration, set the instance domain to the Tailscale hostname: `coolify.<tailnet-name>.ts.net` (or whatever the user prefers).

Don't browse around. Lock down access first, explore second.

### 2.3 Restrict Coolify dashboard to Tailscale

The default Coolify install exposes port 8000 publicly. UFW already blocked 8000 from the public side in step 1.5, but verify:

```bash
sudo ufw status numbered | grep 8000     # should return nothing
curl -m 5 http://<public-ip>:8000        # should timeout or refuse
curl -m 5 http://<tailscale-ip>:8000     # should return Coolify HTML
```

## Phase 3 — Mac SSH config (🔵 on Mac)

### 3.1 Update `~/.ssh/config`

```
Host mygridfinity-vps
    HostName <tailscale-hostname>.ts.net
    User ubuntu
    IdentityFile ~/.ssh/<the-new-key>
    IdentitiesOnly yes
    ServerAliveInterval 60
```

Use the Tailscale hostname, not the public IP. Future-proofs against IP changes.

### 3.2 Test

```bash
ssh mygridfinity-vps              # should connect via Tailscale
```

## Phase 4 — GitHub repo (🔵 on Mac)

### 4.1 Create repo

```bash
gh repo create paradosi/mygridfinity-app --public \
  --description "Parametric Gridfinity bin and baseplate generator"

cd ~/projects                     # or wherever the user keeps repos
git clone git@github.com:paradosi/mygridfinity-app.git
cd mygridfinity-app
```

### 4.2 Drop in the scaffolding

⛔ At this point, hand control back to the user to confirm scaffolding files (root configs, CLAUDE.md, etc.) before continuing. The full file contents are in this conversation's thread — search for "Files to add" and "Root config files."

After scaffolding files are in place:

```bash
pnpm install
pnpm typecheck                    # must pass before continuing

git add .
git commit -m "chore: initial scaffold"
git push
```

### 4.3 Pre-commit hooks

```bash
brew install gitleaks lefthook
```

Create `lefthook.yml`:

```yaml
pre-commit:
  parallel: true
  commands:
    gitleaks:
      run: gitleaks protect --staged --no-banner
    typecheck:
      glob: "*.{ts,tsx}"
      run: pnpm typecheck
    lint:
      glob: "*.{ts,tsx,js,jsx}"
      run: pnpm lint
```

Then:

```bash
lefthook install
git commit --allow-empty -m "test: lefthook"     # confirm hooks fire
```

## Phase 5 — Vendor gridfinity-rebuilt-openscad (🔵 on Mac)

### 5.1 Pin a commit and add submodule

⛔ First, look up a known-good commit from https://github.com/kennetek/gridfinity-rebuilt-openscad/commits/main — pick one tagged or recently merged to main with no open issues against it. Pin to that SHA, NOT to `main` or a branch.

```bash
cd apps/worker
mkdir -p scad
git submodule add https://github.com/kennetek/gridfinity-rebuilt-openscad.git \
  scad/gridfinity-rebuilt-openscad
cd scad/gridfinity-rebuilt-openscad
git checkout <PINNED_COMMIT_SHA>
cd ../../../..
git add .gitmodules apps/worker/scad/gridfinity-rebuilt-openscad
git commit -m "chore: vendor gridfinity-rebuilt-openscad at <SHA>"
```

### 5.2 Verify parameter names

⛔ `grep -E '^(gridx|gridy|style_plate|enable_magnet|chamfer_holes|crush_ribs)\s*=' apps/worker/scad/gridfinity-rebuilt-openscad/gridfinity-rebuilt-baseplate.scad`

All six should match. If any are renamed, update `packages/shared/src/schemas/baseplate.ts` and `apps/worker/src/render.ts` to match before continuing.

## Phase 6 — Local dev environment (🔵 on Mac)

### 6.1 Start Postgres + Redis

```bash
docker compose up -d
docker compose ps                 # both should be "healthy"
```

### 6.2 Fill `.env`

```bash
cp .env.example .env
# Open in editor, fill values from 1Password
```

For local dev:
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mygridfinity`
- `REDIS_URL=redis://localhost:6379`
- `BETTER_AUTH_SECRET=$(openssl rand -base64 32)`
- `BETTER_AUTH_URL=http://localhost:3000`
- R2 / Resend / Google OAuth: leave blank for now, fill as features need them

### 6.3 Run migrations

```bash
pnpm db:generate                  # generate initial migration from schema
pnpm db:migrate
```

### 6.4 Boot the dev stack

```bash
pnpm dev                          # web + worker in parallel
```

⛔ Stop. The repo is now scaffolded, the VPS is hardened, Coolify is up, and dev tooling works locally. Return to the user before starting on app features (render pipeline, auth, viewer UI).

## Phase 7 — App features (deferred to separate task)

Continue per `HANDOFF.md` → "V1 features in order." Each step gets its own focused conversation with the user — don't blast through them all at once.
