# License, Contributing, and Deployment Guide Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add MIT LICENSE, open-source CONTRIBUTING.md, and move/expand docs/DEPLOYMENT.md to root DEPLOYMENT.md.

**Architecture:** Three new/modified root-level files. No code changes — documentation only. `docs/DEPLOYMENT.md` is deleted after its content is expanded and moved to `DEPLOYMENT.md`.

**Tech Stack:** Markdown, MIT license text, existing project stack (Node.js, Prisma, Supabase, Slack Bolt, PM2, Nginx, GitHub Actions)

---

### Task 1: Create MIT LICENSE file

**Files:**
- Create: `LICENSE`
- Modify: `package.json` (change `"license": "ISC"` → `"license": "MIT"`)

**Step 1: Create `LICENSE` in the project root**

```
MIT License

Copyright (c) 2026 Sh Julkar Naen Nahian

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

**Step 2: Update `package.json`**

Change `"license": "ISC"` to `"license": "MIT"` in `package.json`.

**Step 3: Verify**

```bash
head -3 LICENSE
grep '"license"' package.json
```

Expected output:
```
MIT License

Copyright (c) 2026 Sh Julkar Naen Nahian
  "license": "MIT",
```

**Step 4: Commit**

```bash
git add LICENSE package.json
git commit -m "chore: add MIT license"
```

---

### Task 2: Create CONTRIBUTING.md

**Files:**
- Create: `CONTRIBUTING.md`

**Step 1: Create `CONTRIBUTING.md` in the project root with these sections:**

```markdown
# Contributing to Daily Dose

