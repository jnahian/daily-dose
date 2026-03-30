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
