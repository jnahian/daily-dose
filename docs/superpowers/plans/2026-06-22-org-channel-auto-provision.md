# Org Channel Auto-Provision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-create a per-org `daily-dose-bot` Slack channel when an organization is created, and auto-invite users to their org's channel when they join a team.

**Architecture:** A new best-effort `channelService` wraps the Slack channel API (`conversations.create` / `conversations.invite`) and persists the channel ID on `Organization.botChannelId`. Org creation (admin route) calls `ensureOrgChannel`; all three team-join paths call `inviteUserToOrgChannel`. Every Slack call is best-effort — failures are logged and never roll back the core DB operation. Backfill for existing orgs/members is a separate manual script.

**Tech Stack:** Node.js, Slack Bolt / `@slack/web-api` `WebClient`, Prisma (PostgreSQL/Supabase), Jest.

**Issue:** [#50](https://github.com/jnahian/daily-dose/issues/50) • **Spec:** `docs/superpowers/specs/2026-06-22-org-channel-auto-provision-design.md`

## Global Constraints

- **Best-effort, never blocking:** No Slack channel/invite failure may throw out of `channelService` or roll back org creation / team join. Functions return a value, never throw.
- **Channel name:** base name is exactly `daily-dose-bot`. On Slack `name_taken`, fall back to `daily-dose-bot-2`, `daily-dose-bot-3`, … (max 5 attempts).
- **Scope already added:** `channels:manage` is in `slack-app-manifest.json` (covers create + invite). No further scope work in code; the app must be re-installed to the workspace for it to take effect (operational, out of plan).
- **Slack rate limit:** ~1 req/sec/channel. The backfill script processes orgs and invites sequentially with a delay; never parallelize.
- **Migrations:** repo uses committed Prisma migrations (`prisma/migrations/`), not bare `db push`.
- **Changelogs:** this is a user-facing bot behavior → update both `CHANGELOG.md` (technical) and `web/src/data/changelog.json` (user-facing). (The admin-panel UI itself is not the feature; the auto-channel/auto-invite behavior is.)

---

## File Structure

- **Create** `src/services/channelService.js` — best-effort Slack channel wrapper (`ensureOrgChannel`, `inviteUserToOrgChannel`).
- **Create** `test/services/channelService.test.js` — unit tests for the service.
- **Create** `test/services/teamServiceChannelInvite.test.js` — verifies join paths call the invite.
- **Create** `scripts/backfillOrgChannels.js` — one-off backfill for existing orgs/members.
- **Modify** `prisma/schema.prisma` — add `Organization.botChannelId`.
- **Create** `prisma/migrations/<ts>_add_org_bot_channel_id/migration.sql` — generated.
- **Modify** `src/services/teamService.js` — invite on `joinTeam` and `createTeam`.
- **Modify** `src/routes/admin.js` — `ensureOrgChannel` on org create; invite on `POST /team-members`.
- **Modify** `package.json` — add `channels:backfill` script alias.
- **Modify** `CHANGELOG.md`, `web/src/data/changelog.json`, `README.md` — docs.

---

## Task 1: Add `botChannelId` to Organization (schema + migration)

**Files:**

- Modify: `prisma/schema.prisma:11-27` (Organization model)
- Create: `prisma/migrations/<timestamp>_add_org_bot_channel_id/migration.sql` (generated)

**Interfaces:**

- Produces: `Organization.botChannelId` — nullable `String?`, DB column `bot_channel_id`. Consumed by `channelService` (Task 2/3).

- [ ] **Step 1: Add the column to the schema**

In `prisma/schema.prisma`, inside `model Organization`, add the field after `defaultTimezone` (line 16):

```prisma
  botChannelId       String?              @map("bot_channel_id")
```

- [ ] **Step 2: Generate and apply the migration**

Run:

```bash
npx prisma migrate dev --name add_org_bot_channel_id
```

Expected: a new folder `prisma/migrations/<timestamp>_add_org_bot_channel_id/` containing `migration.sql` with `ALTER TABLE "organizations" ADD COLUMN "bot_channel_id" TEXT;`, and "Your database is now in sync with your schema."

- [ ] **Step 3: Verify the Prisma client knows the field**

Run:

```bash
node -e "const p=require('./src/config/prisma'); console.log('bot_channel_id' in p.organization.fields ? 'ok' : (Object.keys(require('@prisma/client').Prisma.OrganizationScalarFieldEnum)))"
```

Expected: prints `ok` (the `botChannelId`/`bot_channel_id` scalar exists). If it prints the enum list instead, confirm `botChannelId` appears in it.

- [ ] **Step 4: Run the suite to confirm nothing broke**

Run: `npm test`
Expected: PASS (same baseline as before the change).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add Organization.botChannelId for org slack channel (#50)"
```

---

## Task 2: `channelService.ensureOrgChannel`

**Files:**

- Create: `src/services/channelService.js`
- Test: `test/services/channelService.test.js`

**Interfaces:**

- Consumes: `prisma.organization.update`, `src/utils/logger` (`warn`).
- Produces: `ensureOrgChannel(client, org) → Promise<string|null>`. `client` is a Slack `WebClient`; `org` is an object with `{ id, botChannelId }`. Returns the channel ID (existing or newly created) or `null` on failure. Idempotent; never throws.

- [ ] **Step 1: Write the failing tests**

Create `test/services/channelService.test.js`:

```js
jest.mock("../../src/config/prisma", () => ({
  organization: { update: jest.fn(), findUnique: jest.fn() },
}));
jest.mock("../../src/utils/logger", () => ({ warn: jest.fn() }));

const prisma = require("../../src/config/prisma");
const { ensureOrgChannel } = require("../../src/services/channelService");

function makeClient() {
  return { conversations: { create: jest.fn(), invite: jest.fn() } };
}

beforeEach(() => jest.clearAllMocks());

describe("ensureOrgChannel", () => {
  it("returns the existing channel id without calling Slack", async () => {
    const client = makeClient();
    const id = await ensureOrgChannel(client, {
      id: "o1",
      botChannelId: "C_OLD",
    });
    expect(id).toBe("C_OLD");
    expect(client.conversations.create).not.toHaveBeenCalled();
  });

  it("creates the channel and persists the id when none exists", async () => {
    const client = makeClient();
    client.conversations.create.mockResolvedValue({
      ok: true,
      channel: { id: "C_NEW" },
    });
    const id = await ensureOrgChannel(client, { id: "o1", botChannelId: null });
    expect(client.conversations.create).toHaveBeenCalledWith({
      name: "daily-dose-bot",
      is_private: false,
    });
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: { botChannelId: "C_NEW" },
    });
    expect(id).toBe("C_NEW");
  });

  it("retries with a suffixed name on name_taken", async () => {
    const client = makeClient();
    client.conversations.create
      .mockRejectedValueOnce({ data: { error: "name_taken" } })
      .mockResolvedValueOnce({ channel: { id: "C2" } });
    const id = await ensureOrgChannel(client, { id: "o1", botChannelId: null });
    expect(client.conversations.create).toHaveBeenNthCalledWith(2, {
      name: "daily-dose-bot-2",
      is_private: false,
    });
    expect(id).toBe("C2");
  });

  it("returns null and does not persist on a non-name error", async () => {
    const client = makeClient();
    client.conversations.create.mockRejectedValue({
      data: { error: "missing_scope" },
    });
    const id = await ensureOrgChannel(client, { id: "o1", botChannelId: null });
    expect(id).toBeNull();
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it("returns null when client is missing", async () => {
    expect(
      await ensureOrgChannel(null, { id: "o1", botChannelId: null })
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/services/channelService.test.js`
Expected: FAIL — `Cannot find module '../../src/services/channelService'`.

- [ ] **Step 3: Write the implementation**

Create `src/services/channelService.js`:

```js
const prisma = require("../config/prisma");
const logger = require("../utils/logger");

const BASE_CHANNEL_NAME = "daily-dose-bot";
const MAX_NAME_ATTEMPTS = 5;

/**
 * Create (or reuse) the org's "daily-dose-bot" Slack channel and persist its
 * ID on the Organization. Idempotent and best-effort: never throws.
 * @param {object} client - Slack WebClient
 * @param {{id: string, botChannelId: ?string}} org
 * @returns {Promise<string|null>} channel ID, or null on failure
 */
async function ensureOrgChannel(client, org) {
  if (!client || !org) return null;
  if (org.botChannelId) return org.botChannelId;

  for (let attempt = 1; attempt <= MAX_NAME_ATTEMPTS; attempt++) {
    const name =
      attempt === 1 ? BASE_CHANNEL_NAME : `${BASE_CHANNEL_NAME}-${attempt}`;
    try {
      const result = await client.conversations.create({
        name,
        is_private: false,
      });
      const channelId = result.channel.id;
      await prisma.organization.update({
        where: { id: org.id },
        data: { botChannelId: channelId },
      });
      return channelId;
    } catch (err) {
      if (err.data?.error === "name_taken") continue;
      logger.warn(
        `ensureOrgChannel failed for org ${org.id}:`,
        err.data?.error || err.message
      );
      return null;
    }
  }
  logger.warn(`ensureOrgChannel: exhausted name attempts for org ${org.id}`);
  return null;
}

module.exports = { ensureOrgChannel };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest test/services/channelService.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/channelService.js test/services/channelService.test.js
git commit -m "feat: channelService.ensureOrgChannel for org slack channel (#50)"
```

---

## Task 3: `channelService.inviteUserToOrgChannel`

**Files:**

- Modify: `src/services/channelService.js`
- Modify: `test/services/channelService.test.js`

**Interfaces:**

- Consumes: `prisma.organization.findUnique`, `src/utils/logger`.
- Produces: `inviteUserToOrgChannel(client, orgId, slackUserId) → Promise<boolean>`. Self-fetches the org's `botChannelId` (so callers needn't preload it). Returns `true` if invited or already a member, `false` otherwise. Never throws.

- [ ] **Step 1: Add the failing tests**

Append to `test/services/channelService.test.js` (and add `inviteUserToOrgChannel` to the `require` at the top, i.e. `const { ensureOrgChannel, inviteUserToOrgChannel } = require("../../src/services/channelService");`):

```js
describe("inviteUserToOrgChannel", () => {
  it("no-ops and returns false when the org has no channel", async () => {
    prisma.organization.findUnique.mockResolvedValue({ botChannelId: null });
    const client = makeClient();
    const ok = await inviteUserToOrgChannel(client, "o1", "U1");
    expect(ok).toBe(false);
    expect(client.conversations.invite).not.toHaveBeenCalled();
  });

  it("invites the user when the org has a channel", async () => {
    prisma.organization.findUnique.mockResolvedValue({ botChannelId: "C1" });
    const client = makeClient();
    client.conversations.invite.mockResolvedValue({ ok: true });
    const ok = await inviteUserToOrgChannel(client, "o1", "U1");
    expect(client.conversations.invite).toHaveBeenCalledWith({
      channel: "C1",
      users: "U1",
    });
    expect(ok).toBe(true);
  });

  it("treats already_in_channel as success", async () => {
    prisma.organization.findUnique.mockResolvedValue({ botChannelId: "C1" });
    const client = makeClient();
    client.conversations.invite.mockRejectedValue({
      data: { error: "already_in_channel" },
    });
    expect(await inviteUserToOrgChannel(client, "o1", "U1")).toBe(true);
  });

  it("returns false on other invite errors", async () => {
    prisma.organization.findUnique.mockResolvedValue({ botChannelId: "C1" });
    const client = makeClient();
    client.conversations.invite.mockRejectedValue({
      data: { error: "missing_scope" },
    });
    expect(await inviteUserToOrgChannel(client, "o1", "U1")).toBe(false);
  });

  it("returns false when args are missing", async () => {
    const client = makeClient();
    expect(await inviteUserToOrgChannel(client, "o1", null)).toBe(false);
    expect(prisma.organization.findUnique).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/services/channelService.test.js -t inviteUserToOrgChannel`
Expected: FAIL — `inviteUserToOrgChannel is not a function`.

- [ ] **Step 3: Add the implementation**

In `src/services/channelService.js`, add the function and export it:

```js
/**
 * Invite a user to the org's daily-dose-bot channel. Best-effort: never throws.
 * Looks up the org's botChannelId itself so callers needn't preload it.
 * @param {object} client - Slack WebClient
 * @param {string} orgId
 * @param {string} slackUserId
 * @returns {Promise<boolean>} true if invited or already a member
 */
async function inviteUserToOrgChannel(client, orgId, slackUserId) {
  if (!client || !orgId || !slackUserId) return false;
  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { botChannelId: true },
    });
    if (!org?.botChannelId) return false;
    await client.conversations.invite({
      channel: org.botChannelId,
      users: slackUserId,
    });
    return true;
  } catch (err) {
    if (err.data?.error === "already_in_channel") return true;
    logger.warn(
      `inviteUserToOrgChannel failed (org ${orgId}, user ${slackUserId}):`,
      err.data?.error || err.message
    );
    return false;
  }
}
```

Update the export line to:

```js
module.exports = { ensureOrgChannel, inviteUserToOrgChannel };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest test/services/channelService.test.js`
Expected: PASS (10 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/services/channelService.js test/services/channelService.test.js
git commit -m "feat: channelService.inviteUserToOrgChannel (#50)"
```

---

## Task 4: Invite on team join (`teamService.joinTeam` + `createTeam`)

**Files:**

- Modify: `src/services/teamService.js:1-9` (add require), `:104` (createTeam return), `:267-284` (joinTeam upsert/return)
- Test: `test/services/teamServiceChannelInvite.test.js`

**Interfaces:**

- Consumes: `channelService.inviteUserToOrgChannel(client, orgId, slackUserId)` from Task 3.
- In `joinTeam`, the org id is `team.organizationId`; the Slack user id is the `slackUserId` parameter; the Slack client is the `slackClient` parameter.
- In `createTeam`, the org id is `org.id`; the Slack user id is the `slackUserId` parameter; the Slack client is the `slackClient` parameter.

- [ ] **Step 1: Write the failing tests**

Create `test/services/teamServiceChannelInvite.test.js`:

```js
jest.mock("../../src/config/prisma", () => ({
  team: { findUnique: jest.fn(), create: jest.fn() },
  teamMember: { findUnique: jest.fn(), upsert: jest.fn(), create: jest.fn() },
  $transaction: jest.fn(),
}));
jest.mock("../../src/services/userService", () => ({
  fetchSlackUserData: jest.fn().mockResolvedValue({}),
  findOrCreateUser: jest.fn(),
  getUserOrganization: jest.fn(),
  getOrganizationByWorkspaceId: jest.fn(),
  addUserToOrganization: jest.fn(),
  canCreateTeam: jest.fn(),
}));
jest.mock("../../src/services/channelService", () => ({
  inviteUserToOrgChannel: jest.fn().mockResolvedValue(true),
  ensureOrgChannel: jest.fn(),
}));

const prisma = require("../../src/config/prisma");
const userService = require("../../src/services/userService");
const channelService = require("../../src/services/channelService");
const teamService = require("../../src/services/teamService");

beforeEach(() => {
  jest.clearAllMocks();
  userService.findOrCreateUser.mockResolvedValue({ id: "u1" });
});

it("joinTeam invites the user to the org channel", async () => {
  prisma.team.findUnique.mockResolvedValue({
    id: "t1",
    organizationId: "o1",
    organization: { id: "o1" },
  });
  userService.getUserOrganization.mockResolvedValue({ id: "o1" });
  prisma.teamMember.findUnique.mockResolvedValue(null);
  prisma.teamMember.upsert.mockResolvedValue({ id: "tm1" });

  const client = { conversations: {} };
  await teamService.joinTeam("U1", "t1", client);

  expect(channelService.inviteUserToOrgChannel).toHaveBeenCalledWith(
    client,
    "o1",
    "U1"
  );
});

it("createTeam invites the creator to the org channel", async () => {
  userService.getUserOrganization.mockResolvedValue({
    id: "o1",
    defaultTimezone: "UTC",
  });
  userService.canCreateTeam.mockResolvedValue(true);
  prisma.team.findUnique.mockResolvedValue(null); // no existing team for channel
  prisma.$transaction.mockImplementation(async (cb) => cb(prisma));
  prisma.team.create.mockResolvedValue({ id: "t1" });
  prisma.teamMember.create.mockResolvedValue({});

  const client = { conversations: {} };
  await teamService.createTeam(
    "U1",
    "C1",
    { name: "Eng", standupTime: "09:30", postingTime: "10:00" },
    "W1",
    client
  );

  expect(channelService.inviteUserToOrgChannel).toHaveBeenCalledWith(
    client,
    "o1",
    "U1"
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/services/teamServiceChannelInvite.test.js`
Expected: FAIL — `inviteUserToOrgChannel` not called (it isn't wired yet).

- [ ] **Step 3: Wire `channelService` into teamService**

In `src/services/teamService.js`, add the require after line 5 (with the other requires):

```js
const channelService = require("./channelService");
```

In `joinTeam`, replace the final return (lines 267-284) so the upsert result is captured, the invite fires best-effort, then the member is returned:

```js
// Add as member
const member = await prisma.teamMember.upsert({
  where: {
    teamId_userId: {
      teamId: team.id,
      userId: user.id,
    },
  },
  update: {
    isActive: true,
  },
  create: {
    teamId: team.id,
    userId: user.id,
    role: "MEMBER",
    isActive: true,
  },
});

// Best-effort: add the member to the org's daily-dose-bot channel.
await channelService.inviteUserToOrgChannel(
  slackClient,
  team.organizationId,
  slackUserId
);

return member;
```

In `createTeam`, just before the final `return { team, status, ... }` (line 104), add:

```js
// Best-effort: add the creator to the org's daily-dose-bot channel.
await channelService.inviteUserToOrgChannel(slackClient, org.id, slackUserId);
```

- [ ] **Step 4: Run the new tests + full suite**

Run: `npx jest test/services/teamServiceChannelInvite.test.js && npm test`
Expected: PASS — both new tests pass and the existing suite (including `teamServiceApproval.test.js`) is green.

- [ ] **Step 5: Commit**

```bash
git add src/services/teamService.js test/services/teamServiceChannelInvite.test.js
git commit -m "feat: invite members to org channel on team join (#50)"
```

---

## Task 5: Provision channel on org creation + invite on admin add-member (`admin.js`)

**Files:**

- Modify: `src/routes/admin.js` — add `channelService` require near the top (alongside the existing `slackClient` WebClient at lines 5-6); call `ensureOrgChannel` in `POST /organizations` (after line 343); add invite in `POST /team-members` (after line 886).

**Interfaces:**

- Consumes: `channelService.ensureOrgChannel(slackClient, org)` and `channelService.inviteUserToOrgChannel(slackClient, orgId, slackUserId)` (Tasks 2-3); the module-level `slackClient` (`new WebClient(process.env.BOT_TOKEN)`).

**Testing note:** `test/routes/admin.test.js` only exercises middleware (`requireAuth`/`requireSuperAdmin`) directly — it has no supertest harness for route handlers, and the handlers aren't exported. Adding one for two best-effort one-liners over an already-unit-tested service is not worth the brittleness. These hooks are verified manually (Step 4) instead. Do not invent a route-handler test harness.

- [ ] **Step 1: Add the require**

In `src/routes/admin.js`, near the top requires (after the `WebClient` setup on lines 5-6), add:

```js
const channelService = require("../services/channelService");
```

- [ ] **Step 2: Provision the channel on org creation**

In `POST /organizations`, immediately after `const org = await prisma.organization.create({ ... });` (currently ends line 343) and before `res.status(201).json({`, add:

```js
// Best-effort: create the org's daily-dose-bot Slack channel.
await channelService.ensureOrgChannel(slackClient, org);
```

- [ ] **Step 3: Invite on admin add-member**

In `POST /team-members`, after the `if (existing) { ... } else { ... }` block that sets `teamMember` (currently ends line 886) and before `res.status(201).json({`, add:

```js
// Best-effort: add the member to the org's daily-dose-bot channel.
const memberUser = await prisma.user.findUnique({
  where: { id: userId },
  select: { slackUserId: true },
});
if (memberUser?.slackUserId) {
  await channelService.inviteUserToOrgChannel(
    slackClient,
    team.organizationId,
    memberUser.slackUserId
  );
}
```

- [ ] **Step 4: Verify wiring (lint + full suite + manual)**

Run: `npm run lint && npm test`
Expected: PASS, no unused-var or undefined errors; existing `admin.test.js` still green.

Manual (requires the app re-installed with `channels:manage`):

1. In the admin panel, create a new organization → a `daily-dose-bot` channel appears in the workspace; the org row's `bot_channel_id` is populated (check via `npx prisma studio`).
2. Add a member to a team via the admin panel → that user is added to the `daily-dose-bot` channel.

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin.js
git commit -m "feat: provision org channel on create + invite on admin add-member (#50)"
```

---

## Task 6: Backfill script for existing orgs/members

**Files:**

- Create: `scripts/backfillOrgChannels.js`
- Modify: `package.json` (scripts section, near the other `*:` aliases around lines 14-24)

**Interfaces:**

- Consumes: `channelService.ensureOrgChannel`, `channelService.inviteUserToOrgChannel`, `prisma`, `logger`, `@slack/web-api` `WebClient`.
- Produces: `npm run channels:backfill` (with optional `--dry-run`).

- [ ] **Step 1: Write the script**

Create `scripts/backfillOrgChannels.js`:

```js
#!/usr/bin/env node

require("dotenv").config();
const { WebClient } = require("@slack/web-api");
const prisma = require("../src/config/prisma");
const channelService = require("../src/services/channelService");
const logger = require("../src/utils/logger");

const DRY_RUN = process.argv.includes("--dry-run");
const SLEEP_MS = 1200; // Slack ~1 req/sec/channel — stay under the limit.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const client = new WebClient(process.env.BOT_TOKEN);

  const orgs = await prisma.organization.findMany({
    where: { isActive: true },
    include: {
      teams: {
        where: { deletedAt: null },
        include: {
          members: {
            where: { isActive: true },
            include: { user: true },
          },
        },
      },
    },
  });

  logger.info(`Backfill${DRY_RUN ? " (dry-run)" : ""}: ${orgs.length} org(s)`);

  for (const org of orgs) {
    logger.info(`Org "${org.name}" (${org.id})`);

    let channelId = org.botChannelId;
    if (!channelId) {
      if (DRY_RUN) {
        logger.info("  [dry-run] would create daily-dose-bot channel");
      } else {
        channelId = await channelService.ensureOrgChannel(client, org);
        await sleep(SLEEP_MS);
        if (!channelId) {
          logger.warn("  could not create channel; skipping invites");
          continue;
        }
      }
    }

    const slackUserIds = new Set();
    for (const team of org.teams) {
      for (const m of team.members) {
        if (m.user?.slackUserId) slackUserIds.add(m.user.slackUserId);
      }
    }

    for (const uid of slackUserIds) {
      if (DRY_RUN) {
        logger.info(`  [dry-run] would invite ${uid}`);
        continue;
      }
      await channelService.inviteUserToOrgChannel(client, org.id, uid);
      await sleep(SLEEP_MS);
    }
    logger.info(`  ${slackUserIds.size} member(s) processed`);
  }

  logger.info("Backfill complete.");
}

main()
  .catch((err) => {
    logger.error("Backfill failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Add the npm alias**

In `package.json`, add to the `scripts` block (next to the other aliases):

```json
    "channels:backfill": "node scripts/backfillOrgChannels.js",
```

- [ ] **Step 3: Verify the script loads and dry-run works**

Run: `npm run channels:backfill -- --dry-run`
Expected: it connects, lists each active org, and logs `[dry-run] would create…` / `[dry-run] would invite…` lines with no Slack writes and no thrown errors. (Requires a valid `BOT_TOKEN` and DB connection in `.env`.)

- [ ] **Step 4: Commit**

```bash
git add scripts/backfillOrgChannels.js package.json
git commit -m "feat: add channels:backfill script for existing orgs (#50)"
```

---

## Task 7: Documentation (changelogs + README)

**Files:**

- Modify: `CHANGELOG.md` (technical, under Unreleased/next version)
- Modify: `web/src/data/changelog.json` (user-facing)
- Modify: `README.md` (behavior + scope note)

- [ ] **Step 1: Update `CHANGELOG.md`**

Add an entry under the top `## [Unreleased]` section (create the section if absent), e.g.:

```markdown
### Added

- Auto-provision a per-org `daily-dose-bot` Slack channel on organization creation (`channelService.ensureOrgChannel`, stored on `Organization.botChannelId`).
- Auto-invite members to their org's `daily-dose-bot` channel on team join (`/dd-team-join`, team creation, and admin add-member). Best-effort; failures are logged, never blocking.
- `npm run channels:backfill` (supports `--dry-run`) to create channels and invite current members for existing orgs.
- Added `channels:manage` bot scope to the Slack manifest.
```

- [ ] **Step 2: Update `web/src/data/changelog.json`**

Add a user-facing entry (match the existing JSON shape — inspect the first entry in the file and mirror its keys/format). Plain-language summary, no internal names:

> Your organization now gets a dedicated **#daily-dose-bot** channel automatically, and new team members are added to it when they join — so everyone lands in one shared space without any manual setup.

- [ ] **Step 3: Update `README.md`**

In the relevant features / Slack-setup section, note that orgs get an auto-created `daily-dose-bot` channel and members are auto-added on team join, and that the bot now requires the `channels:manage` scope (re-install the app after updating the manifest).

- [ ] **Step 4: Verify the JSON is valid**

Run: `node -e "require('./web/src/data/changelog.json'); console.log('valid json')"`
Expected: prints `valid json`.

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md web/src/data/changelog.json README.md
git commit -m "docs: changelog + readme for org channel auto-provision (#50)"
```

---

## Self-Review (completed during authoring)

- **Spec coverage:** data model (T1), `channelService` create/invite (T2/T3), org-create hook + admin add-member hook (T5), team-join hooks (T4), scopes (already committed; documented in T7), backfill script (T6), error handling (best-effort in every service function), testing (T2-T4), documentation (T7). All spec sections map to a task.
- **Type/name consistency:** `ensureOrgChannel(client, org)` and `inviteUserToOrgChannel(client, orgId, slackUserId)` are used with identical signatures across T4-T6. `botChannelId` / `bot_channel_id` consistent between T1 and the service. Channel name `daily-dose-bot` consistent everywhere.
- **Placeholders:** none — every code/test step contains full content.
- **Known testing boundary (intentional):** admin-route hooks (T5) are verified by lint + manual steps, not a new supertest harness, because the existing route tests don't exercise handlers and the wiring is a thin call over the unit-tested service.
