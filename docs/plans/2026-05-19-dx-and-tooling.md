# Daily Dose Bot — DX & Tooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the developer-experience gaps the audit surfaced: there is no root ESLint config (ESLint is installed but unused), the root `.prettierrc.json` and `web/.prettierrc` disagree on quote style, no root `.env.example` exists (operators rely on `DEPLOYMENT.md` to know what to set), no commit/PR gates run lint or tests, and there's nothing stopping a developer from committing unformatted code.

**Architecture:** Five independent fixes. (1) Add a flat ESLint config at the root with a sensible Node baseline. (2) Unify Prettier — pick one config, delete the duplicates. (3) Add root `lint` / `format` / `lint:fix` scripts. (4) Create `.env.example` at the root by extracting the variables documented in `DEPLOYMENT.md`. (5) Add husky + lint-staged so staged files are auto-formatted and linted on commit. (6) Extend the GitHub Actions deploy workflow with a `lint` + `test` job that runs before deploy.

**Tech Stack:** ESLint 9 (flat config, already installed), Prettier 3 (already installed via web/), husky 9, lint-staged 15, GitHub Actions (existing).

**Prerequisite:** Plan `2026-05-19-security-correctness-hardening.md` Task 1 (Jest harness) is complete — the CI `test` step in Task 6 depends on `npm test` actually running Jest.

---

## File Structure

**New files**
- `eslint.config.js` (root) — flat ESLint config for backend
- `.env.example` (root) — template for required env vars
- `.husky/pre-commit` — runs `lint-staged`

**Modified files**
- `.prettierrc.json` (root) — keep one canonical Prettier config; delete `web/.prettierrc`
- `web/.prettierrc` — **deleted** (replaced by root config)
- `package.json` (root) — add `lint`, `lint:fix`, `format`, `prepare` scripts; add `husky`, `lint-staged`, `prettier` devDeps; add `lint-staged` field
- `.github/workflows/deploy.yml` — add `lint-and-test` job that runs before `deploy`

---

## Task 1: Root ESLint flat config

**Why:** `eslint@^9.34.0` is in `devDependencies` but there's no config file at the repo root, no `lint` npm script, and ESLint v9 requires the flat config format. Adding the config makes the dependency actually useful and gives the rest of this plan something to call.

**Files:**
- Create: `eslint.config.js`
- Modify: `package.json` — add `lint` script

- [ ] **Step 1: Install the ESLint Node globals package**

Run: `npm install --save-dev globals@^15.0.0`

Expected: `added 1 package`. Used by the flat config for `node` and `commonjs` global definitions.

- [ ] **Step 2: Create `eslint.config.js` at the repo root**

Create `eslint.config.js`:
```js
const globals = require("globals");

module.exports = [
  {
    ignores: [
      "node_modules/**",
      "web/**",
      "coverage/**",
      "prisma/migrations/**",
      "logs/**",
      "temp/**",
    ],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.commonjs,
      },
    },
    rules: {
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-undef": "error",
      "no-console": "off", // logger migration is a separate plan
      eqeqeq: ["error", "always"],
      "prefer-const": "warn",
      "no-var": "error",
    },
  },
  {
    files: ["test/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
  },
];
```

> Note: `web/` is ignored here because it has its own ESLint flat config (`web/eslint.config.js`) with React rules. The root config covers backend only.

- [ ] **Step 3: Add the `lint` and `lint:fix` scripts to `package.json`**

In root `package.json`, inside `"scripts"`, add (or replace if present):
```json
"lint": "eslint .",
"lint:fix": "eslint . --fix",
```

- [ ] **Step 4: Run the linter to surface existing issues**

Run: `npm run lint`

Expected: ESLint runs and prints warnings/errors. Note the count but do **not** auto-fix the entire codebase in this plan — the goal is to wire the tool, not refactor backend style.

If there are critical `no-undef` errors (likely from `dayjs` plugins or similar), open the file and either add an explicit `require` or add the global to the config. Do **not** suppress with `// eslint-disable-line` unless you understand the specific case.

- [ ] **Step 5: Commit**

```bash
git add eslint.config.js package.json package-lock.json
git commit -m "chore: add root ESLint flat config + npm run lint

ESLint 9 was a devDependency without a config — \`npm run lint\` did
nothing. Add a minimal flat config covering backend .js files (web/ has
its own React config and is ignored here). Rules are intentionally
permissive (no-unused-vars is warn, no-console is off) to establish the
baseline without forcing a style refactor in the same PR."
```