Thank you for your interest in contributing! This guide covers everything you need to get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Development Setup](#development-setup)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Branch Naming](#branch-naming)
- [Commit Messages](#commit-messages)
- [Code Style](#code-style)
- [PR Checklist](#pr-checklist)

---

## Code of Conduct

Be respectful and constructive. We follow the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) standard.

---

## Reporting Bugs

Open an issue at [github.com/jnahian/daily-dose/issues](https://github.com/jnahian/daily-dose/issues) and include:

- A clear title and description
- Steps to reproduce
- Expected vs actual behavior
- Node.js version and OS

---

## Suggesting Features

Open an issue with the `enhancement` label. Describe:

- The problem you're solving
- Your proposed solution
- Any alternatives you've considered

---

## Development Setup

### Prerequisites

- Node.js 18+
- PostgreSQL (or a [Supabase](https://supabase.com) project)
- A Slack app with the required scopes (see [DEPLOYMENT.md](./DEPLOYMENT.md#slack-app-setup))

### Steps

```bash
# 1. Fork and clone the repo
git clone https://github.com/<your-username>/daily-dose.git
cd daily-dose

# 2. Install dependencies
npm install

# 3. Copy and fill in environment variables
cp .env.example .env
# Edit .env with your Slack tokens and database URL

# 4. Generate Prisma client and push schema
npx prisma generate
npx prisma db push

# 5. Start the development server
npm run dev
```

The bot starts on `http://localhost:3000` by default.

For the web frontend:

```bash
cd web && npm run dev
```

---

## Submitting a Pull Request

1. **Fork** the repository and create a branch from `main`.
2. **Make your changes** — keep them focused and minimal.
3. **Test manually** in a Slack workspace (no automated tests currently).
4. **Push** your branch and open a PR against `main`.
5. **Fill in the PR description** — what changed and why.

---

## Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feat/<short-description>` | `feat/holiday-list-command` |
| Bug fix | `fix/<short-description>` | `fix/scheduler-timezone` |
| Documentation | `docs/<short-description>` | `docs/deployment-guide` |
| Chore | `chore/<short-description>` | `chore/update-dependencies` |

---

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
type(scope): brief description
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `style`, `chore`

**Examples:**
```
feat(standup): add bulk operations for all teams
fix(holiday): resolve database schema mismatch
docs(readme): update command reference
```

- Keep the subject line under 72 characters
- Use the imperative mood ("add" not "added")
- Focus on *why*, not *what*

---

## Code Style

This project follows these principles:

- **KISS** — simple, readable code over clever abstractions
- **DRY** — extract repeated logic into helpers (`src/utils/`)
- **YAGNI** — only build what is needed right now
- **Single Responsibility** — each function does one thing

Key conventions:
- `camelCase` for variables and functions
- `PascalCase` for Prisma models and React components
- `UPPER_SNAKE_CASE` for constants
- Boolean variables prefix: `is`, `has`, `can`, `should`
- Function verb prefixes: `get`, `set`, `create`, `update`, `delete`, `fetch`, `send`

---

## PR Checklist

Before submitting, confirm:

- [ ] Changes are limited to the described scope
- [ ] Tested manually in a Slack workspace
- [ ] New commands added to `scripts/updateSlackManifest.js` (if applicable)
- [ ] `README.md` updated for any user-facing changes
- [ ] No secrets or `.env` values committed
- [ ] Commit messages follow the format above
```

**Step 2: Verify file exists**

```bash
head -5 CONTRIBUTING.md
```

Expected:
```
# Contributing to Daily Dose
```

**Step 3: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs: add contributing guide"
```

---

### Task 3: Create root DEPLOYMENT.md (move + expand docs/DEPLOYMENT.md)

**Files:**
- Create: `DEPLOYMENT.md`
- Delete: `docs/DEPLOYMENT.md`

**Step 1: Create `DEPLOYMENT.md` in the project root**

The new file keeps all existing content from `docs/DEPLOYMENT.md` and adds the following new sections (insert them before the existing "VPS Initial Setup" section):

**New sections to prepend after the intro paragraph:**

```markdown
## Table of Contents

- [Slack App Setup](#slack-app-setup)
- [Database Setup (Supabase)](#database-setup-supabase)
- [Environment Variables Reference](#environment-variables-reference)
- [VPS Initial Setup](#vps-initial-setup)
- [SSH Key Setup](#ssh-key-setup)
- [Firewall Configuration](#firewall-configuration)
- [Nginx Reverse Proxy](#nginx-reverse-proxy)
- [Deployment Workflow](#deployment-workflow)
- [Manual Deployment Commands](#manual-deployment-commands)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)
- [Backup Strategy](#backup-strategy)

---

## Slack App Setup

### 1. Create the Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App**.
2. Choose **From an app manifest**.
3. Select your workspace and paste the manifest from `scripts/updateSlackManifest.js` (run `npm run manifest:dry-run` to preview it).

### 2. Required Bot Token Scopes

| Scope | Purpose |
|-------|---------|
| `channels:read` | List public channels |
| `chat:write` | Post messages |
| `commands` | Register slash commands |
| `groups:read` | List private channels |
| `im:write` | Send DMs |
| `users:read` | Look up user info |
| `users:read.email` | Match users by email |

### 3. Required User Token Scopes

| Scope | Purpose |
|-------|---------|
| `channels:read` | Resolve channel names |

### 4. Enable Socket Mode

Daily Dose does **not** use Socket Mode — it uses HTTP endpoints. Make sure **Socket Mode is off** in your app settings.

### 5. Collect Your Tokens

After installing the app to your workspace, collect:

| Token | Where to find it |
|-------|-----------------|
| `SLACK_BOT_TOKEN` | OAuth & Permissions → Bot User OAuth Token (`xoxb-...`) |
| `SLACK_SIGNING_SECRET` | Basic Information → Signing Secret |
| `SLACK_APP_TOKEN` | Basic Information → App-Level Tokens (create one with `connections:write`) |
| `SLACK_USER_TOKEN` | OAuth & Permissions → User OAuth Token (`xoxp-...`) |

---

## Database Setup (Supabase)

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Wait for provisioning to complete.

### 2. Get connection strings

In your Supabase project: **Settings → Database → Connection string**

- **`DATABASE_URL`**: Use the **URI** (pooled connection, port 6543) — used by Prisma at runtime.
- **`DIRECT_URL`**: Use the **direct connection** string (port 5432) — used by Prisma for migrations.

### 3. Push the schema

```bash
npx prisma db push
```

This creates all tables defined in `prisma/schema.prisma`.

---

## Environment Variables Reference

Copy `.env.example` to `.env` and fill in the values below.

| Variable | Required | Description |
|----------|----------|-------------|
| `SLACK_BOT_TOKEN` | Yes | Bot OAuth token (`xoxb-...`) |
| `SLACK_SIGNING_SECRET` | Yes | Slack app signing secret |
| `SLACK_APP_TOKEN` | Yes | App-level token (`xapp-...`) |
| `SLACK_USER_TOKEN` | Yes | User OAuth token (`xoxp-...`) |
| `DATABASE_URL` | Yes | Supabase pooled connection URL |
| `DIRECT_URL` | Yes | Supabase direct connection URL |
| `PORT` | No | HTTP port (default: `3000`) |
| `DEFAULT_TIMEZONE` | No | Fallback timezone (default: `America/New_York`) |
| `APP_URL` | Yes | Public base URL of the app (e.g. `https://dd.example.com`) |
| `LOG_LEVEL` | No | Log verbosity: `debug`, `info`, `warn`, `error` (default: `info`) |
| `SENTRY_DSN` | No | Sentry DSN for error tracking (optional) |
| `SCRIPTS_AUTH_USERNAME` | No | Username for `/scripts-docs` route (default: `admin`) |
| `SCRIPTS_AUTH_PASSWORD` | No | Password for `/scripts-docs` route (default: `daily-dose-admin`) |

---
```

**New section to add after Firewall Configuration (before Deployment Workflow):**

```markdown
## Nginx Reverse Proxy

If you want to serve the bot behind a domain with HTTPS, install Nginx and Certbot:

```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

Create `/etc/nginx/sites-available/your-domain.conf`:

```nginx
server {
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable it and get a certificate:

```bash
sudo ln -s /etc/nginx/sites-available/your-domain.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.com
```

Update your `.env`:

```env
APP_URL=https://your-domain.com
```

Update your Slack app's **Request URL** in Event Subscriptions and Slash Commands to `https://your-domain.com/slack/events`.

---
```

Full file structure (combine in order):
1. Title + intro paragraph
2. Table of Contents
3. Slack App Setup (new)
4. Database Setup / Supabase (new)
5. Environment Variables Reference (new)
6. VPS Initial Setup (existing)
7. SSH Key Setup (existing)
8. Firewall Configuration (existing)
9. Nginx Reverse Proxy (new)
10. Deployment Workflow (existing)
11. Manual Deployment Commands (existing)
12. Monitoring (existing)
13. Troubleshooting (existing)
14. Security Considerations (existing)
15. Backup Strategy (existing)

**Step 2: Delete `docs/DEPLOYMENT.md`**

```bash
git rm docs/DEPLOYMENT.md
```

**Step 3: Verify**

```bash
ls DEPLOYMENT.md
ls docs/DEPLOYMENT.md 2>/dev/null || echo "deleted"
head -5 DEPLOYMENT.md
```

Expected:
```
DEPLOYMENT.md
deleted
# Deployment Guide - Hetzner VPS
```

**Step 4: Commit**

```bash
git add DEPLOYMENT.md
git commit -m "docs: move and expand deployment guide to project root"
```
