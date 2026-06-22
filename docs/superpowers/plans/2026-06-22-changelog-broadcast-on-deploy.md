# Changelog Broadcast on Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On every deploy, automatically post the latest user-facing changelog entry to each organization's `daily-dose-bot` Slack channel — exactly once per release, per org.

**Architecture:** A fire-and-forget call after `app.start()` runs a new `changelogBroadcastService`. It reads the `isLatest` entry from `web/src/data/changelog.json`, compares its version against a new per-org `Organization.lastBroadcastVersion` marker, and posts only to orgs that haven't seen it. A `null` marker is seeded silently (no post) so the feature ships without mass-blasting existing orgs.

**Tech Stack:** Node.js, Slack Bolt (`app.client`), Prisma/PostgreSQL, Jest.

## Global Constraints

- Block Kit lives only in `src/utils/blockHelper.js` — never inline blocks at call sites.
- Process orgs **sequentially** with ~1.2 s sleep between Slack calls (Slack rate-limits ~1 req/sec/channel).
- The broadcast must **never** block startup or crash the process — fire-and-forget with a top-level `.catch`.
- Use `app.client` (Bolt client on `SLACK_BOT_TOKEN`), not the separate `BOT_TOKEN`.
- Version marker source is `changelog.json`'s `isLatest` entry, NOT `package.json`.
- This is operator-facing infra: record it in `CHANGELOG.md` only — **never** in `web/src/data/changelog.json` (that file is the broadcast payload).
- Repo uses committed Prisma migrations — generate a migration, do not `db push`.

---

## File Structure

- **Create** `src/services/changelogBroadcastService.js` — reads changelog, branches per org, posts, updates markers.
- **Create** `test/services/changelogBroadcastService.test.js` — unit tests for the service.
- **Modify** `src/utils/blockHelper.js` — add `createChangelogBroadcastBlocks` + export.
- **Modify** `test/utils/` — add block builder test (new file `test/utils/changelogBroadcastBlocks.test.js`).
- **Modify** `prisma/schema.prisma` — add `lastBroadcastVersion` to `Organization` + generated migration.
- **Modify** `src/app.js` — fire-and-forget wiring after `app.start`.
- **Modify** `src/routes/admin.js` — stamp `lastBroadcastVersion` at org creation.
- **Modify** `CLAUDE.md`, `README.md`, `CHANGELOG.md` — docs.

---

## Task 1: Add `lastBroadcastVersion` column + migration

**Files:**

- Modify: `prisma/schema.prisma` (the `Organization` model, ~line 11-26)

**Interfaces:**

- Produces: `Organization.lastBroadcastVersion: string | null` (DB column `last_broadcast_version`), consumed by Tasks 3 and 5.

- [ ] **Step 1: Add the field to the schema**

In `prisma/schema.prisma`, inside `model Organization`, add the field next to `botChannelId`:

```prisma
  botChannelId         String?              @map("bot_channel_id")
  lastBroadcastVersion String?              @map("last_broadcast_version")
```

- [ ] **Step 2: Generate the migration**

Run: `npx prisma migrate dev --name add_org_last_broadcast_version`
Expected: a new folder under `prisma/migrations/` containing `ALTER TABLE "organizations" ADD COLUMN "last_broadcast_version" TEXT;`, and the migration applies cleanly to the dev DB.

- [ ] **Step 3: Regenerate the Prisma client**

Run: `npx prisma generate`
Expected: `✔ Generated Prisma Client`.

- [ ] **Step 4: Verify the field exists on the client**

Run: `node -e "const p=require('./src/config/prisma'); p.organization.findFirst({select:{lastBroadcastVersion:true}}).then(()=>{console.log('OK');process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)})"`
Expected: prints `OK` (column is queryable).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add Organization.lastBroadcastVersion for changelog broadcast"
```

---

## Task 2: Block builder `createChangelogBroadcastBlocks`

**Files:**

- Modify: `src/utils/blockHelper.js` (add function before `module.exports` ~line 843; add name to exports)
- Test: `test/utils/changelogBroadcastBlocks.test.js`

**Interfaces:**

- Consumes: existing `createSectionBlock`, `createContextBlock`, `createDividerBlock` (already in this file).
- Produces: `createChangelogBroadcastBlocks(versionEntry, changelogUrl) -> Array<object>` where `versionEntry = { version, date, changes: [{ type, title, items: [] }] }`. Consumed by Task 3.

- [ ] **Step 1: Write the failing test**

Create `test/utils/changelogBroadcastBlocks.test.js`:

```js
const {
  createChangelogBroadcastBlocks,
} = require("../../src/utils/blockHelper");