---

## Task 2: Unify Prettier config

**Why:** The audit found `/.prettierrc.json` (root: double quotes, tab width 2) and `/web/.prettierrc` (single quotes, tab width 2) disagree. The result is that running `prettier --write` from different directories rewrites the same code differently. Pick one and delete the other.

**Decision:** Keep the root `.prettierrc.json` (matches the existing backend style observed in `src/*.js`). Update `web/` to inherit it by deleting `web/.prettierrc`. If after running `prettier --check` in `web/` the diff is too large, instead update the root file to single quotes (which is more common in TS/React projects) — but only after confirming with the user.

**Files:**
- Modify: `.prettierrc.json` (root) — verify contents
- Delete: `web/.prettierrc`
- Modify: `package.json` — add `format` script
- Modify: `web/package.json` — point its `format` script at the same root config

- [ ] **Step 1: Confirm the root `.prettierrc.json`**

Read `/Users/nahian/Projects/daily-dose-bot/.prettierrc.json`. It should be:
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": false,
  "printWidth": 80,
  "tabWidth": 2
}
```
(Exact contents may differ; what matters is `singleQuote: false`.)

- [ ] **Step 2: Compare against `web/.prettierrc`**

Read `/Users/nahian/Projects/daily-dose-bot/web/.prettierrc`. Note the differences — typically `singleQuote: true`.

- [ ] **Step 3: Check the actual style used in `web/`**

Run: `npx prettier --check web/src --config .prettierrc.json`

If the output reports many files as "not formatted" (likely, since web/ uses single quotes), STOP and bring this to the user before continuing. The user must pick:
  - **Option A:** Delete `web/.prettierrc` and reformat all of `web/src` to double quotes in this commit.
  - **Option B:** Update the root `.prettierrc.json` to `"singleQuote": true` and reformat backend instead.
  - **Option C:** Leave both configs in place and accept the inconsistency.

For the purposes of this plan, assume **Option B** is chosen (matches the modern TS/React default already in use across `web/`).

- [ ] **Step 4 (Option B): Update root `.prettierrc.json`**

Edit `.prettierrc.json` to:
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

- [ ] **Step 5: Delete the duplicate config**

Run: `rm web/.prettierrc`

- [ ] **Step 6: Install Prettier at the root if absent**

Run: `npm install --save-dev prettier@^3.0.0`

(It is already installed inside `web/`, but the root must have it for the root scripts to work.)

- [ ] **Step 7: Add the root `format` script**

In root `package.json` `"scripts"`, add:
```json
"format": "prettier --write \"src/**/*.js\" \"scripts/**/*.js\" \"test/**/*.js\" \"*.{js,json,md}\"",
"format:check": "prettier --check \"src/**/*.js\" \"scripts/**/*.js\" \"test/**/*.js\" \"*.{js,json,md}\""
```

- [ ] **Step 8: Run format on backend to apply the unified style**

Run: `npm run format`

Inspect the diff (`git diff --stat`) to confirm only formatting changes (quote style, no semantic edits). If the diff includes unrelated changes, abort and investigate before continuing.

- [ ] **Step 9: Verify all tests still pass after formatting**

Run: `npm test`

Expected: all tests pass. Formatting must not break behavior.

- [ ] **Step 10: Commit**

```bash
git add .prettierrc.json web/.prettierrc package.json package-lock.json src/ scripts/ test/
git commit -m "chore: unify Prettier config at the repo root

Drop the duplicate web/.prettierrc (single quotes, tab 2) and standardize
on the root .prettierrc.json. After confirming web/ already uses single
quotes throughout, the root config is updated to singleQuote: true to
match. Apply the unified style across backend in this commit."
```

---

## Task 3: Create root `.env.example`

**Why:** Onboarding a new developer requires reading `DEPLOYMENT.md` (lines 92-109) to learn which env vars to set. There is no template file to copy.

**Files:**
- Create: `.env.example` at the repo root

- [ ] **Step 1: Pull the canonical variable list from `DEPLOYMENT.md`**

Run: `grep -nE '^[A-Z_]+=|^\s*\*\s*\`[A-Z_]+\`' /Users/nahian/Projects/daily-dose-bot/DEPLOYMENT.md`

Confirm the list of required variables (typical: `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_APP_TOKEN`, `DATABASE_URL`, `DIRECT_URL`, `PORT`, `DEFAULT_TIMEZONE`, `APP_URL`, `LOG_LEVEL`, `SENTRY_DSN`, `SCRIPTS_AUTH_USERNAME`, `SCRIPTS_AUTH_PASSWORD`).

- [ ] **Step 2: Create `.env.example`**

Create `/Users/nahian/Projects/daily-dose-bot/.env.example`:
```bash
# Slack credentials — see DEPLOYMENT.md for how to obtain these
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token

