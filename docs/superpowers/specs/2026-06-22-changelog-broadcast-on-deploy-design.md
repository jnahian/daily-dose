# Changelog Broadcast on Deploy — Design

**Date:** 2026-06-22
**Status:** Approved (brainstorming → ready for implementation plan)

## Goal

When a new release is deployed, automatically post the latest user-facing
changelog entry to every organization's `daily-dose-bot` Slack channel — once
per release, per org. No manual step, no spam on restarts.

## How it works

On boot, after `app.start(port)` succeeds in `src/app.js`, a fire-and-forget
call into a new `changelogBroadcastService` runs the broadcast. It is wrapped so
it can never block startup or crash the process. The service compares the latest
user-facing changelog version against a per-org marker and posts only to orgs
that have not yet seen that version.

### Version source: `changelog.json`'s `isLatest` entry

The version we compare against is the `version` of the `isLatest: true` entry in
`web/src/data/changelog.json` — **not** `package.json`.

Consequence: an internal-only release bumps `package.json` but leaves `isLatest`
unchanged, so it automatically produces **zero broadcasts**. No "version
mismatch" warning or `--force` logic is needed; it falls out for free.

`web/src/data/changelog.json` is present on the production host: the deploy does
a full `git checkout` / `git pull` of the repo onto the VPS (see
`.github/workflows/deploy-version.yml`, `deploy.yml`), so the entire source tree
is on disk even though only `web/dist/` is _served_.

### Idempotency: per-org marker (mandatory)

PM2 runs a single instance (`ecosystem.config.js`, `instances: 1`) with
`autorestart: true`, so every crash/restart re-runs boot. Without a persisted
marker this re-spams every org. Therefore:

- New column **`Organization.lastBroadcastVersion String?`** (`@map("last_broadcast_version")`).
- Boot logic: load all active orgs that have a `botChannelId`, then **branch in
  JS** (do not rely on Prisma `{ not: latest }` null semantics — a null marker
  must be reachable, and Prisma's `not` handling of `NULL` is version-dependent):
  - `lastBroadcastVersion === latest` → **skip**
  - `lastBroadcastVersion == null` → **seed silently** (set marker to `latest`,
    do not post)
  - otherwise → **post**, then update marker to `latest`
- Process orgs **sequentially** with a ~1.2 s sleep between Slack calls
  (Slack rate-limits ~1 req/sec/channel — same pattern as
  `scripts/backfillOrgChannels.js`).
- A failed `postMessage` logs a warning, **skips the marker update**, and is
  retried on the next boot. Partial failures self-heal.

### First-deploy safety: `null` = seed silently

When the column is first added, every existing org is `null`. Treating null as
"seed, don't post" means the feature ships **without** mass-blasting the current
changelog to every org. Only the _next_ real release broadcasts.

### New orgs: stamp at creation

So that an org created _after_ launch still receives its first post-join
release (instead of being silently seeded), set `lastBroadcastVersion` to the
current latest version **at org-creation time** in the runtime path:
`src/routes/admin.js` (`prisma.organization.create`, ~line 337). After this,
`null` unambiguously means "pre-existing at feature launch."

Setup scripts that upsert orgs (`scripts/seedOrg.js`, `scripts/addOrgAdmin.js`)
are left as-is: orgs they create seed silently on next boot, which is acceptable
for setup-time provisioning.

## Components

### 1. `src/utils/blockHelper.js` — block builder

New `createChangelogBroadcastBlocks(versionEntry, changelogUrl)`:

- `header`: `🚀 What's new in Daily Dose v{version}`
- `context`: the release `date`
- One `section` per `changes[]` group: emoji by `type`
  (`added` → ✨, `fixed` → 🔧, `changed` → 🔁, fallback → 📌), **bold** `title`,
  then bulleted `items`
- Footer `context` with `<{webUrl}/changelog|View full changelog>`

Follows `docs/slack-markdown-guidelines.md`. No blocks are inlined at call sites.

### 2. `src/services/changelogBroadcastService.js` — orchestration

- `getLatestEntry()` — read `web/src/data/changelog.json`, return the
  `isLatest: true` entry (or the first entry as fallback). Returns `null` and
  logs a warning if no entry is found (defensive no-op).
- `broadcastOnDeploy(client, { mode })` — the boot query, JS branch, sequential
  loop, sleep, marker updates, null-seeding. `mode` derived from
  `CHANGELOG_BROADCAST` env: `off` (skip entirely), `dry` (log targets + a
  rendered preview, send nothing, **do not** update markers), default = live.
- `getLatestVersion()` — convenience for the org-creation stamp.

Keeping this in a service (not `app.js`) keeps `app.js` thin and makes the
logic unit-testable.

### 3. `src/app.js` — wiring

After `await app.start(port)`, one fire-and-forget call:

```js
changelogBroadcastService
  .broadcastOnDeploy(app.client)
  .catch((err) => logger.error("Changelog broadcast failed:", err.message));
```

Use `app.client` (Bolt's client, on `SLACK_BOT_TOKEN`) — not the separate
`BOT_TOKEN` used by scripts/admin — to avoid token ambiguity.

### 4. `prisma/schema.prisma` + migration

Add `lastBroadcastVersion String? @map("last_broadcast_version")` to
`Organization`. Generate a **committed migration**
(`prisma migrate dev --name add_org_last_broadcast_version`), consistent with
the repo's migration policy. Run `npx prisma generate`.

### 5. `src/routes/admin.js` — org-creation stamp

In the `prisma.organization.create` call, add
`lastBroadcastVersion: changelogBroadcastService.getLatestVersion()`.

### 6. Docs

- `CLAUDE.md` / `README.md`: note the auto-broadcast behavior and the
  `CHANGELOG_BROADCAST` env (`off` / `dry`).
- `CHANGELOG.md`: technical entry. **Not** `web/src/data/changelog.json` — this
  feature is operator-facing infra, not a user-visible bot feature, so adding it
  there would (ironically) broadcast itself.

## Error handling

Best-effort throughout, mirroring `backfillOrgChannels.js`:

- Top-level `.catch` on the fire-and-forget call logs via `logger.error` — never
  silently swallowed.
- Per-org `postMessage` failure (archived channel, bot removed, rate limit):
  `logger.warn`, skip marker update, continue the loop, retry next boot.
- Missing/empty `isLatest` entry: log a warning, no-op.

## Testing (Jest)

Service-level unit tests with a mocked Slack client and Prisma:

- `lastBroadcastVersion == null` → **no post**, marker set to latest
- `lastBroadcastVersion` differs from latest → **posts**, marker updated
- `lastBroadcastVersion === latest` → **skipped**, no post
- `postMessage` throws → marker **not** updated (retried next boot)
- `mode = dry` → no posts, **no** marker updates
- `mode = off` → service is a no-op
- no `isLatest` entry → no-op + warning
- Block builder: renders header/version, per-type emoji, bullets, changelog link

## Out of scope (YAGNI)

- GitHub Actions / release-skill trigger (auto-on-deploy replaces it)
- Per-org opt-out UI
- `@channel` mention (posts land quietly in-channel)
- Manual CLI re-broadcast script (can be added later if a forced re-send is ever
  needed)
- Multi-instance dedup (single PM2 instance; revisit only if cluster mode is
  adopted)