const entry = {
  version: "1.16.0",
  date: "2026-06-22",
  changes: [
    { type: "added", title: "New thing", items: ["Did A", "Did B"] },
    { type: "fixed", title: "Fixed thing", items: ["Patched C"] },
    { type: "weird", title: "Misc", items: [] },
  ],
};

describe("createChangelogBroadcastBlocks", () => {
  const blocks = createChangelogBroadcastBlocks(
    entry,
    "https://dd.example/changelog"
  );

  it("starts with a header naming the version", () => {
    expect(blocks[0]).toEqual({
      type: "header",
      text: {
        type: "plain_text",
        text: "🚀 What's new in Daily Dose v1.16.0",
        emoji: true,
      },
    });
  });

  it("includes a section per change with the right emoji, bold title and bullets", () => {
    const texts = blocks
      .filter((b) => b.type === "section")
      .map((b) => b.text.text);
    expect(texts).toContain("✨ *New thing*\n• Did A\n• Did B");
    expect(texts).toContain("🔧 *Fixed thing*\n• Patched C");
    // unknown type falls back to 📌; no items => title only
    expect(texts).toContain("📌 *Misc*");
  });

  it("ends with a context block linking to the full changelog", () => {
    const last = blocks[blocks.length - 1];
    expect(last.type).toBe("context");
    expect(last.elements[0].text).toBe(
      "<https://dd.example/changelog|View full changelog>"
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest test/utils/changelogBroadcastBlocks.test.js`
Expected: FAIL — `createChangelogBroadcastBlocks is not a function`.

- [ ] **Step 3: Implement the builder**

In `src/utils/blockHelper.js`, add before `module.exports` (after `createNoDataBlocks`):

```js
const CHANGE_TYPE_EMOJI = {
  added: "✨",
  fixed: "🔧",
  changed: "🔁",
};

/**
 * Build the Block Kit message announcing a changelog version to an org channel.
 * @param {{version: string, date?: string, changes?: Array<{type: string, title: string, items?: string[]}>}} versionEntry
 * @param {string} changelogUrl - Link to the public changelog page
 * @returns {Array<object>} Slack blocks
 */
function createChangelogBroadcastBlocks(versionEntry, changelogUrl) {
  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `🚀 What's new in Daily Dose v${versionEntry.version}`,
        emoji: true,
      },
    },
  ];

  if (versionEntry.date) {
    blocks.push(createContextBlock(`Released ${versionEntry.date}`));
  }

  for (const change of versionEntry.changes || []) {
    const emoji = CHANGE_TYPE_EMOJI[change.type] || "📌";
    const items = (change.items || []).map((item) => `• ${item}`).join("\n");
    blocks.push(
      createSectionBlock(
        items
          ? `${emoji} *${change.title}*\n${items}`
          : `${emoji} *${change.title}*`
      )
    );
  }

  blocks.push(createDividerBlock());
  blocks.push(createContextBlock(`<${changelogUrl}|View full changelog>`));
  return blocks;
}
```

Then add `createChangelogBroadcastBlocks,` to the `module.exports` object.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest test/utils/changelogBroadcastBlocks.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/blockHelper.js test/utils/changelogBroadcastBlocks.test.js
git commit -m "feat(blocks): createChangelogBroadcastBlocks for changelog announcements"
```

---

## Task 3: `changelogBroadcastService`

**Files:**

- Create: `src/services/changelogBroadcastService.js`
- Test: `test/services/changelogBroadcastService.test.js`

**Interfaces:**

- Consumes: `createChangelogBroadcastBlocks` (Task 2); `prisma.organization.findMany/update`; `Organization.lastBroadcastVersion` (Task 1); a Slack client with `chat.postMessage`.
- Produces:
  - `getLatestEntry() -> object | null` — the `isLatest` changelog entry (or first, or null).
  - `getLatestVersion() -> string | null` — `getLatestEntry()?.version`. Consumed by Task 5.
  - `broadcastOnDeploy(client, { mode? }) -> Promise<void>`. Consumed by Task 4.

- [ ] **Step 1: Write the failing test**

Create `test/services/changelogBroadcastService.test.js`:

```js
// Mutable mock for the changelog JSON the service reads.
const mockChangelog = { versions: [] };
jest.mock("../../web/src/data/changelog.json", () => mockChangelog);

jest.mock("../../src/config/prisma", () => ({
  organization: { findMany: jest.fn(), update: jest.fn() },
}));
jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const prisma = require("../../src/config/prisma");
const service = require("../../src/services/changelogBroadcastService");

function makeClient() {
  return { chat: { postMessage: jest.fn().mockResolvedValue({ ok: true }) } };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Make the 1.2s inter-post sleep instant.
  jest.spyOn(global, "setTimeout").mockImplementation((fn) => {
    fn();
    return 0;
  });
  mockChangelog.versions = [
    {
      version: "1.16.0",
      date: "2026-06-22",
      isLatest: true,
      changes: [{ type: "added", title: "T", items: ["i"] }],
    },
    { version: "1.15.0", date: "2026-06-17", isLatest: false, changes: [] },
  ];
});

afterEach(() => jest.restoreAllMocks());

describe("getLatestEntry / getLatestVersion", () => {
  it("returns the isLatest entry and its version", () => {
    expect(service.getLatestEntry().version).toBe("1.16.0");
    expect(service.getLatestVersion()).toBe("1.16.0");
  });
});

describe("broadcastOnDeploy", () => {
  it("seeds a null-marker org silently (no post, marker set)", async () => {
    const client = makeClient();
    prisma.organization.findMany.mockResolvedValue([
      {
        id: "o1",
        name: "Org1",
        botChannelId: "C1",
        lastBroadcastVersion: null,
      },
    ]);
    await service.broadcastOnDeploy(client, { mode: "live" });
    expect(client.chat.postMessage).not.toHaveBeenCalled();
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: { lastBroadcastVersion: "1.16.0" },
    });
  });

  it("posts to an org on an older version, then updates its marker", async () => {
    const client = makeClient();
    prisma.organization.findMany.mockResolvedValue([
      {
        id: "o2",
        name: "Org2",
        botChannelId: "C2",
        lastBroadcastVersion: "1.15.0",
      },
    ]);
    await service.broadcastOnDeploy(client, { mode: "live" });
    expect(client.chat.postMessage).toHaveBeenCalledTimes(1);
    expect(client.chat.postMessage.mock.calls[0][0].channel).toBe("C2");
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "o2" },
      data: { lastBroadcastVersion: "1.16.0" },
    });
  });

  it("skips an org already on the latest version", async () => {
    const client = makeClient();
    prisma.organization.findMany.mockResolvedValue([
      {
        id: "o3",
        name: "Org3",
        botChannelId: "C3",
        lastBroadcastVersion: "1.16.0",
      },
    ]);
    await service.broadcastOnDeploy(client, { mode: "live" });
    expect(client.chat.postMessage).not.toHaveBeenCalled();
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it("does NOT update the marker when posting fails (retry next boot)", async () => {
    const client = makeClient();
    client.chat.postMessage.mockRejectedValue({
      data: { error: "channel_not_found" },
    });
    prisma.organization.findMany.mockResolvedValue([
      {
        id: "o4",
        name: "Org4",
        botChannelId: "C4",
        lastBroadcastVersion: "1.15.0",
      },
    ]);
    await service.broadcastOnDeploy(client, { mode: "live" });
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it("mode=dry posts nothing and updates nothing", async () => {
    const client = makeClient();
    prisma.organization.findMany.mockResolvedValue([
      {
        id: "o5",
        name: "Org5",
        botChannelId: "C5",
        lastBroadcastVersion: "1.15.0",
      },
      {
        id: "o6",
        name: "Org6",
        botChannelId: "C6",
        lastBroadcastVersion: null,
      },
    ]);
    await service.broadcastOnDeploy(client, { mode: "dry" });
    expect(client.chat.postMessage).not.toHaveBeenCalled();
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it("mode=off is a no-op (never queries orgs)", async () => {
    const client = makeClient();
    await service.broadcastOnDeploy(client, { mode: "off" });
    expect(prisma.organization.findMany).not.toHaveBeenCalled();
  });

  it("no-ops when there is no changelog entry", async () => {
    const client = makeClient();
    mockChangelog.versions = [];
    await service.broadcastOnDeploy(client, { mode: "live" });
    expect(prisma.organization.findMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest test/services/changelogBroadcastService.test.js`
Expected: FAIL — cannot find module `../../src/services/changelogBroadcastService`.

- [ ] **Step 3: Implement the service**

Create `src/services/changelogBroadcastService.js`:

```js
const prisma = require("../config/prisma");
const logger = require("../utils/logger");
const { createChangelogBroadcastBlocks } = require("../utils/blockHelper");

const SLEEP_MS = 1200; // Slack ~1 req/sec/channel — stay under the limit.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getWebUrl() {
  return (process.env.APP_URL || "https://dd.jnahian.me").replace(/\/+$/, "");
}

/**
 * Read the latest user-facing changelog entry. Best-effort: returns null
 * (and logs) if the file is unreadable or has no entries.
 * @returns {object|null}
 */
function getLatestEntry() {
  try {
    // eslint-disable-next-line global-require
    const changelog = require("../../web/src/data/changelog.json");
    const versions = (changelog && changelog.versions) || [];
    const entry = versions.find((v) => v.isLatest) || versions[0] || null;
    if (!entry) {
      logger.warn("Changelog broadcast: no changelog entry found");
      return null;
    }
    return entry;
  } catch (err) {
    logger.warn(
      "Changelog broadcast: failed to read changelog.json:",
      err.message
    );
    return null;
  }
}

/** @returns {string|null} latest changelog version, or null */
function getLatestVersion() {
  const entry = getLatestEntry();
  return entry ? entry.version : null;
}

/**
 * Post the latest changelog entry to every active org's bot channel that
 * hasn't seen it. Null marker = seed silently (no post). Never throws.
 * @param {object} client - Slack WebClient (app.client)
 * @param {{mode?: 'live'|'dry'|'off'}} [opts]
 */
async function broadcastOnDeploy(client, opts = {}) {
  const mode = (
    opts.mode ||
    process.env.CHANGELOG_BROADCAST ||
    "live"
  ).toLowerCase();

  if (mode === "off") {
    logger.info("Changelog broadcast: disabled (CHANGELOG_BROADCAST=off)");
    return;
  }
  if (!client) return;

  const entry = getLatestEntry();
  if (!entry) return;
  const latest = entry.version;
  const dryRun = mode === "dry";

  const orgs = await prisma.organization.findMany({
    where: { isActive: true, botChannelId: { not: null } },
    select: {
      id: true,
      name: true,
      botChannelId: true,
      lastBroadcastVersion: true,
    },
  });

  const blocks = createChangelogBroadcastBlocks(
    entry,
    `${getWebUrl()}/changelog`
  );
  const fallbackText = `What's new in Daily Dose v${latest}`;

  for (const org of orgs) {
    if (org.lastBroadcastVersion === latest) continue;

    // Never-seen org: seed the marker silently, don't post.
    if (org.lastBroadcastVersion == null) {
      if (!dryRun) {
        await prisma.organization.update({
          where: { id: org.id },
          data: { lastBroadcastVersion: latest },
        });
      }
      logger.info(
        `Changelog broadcast: seeded org "${org.name}" to v${latest} (no post)`
      );
      continue;
    }

    if (dryRun) {
      logger.info(
        `Changelog broadcast [dry]: would post v${latest} to ${org.botChannelId} (org "${org.name}")`
      );
      continue;
    }

    try {
      await client.chat.postMessage({
        channel: org.botChannelId,
        text: fallbackText,
        blocks,
      });
      await prisma.organization.update({
        where: { id: org.id },
        data: { lastBroadcastVersion: latest },
      });
      logger.info(
        `Changelog broadcast: posted v${latest} to org "${org.name}"`
      );
    } catch (err) {
      logger.warn(
        `Changelog broadcast: failed for org "${org.name}" (${org.botChannelId}):`,
        err.data?.error || err.message
      );
    }
    await sleep(SLEEP_MS);
  }
}

module.exports = { getLatestEntry, getLatestVersion, broadcastOnDeploy };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest test/services/changelogBroadcastService.test.js`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/services/changelogBroadcastService.js test/services/changelogBroadcastService.test.js
git commit -m "feat(service): changelogBroadcastService posts releases to org channels"
```

---

## Task 4: Wire the broadcast into app boot

**Files:**

- Modify: `src/app.js` (imports near line 9; the start IIFE at lines 195-201)

**Interfaces:**

- Consumes: `changelogBroadcastService.broadcastOnDeploy` (Task 3), `app.client`.

- [ ] **Step 1: Add imports**

In `src/app.js`, after the existing `schedulerService` require (line 9), add:

```js
const changelogBroadcastService = require("./services/changelogBroadcastService");
const logger = require("./utils/logger");
```

(If `logger` is already required in this file, skip that line.)

- [ ] **Step 2: Add the fire-and-forget call after `app.start`**

Change the start IIFE (lines 195-201) to:

```js
// Start app
(async () => {
  const port = process.env.PORT || 3000;
  const host = process.env.HOST || "localhost";
  await app.start(port);
  console.log(`⚡️ Daily Dose bot is running on ${host}:${port}`);

  // Fire-and-forget: announce the latest changelog to org channels.
  // Must never block startup or crash the process.
  changelogBroadcastService
    .broadcastOnDeploy(app.client)
    .catch((err) => logger.error("Changelog broadcast failed:", err.message));
})();
```

- [ ] **Step 3: Verify the app boots and the broadcast runs in dry mode**

Run: `CHANGELOG_BROADCAST=dry node src/app.js`
Expected: the app prints its running banner, and within a few seconds the logs show either `Changelog broadcast [dry]: would post …` / `seeded …` lines or no org lines (depending on dev DB). No crash. Stop with Ctrl-C.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all tests pass (no regressions).

- [ ] **Step 5: Commit**

```bash
git add src/app.js
git commit -m "feat(app): broadcast changelog to org channels on deploy"
```

---

## Task 5: Stamp `lastBroadcastVersion` at org creation

**Files:**

- Modify: `src/routes/admin.js` (org-creation handler, `prisma.organization.create` ~line 337)

**Interfaces:**

- Consumes: `changelogBroadcastService.getLatestVersion()` (Task 3).

- [ ] **Step 1: Import the service**

At the top of `src/routes/admin.js`, alongside the existing `channelService` require, add:

```js
const changelogBroadcastService = require("../services/changelogBroadcastService");
```

- [ ] **Step 2: Stamp the version in the create call**

In the `prisma.organization.create` call (~line 337), add the field so new orgs start at the current version (and therefore receive their first _future_ release rather than being silently seeded):

```js
const org = await prisma.organization.create({
  data: {
    name: name.trim(),
    slackWorkspaceId: slackWorkspaceId?.trim() || null,
    slackWorkspaceName: slackWorkspaceName?.trim() || null,
    defaultTimezone: defaultTimezone?.trim() || "America/New_York",
    lastBroadcastVersion: changelogBroadcastService.getLatestVersion(),
  },
});
```

- [ ] **Step 3: Verify it parses and the existing admin route tests still pass**

Run: `npx jest test/routes/admin.test.js`
Expected: PASS (no regressions). If the test suite stubs org creation, it remains green; the new field is additive.

- [ ] **Step 4: Commit**

```bash
git add src/routes/admin.js
git commit -m "feat(admin): stamp lastBroadcastVersion when creating an org"
```

---

## Task 6: Documentation

**Files:**

- Modify: `CHANGELOG.md` (the `## [Unreleased]` → `### Added` list, ~line 9-15)
- Modify: `README.md` (env/config section)
- Modify: `CLAUDE.md` (Environment Configuration section)

**Interfaces:** none.

- [ ] **Step 1: Add a CHANGELOG.md entry**

Under `## [Unreleased]` → `### Added`, append:

```markdown
- Auto-broadcast the latest user-facing changelog entry to each org's `daily-dose-bot` channel on deploy (`src/services/changelogBroadcastService.js`, fired from `src/app.js` after `app.start`). Per-org `Organization.lastBroadcastVersion` marker prevents re-posting on restarts; a `null` marker is seeded silently so existing orgs aren't mass-blasted on first deploy, and new orgs are stamped with the current version at creation. Set `CHANGELOG_BROADCAST=off` to disable or `=dry` to preview without posting.
```

- [ ] **Step 2: Document the env var in README.md**

In the README's environment-variables/configuration section, add a line:

```markdown
- `CHANGELOG_BROADCAST` (optional) — controls the on-deploy changelog announcement to each org's `daily-dose-bot` channel. `off` disables it; `dry` logs targets without posting; unset/anything else = live.
```

(Place it near other optional app settings; match the surrounding list style.)

- [ ] **Step 3: Document the env var in CLAUDE.md**

In CLAUDE.md under **Environment Configuration → App settings**, add `CHANGELOG_BROADCAST` to the list of optional settings with a one-line description matching the README wording.

- [ ] **Step 4: Verify markdown lints/formats**

Run: `npm run format`
Expected: no errors; files reformatted if needed.

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md README.md CLAUDE.md
git commit -m "docs: document on-deploy changelog broadcast + CHANGELOG_BROADCAST env"
```

---

## Final Verification

- [ ] Run the full suite: `npm test` — all green.
- [ ] `git log --oneline` shows the six task commits.
- [ ] Manual sanity (optional, needs a dev workspace): with a real `botChannelId` org whose `lastBroadcastVersion` is an older version, run `node src/app.js` and confirm one post lands in that org's channel and the marker advances; restart and confirm no second post.