# Database (Supabase / Postgres)
DATABASE_URL=postgresql://user:password@host:5432/dbname?pgbouncer=true
DIRECT_URL=postgresql://user:password@host:5432/dbname

# App
PORT=3000
HOST=localhost
DEFAULT_TIMEZONE=America/New_York
APP_URL=http://localhost:3000

# Observability
LOG_LEVEL=info
SENTRY_DSN=

# Scripts docs auth (required — the app refuses to start without these)
SCRIPTS_AUTH_USERNAME=
SCRIPTS_AUTH_PASSWORD=
```

> If `DEPLOYMENT.md` lists additional variables not above (e.g. `SLACK_USER_TOKEN`, `NODE_ENV`), add them to the example with sensible placeholders. Do not include any real secrets.

- [ ] **Step 3: Verify `.gitignore` excludes `.env` but allows `.env.example`**

Run: `grep -nE '^\.env|^!\.env' /Users/nahian/Projects/daily-dose-bot/.gitignore`

Expected: `.env` (or similar) appears; `.env.example` is not blocked. If `.env.example` is currently blocked, add an explicit `!.env.example` exception.

- [ ] **Step 4: Reference it in `CONTRIBUTING.md`**

In `CONTRIBUTING.md`, find the dev-setup section (around lines 56-84 per the audit). Replace any line like "see DEPLOYMENT.md for required env vars" with:
```
Copy .env.example to .env and fill in the values (see DEPLOYMENT.md for how to obtain Slack tokens and Supabase URLs).
```

- [ ] **Step 5: Commit**

```bash
git add .env.example .gitignore CONTRIBUTING.md
git commit -m "chore: add root .env.example to streamline onboarding

The full list of required env vars lives in DEPLOYMENT.md; this template
mirrors it so a new developer can copy and fill in instead of cross-
referencing. CONTRIBUTING.md now points to the template first."
```

---

## Task 4: husky + lint-staged pre-commit hook

**Why:** Without a pre-commit hook, developers can commit code that fails lint or formatting. CI will only catch it at deploy time (after Task 6 wires lint into CI) and even then can't auto-fix.

**Files:**
- Modify: `package.json` — add devDeps + `prepare` script + `lint-staged` field
- Create: `.husky/pre-commit`

- [ ] **Step 1: Install husky and lint-staged**

Run: `npm install --save-dev husky@^9.0.0 lint-staged@^15.0.0`

Expected: both added under `devDependencies`.

- [ ] **Step 2: Initialize husky**

Run: `npx husky init`

This creates the `.husky/` directory and a sample `pre-commit` file, plus adds `"prepare": "husky"` to `package.json` scripts.

- [ ] **Step 3: Replace the contents of `.husky/pre-commit`**

Edit `.husky/pre-commit` to:
```bash
#!/usr/bin/env sh
npx lint-staged
```

(`npx husky init` may generate a different placeholder; this single line is all we need.)

- [ ] **Step 4: Add the `lint-staged` config to `package.json`**

In root `package.json` (top level, alongside `scripts` and `dependencies`), add:
```json
"lint-staged": {
  "src/**/*.js": ["eslint --fix", "prettier --write"],
  "scripts/**/*.js": ["eslint --fix", "prettier --write"],
  "test/**/*.js": ["eslint --fix", "prettier --write"],
  "*.{json,md}": ["prettier --write"]
}
```

- [ ] **Step 5: Sanity-check the hook runs**

Touch a backend file with a trivial whitespace change, stage it, and try to commit. Example:
```bash
# Add a trailing newline that prettier will normalize
printf "\n" >> src/utils/dateHelper.js
git add src/utils/dateHelper.js
git commit -m "test: verify lint-staged runs (will revert)"
```

Expected: lint-staged output appears, eslint + prettier run on the staged file, then the commit completes.

Immediately revert:
```bash
git reset --soft HEAD~1
git checkout -- src/utils/dateHelper.js
```

- [ ] **Step 6: Commit the husky+lint-staged setup itself**

```bash
git add package.json package-lock.json .husky/
git commit -m "chore: add husky + lint-staged pre-commit hook

Staged backend files are auto-formatted (prettier) and linted (eslint
--fix) on every commit. This catches style/lint issues before they reach
CI and prevents unformatted code from landing on main."
```

---

## Task 5: CI lint + test gate

**Why:** `.github/workflows/deploy.yml` currently only validates Prisma generation before deploying. After this task, every push that triggers the workflow runs `npm run lint` and `npm test` in a job that must pass before deploy proceeds.

**Files:**
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Inspect the existing workflow**

Run: `cat /Users/nahian/Projects/daily-dose-bot/.github/workflows/deploy.yml`

Note the existing `jobs:` structure. Confirm whether there's already a `lint` / `test` job or just a `deploy` job.

- [ ] **Step 2: Add a `lint-and-test` job that runs before `deploy`**

Locate the `jobs:` block in `.github/workflows/deploy.yml` and add a new job before the existing `deploy` job:
```yaml
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx prisma generate
      - run: npm run lint
      - run: npm test
```

Then add a `needs:` clause to the existing `deploy` job so it only runs after `lint-and-test` succeeds:
```yaml
  deploy:
    needs: lint-and-test
    # ... existing deploy steps unchanged
```

- [ ] **Step 3: Mirror the same change in `deploy-version.yml`**

Repeat Step 2 in `.github/workflows/deploy-version.yml` (if it exists per the audit). Both workflows must gate on lint+test.

- [ ] **Step 4: Push to a branch and confirm CI runs**

Create a throwaway branch, push, open a PR, and confirm the `lint-and-test` job runs and that the `deploy` job waits on it. Do not merge — close the PR after verification, or use it to land this plan's work.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/deploy.yml .github/workflows/deploy-version.yml
git commit -m "ci: gate deploy on npm run lint + npm test

A new lint-and-test job runs ESLint and the Jest suite on every workflow
trigger. The existing deploy job now declares \`needs: lint-and-test\`
so a failing lint or test blocks the deploy."
```

---

## Self-Review

Spec coverage:
- Audit P2 #12 (no root lint config, conflicting Prettier configs, no CI gate) → Task 1 (lint) + Task 2 (Prettier) + Task 5 (CI) ✓
- Audit P2 #13 (no test infrastructure / no test runner in CI) — partial: Task 5 wires `npm test` into CI; the harness itself is bootstrapped by Plan 1 Task 1 (prerequisite). The "what to test first" recommendations from the audit are realized by the actual test files written in Plans 1/2/3.
- Audit P2 #14 (no root .env.example) → Task 3 ✓
- Audit P2 #15 (no pre-commit hooks) → Task 4 ✓

Type / API consistency:
- `npm run lint` → defined in Task 1, called by Task 4 (lint-staged) and Task 5 (CI) ✓
- `npm run format` / `npm run format:check` → defined in Task 2; not currently called by CI but available for manual use ✓
- `npm test` → defined in Plan 1 Task 1; called by Task 5 (CI) ✓
- `npx husky init` creates `"prepare": "husky"` automatically — no manual edit of `package.json` for that line ✓
- `lint-staged` field at the top level of `package.json` — lint-staged 15 picks this up by default; no separate config file needed ✓

No placeholders found.

---

## Plan Ordering

When executing the four plans, run them in this order:

1. `2026-05-19-security-correctness-hardening.md` (Jest harness + P0 security)
2. `2026-05-19-query-performance.md` (perf fixes; depends on Jest)
3. `2026-05-19-observability-and-reliability.md` (Sentry + logger + scheduler reliability; depends on Jest)
4. `2026-05-19-dx-and-tooling.md` (lint + CI + pre-commit; depends on Jest and benefits from the cleanup the earlier plans do)

Each plan is self-contained and produces working, shippable software on its own. They can also be parallelized across multiple developers if the Plan 1 prerequisite is met first.
