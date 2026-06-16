# Standup MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose Daily Dose standup features over MCP so team members can submit/update/view standups (and admins can read team views and run actions) from any AI agent, authenticated by a bearer token minted via Slack login.

**Architecture:** A Streamable-HTTP MCP server is embedded in the existing Bolt/Express app at `POST /mcp`. Requests carry `Authorization: Bearer <token>`; middleware resolves the token (hashed in a new `mcp_tokens` table) to a Slack user. Tools call the existing services — with the submit/late-post logic first extracted out of the Slack command handler into a shared `standupService.submitStandup` method so MCP and Slack stay behaviorally identical.

**Tech Stack:** Node.js (CommonJS), `@slack/bolt` ExpressReceiver, Prisma/PostgreSQL, `@modelcontextprotocol/sdk` (new dep), `zod` (new dep), Jest, React 19 (admin/token web page).

---

## Deviations from the spec (read first)

Two facts discovered during planning that refine the approved spec (`docs/superpowers/specs/2026-06-16-standup-mcp-server-design.md`):

1. **The admin OAuth callback cannot be reused verbatim.** `src/routes/admin.js:219-223` rejects any user who is not a super-admin or org OWNER/ADMIN. Phase 1 is for _all_ members, so this plan adds a **parallel** OAuth flow (`/api/mcp/auth/slack` + `/api/mcp/auth/callback`) that shares the existing `sessions` table and `requireAuth` machinery but only requires the user to exist in `users`. This realizes the spec's stated intent ("authenticates any Slack user").

2. **No `postStandupForTeam` extraction is needed.** The posting logic already lives in `standupService.postTeamStandup(team, date, slackApp)`. Only the _submit/update_ logic (currently inside the Slack handler) needs extraction. Phase 3 tools (out of this plan's full detail) will call `postTeamStandup` directly.

## File structure

**Create**

- `prisma/migrations/<timestamp>_add_mcp_tokens/migration.sql` — `mcp_tokens` table
- `src/services/mcpTokenService.js` — mint / hash / validate / revoke / list tokens
- `src/routes/mcpAuth.js` — Slack OAuth flow + token CRUD API (member-gated, not admin-gated)
- `src/mcp/teamResolver.js` — resolve a team identifier (id or name) for a Slack user
- `src/mcp/tools.js` — registers Phase 1 MCP tools onto an `McpServer`
- `src/mcp/server.js` — builds a per-request `McpServer` bound to a user; exports the Express handler + `validateMcpToken` middleware
- `web/src/pages/McpTokens.tsx` — token management page (mint/list/revoke)
- `test/services/standupServiceSubmit.test.js`
- `test/services/mcpTokenService.test.js`
- `test/mcp/teamResolver.test.js`
- `test/mcp/tools.test.js`

**Modify**

- `prisma/schema.prisma` — add `mcp_tokens` model + relation on `User`
- `src/services/standupService.js` — add `submitStandup(...)`
- `src/commands/standup.js` — `handleStandupSubmission` / `handleStandupUpdateSubmission` call `submitStandup`
- `src/app.js` — mount `mcpAuth` router and the `/mcp` endpoint, passing the Bolt `app`
- `web/src/App.tsx` — route for the token page
- `package.json` — add `@modelcontextprotocol/sdk`, `zod`
- `CHANGELOG.md`, `web/src/data/changelog.json`, `README.md`

---

## Task 1: Extract `submitStandup` into standupService (the load-bearing refactor)

This moves the isLate calculation, admin notification, and late→thread/parent-post logic out of `src/commands/standup.js` (`handleStandupSubmission` lines ~260-351 and the parallel block in `handleStandupUpdateSubmission`) into one shared service method that both Slack and MCP call.

**Files:**

- Modify: `src/services/standupService.js`
- Test: `test/services/standupServiceSubmit.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/services/standupServiceSubmit.test.js`:

```js
jest.mock("../../src/config/prisma", () => ({}));
jest.mock("../../src/services/userService", () => ({
  fetchSlackUserData: jest.fn(),
  findOrCreateUser: jest.fn(),
}));
jest.mock("../../src/services/notificationService", () => ({
  notifyAdminsOfStandupSubmission: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const dayjs = require("dayjs");
const standupService = require("../../src/services/standupService");
const notificationService = require("../../src/services/notificationService");

const team = {
  id: "team-1",
  name: "Eng",
  timezone: "Asia/Dhaka",
  postingTime: "11:00",
  slackChannelId: "C123",
};

function buildArgs(overrides = {}) {
  return {
    team,
    slackUserId: "U1",
    name: "Alice",
    fields: { yesterdayTasks: "y", todayTasks: "t", blockers: "" },
    standupDate: dayjs().tz(team.timezone).startOf("day").toDate(),
    isUpdate: false,
    slackClient: { chat: { postMessage: jest.fn() } },
    ...overrides,
  };
}

describe("standupService.submitStandup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(standupService, "saveResponse").mockResolvedValue({ id: "r1" });
    jest.spyOn(standupService, "getStandupPost").mockResolvedValue(null);
    jest.spyOn(standupService, "postStandupOnDemand").mockResolvedValue({});
  });

  it("saves the response and notifies admins", async () => {
    const args = buildArgs();
    await standupService.submitStandup(args);

    expect(standupService.saveResponse).toHaveBeenCalledWith(
      "team-1",
      "U1",
      expect.objectContaining({ yesterdayTasks: "y", todayTasks: "t" }),
      expect.any(Boolean),
      args.slackClient
    );
    expect(
      notificationService.notifyAdminsOfStandupSubmission
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "team-1",
        user: { id: "U1", name: "Alice" },
        team,
      })
    );
  });

  it("returns isLate=false before posting time", async () => {
    // Build a 'now' that is before 11:00 by submitting for a date and stubbing dayjs is hard;
    // instead assert the field flows through: postingTime far in the future of the day start.
    const result = await standupService.submitStandup(
      buildArgs({ team: { ...team, postingTime: "23:59" } })
    );
    expect(result.isLate).toBe(false);
    expect(standupService.postStandupOnDemand).not.toHaveBeenCalled();
  });

  it("when late and no parent post exists, creates the standup post", async () => {
    const result = await standupService.submitStandup(
      buildArgs({ team: { ...team, postingTime: "00:00" } })
    );
    expect(result.isLate).toBe(true);
    expect(standupService.postStandupOnDemand).toHaveBeenCalledWith(
      expect.objectContaining({ id: "team-1" }),
      expect.any(Date),
      { client: expect.anything() }
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/services/standupServiceSubmit.test.js`
Expected: FAIL — `standupService.submitStandup is not a function`.

- [ ] **Step 3: Implement `submitStandup`**

In `src/services/standupService.js`, add this method inside the `StandupService` class (before the closing `}` of the class, after `postIndividualResponse`). Add the imports it needs at the top of the file if missing: `dayjs` + `timezone` are already imported; add `const notificationService = require("./notificationService");` and `const { getUserMention } = require("../utils/userHelper");` (note `getUserMention` is already imported — reuse it).

```js
  /**
   * Shared submit/update logic used by both the Slack command handler and the MCP server.
   * Computes lateness, persists the response, notifies admins, and — when late for today —
   * threads the response under the existing post or creates the post if none exists.
   *
   * @param {object} args
   * @param {object} args.team        Full team record (id, name, timezone, postingTime, slackChannelId)
   * @param {string} args.slackUserId Submitting user's Slack ID
   * @param {string} args.name        Display name (for mention/notification)
   * @param {{yesterdayTasks?:string, todayTasks?:string, blockers?:string}} args.fields
   * @param {Date}   args.standupDate Date the standup is for
   * @param {boolean} [args.isUpdate=false]
   * @param {object} args.slackClient Bolt app client (app.client)
   * @returns {Promise<{isLate:boolean}>}
   */
  async submitStandup({
    team,
    slackUserId,
    name,
    fields,
    standupDate,
    isUpdate = false,
    slackClient,
  }) {
    const { yesterdayTasks = "", todayTasks = "", blockers = "" } = fields;
    const targetDate = dayjs(standupDate).tz(team.timezone);
    const todayStart = dayjs().tz(team.timezone).startOf("day");

    // Lateness only applies when submitting for today or a future date.
    let isLate = false;
    if (
      targetDate.startOf("day").isSame(todayStart) ||
      targetDate.startOf("day").isAfter(todayStart)
    ) {
      const [postingHour, postingMinute] = team.postingTime
        .split(":")
        .map(Number);
      const postingTime = dayjs()
        .tz(team.timezone)
        .startOf("day")
        .hour(postingHour)
        .minute(postingMinute);
      isLate = dayjs().tz(team.timezone).isAfter(postingTime);
    }

    await this.saveResponse(
      team.id,
      slackUserId,
      { date: standupDate, yesterdayTasks, todayTasks, blockers },
      isLate,
      slackClient
    );

    await notificationService.notifyAdminsOfStandupSubmission({
      teamId: team.id,
      user: { id: slackUserId, name },
      team,
      client: slackClient,
      options: {
        isUpdate,
        isLate,
        date: targetDate.format("MMM DD, YYYY"),
      },
    });

    // Late + for today => surface it in the channel thread immediately.
    if (isLate && targetDate.isSame(dayjs().tz(team.timezone), "day")) {
      const standupPost = await this.getStandupPost(team.id, standupDate);
      if (standupPost?.slackMessageTs) {
        const lateResponse = {
          user: { name, slackUserId },
          yesterdayTasks,
          todayTasks,
          blockers,
        };
        const message = await this.formatLateResponseMessage(lateResponse);
        await slackClient.chat.postMessage({
          channel: standupPost.channelId,
          thread_ts: standupPost.slackMessageTs,
          reply_broadcast: true,
          text: isUpdate
            ? `🔄 *Update* from ${getUserMention(lateResponse.user)}`
            : `🕐 *Late Submission* of ${getUserMention(lateResponse.user)}`,
          ...message,
        });
      } else {
        await this.postStandupOnDemand(team, standupDate, {
          client: slackClient,
        });
      }
    }

    return { isLate };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/services/standupServiceSubmit.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/standupService.js test/services/standupServiceSubmit.test.js
git commit -m "feat(standup): extract submitStandup shared service method"
```

---

## Task 2: Route the Slack handlers through `submitStandup`

Make `handleStandupSubmission` and `handleStandupUpdateSubmission` delegate to the new method so behavior is shared (no MCP code yet — pure refactor; existing manual behavior unchanged).

**Files:**

- Modify: `src/commands/standup.js:224-359` (`handleStandupSubmission`) and `:520-670` (`handleStandupUpdateSubmission`)

- [ ] **Step 1: Refactor `handleStandupSubmission`**

Replace the body from after the "at least one field filled" check (the `const team = await teamService.getTeamById(teamId);` line through the end of the `if (isLate && team) { ... }` block, lines ~261-351) with:

```js
const team = await teamService.getTeamById(teamId);

const { isLate } = await standupService.submitStandup({
  team,
  slackUserId: body.user.id,
  name: body.user.name || body.user.id,
  fields: { yesterdayTasks, todayTasks, blockers },
  standupDate: dayjs().tz(team.timezone).toDate(),
  isUpdate: false,
  slackClient: client,
});

await client.chat.postEphemeral({
  channel: team.slackChannelId,
  user: body.user.id,
  text: `✅ Standup submitted for ${team?.name || "your team"}!${
    isLate ? " (marked as late)" : ""
  }`,
});
```

Leave the `try/catch` wrapper, the `ack()`, the field extraction, and the empty-fields guard intact.

- [ ] **Step 2: Refactor `handleStandupUpdateSubmission`**

Replace its body from `const team = await teamService.getTeamById(teamId);` (line ~558) through the end of the `if (isLate && targetDate.isSame(...)) { ... }` block (line ~660) with:

```js
const team = await teamService.getTeamById(teamId);
const targetDate = dayjs(standupDate, "YYYY-MM-DD");

const { isLate } = await standupService.submitStandup({
  team,
  slackUserId: body.user.id,
  name: body.user.name || body.user.id,
  fields: { yesterdayTasks, todayTasks, blockers },
  standupDate: targetDate.toDate(),
  isUpdate,
  slackClient: client,
});

const updateText = isUpdate ? "updated" : "submitted";
await client.chat.postEphemeral({
  channel: team.slackChannelId,
  user: body.user.id,
  text: `✅ Standup ${updateText} for ${team?.name || "your team"} (${targetDate.format(
    "MMM DD, YYYY"
  )})!${isLate ? " (marked as late)" : ""}`,
});
```

Note: `notificationService` and `getUserMention` may now be unused imports in `standup.js`. Remove an import only if it becomes unused (check with `grep`). Leave `dayjs`, `teamService`, `standupService` imports.

- [ ] **Step 3: Run the full suite to verify nothing regressed**

Run: `npx jest`
Expected: PASS — all pre-existing tests still green.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors (fix any unused-import warnings introduced by this change).

- [ ] **Step 5: Commit**

```bash
git add src/commands/standup.js
git commit -m "refactor(standup): route Slack handlers through submitStandup"
```

---

## Task 3: Add the `mcp_tokens` Prisma model + migration

**Files:**

- Modify: `prisma/schema.prisma` (after the `sessions` model, ~line 187; add relation on `User`)
- Create: `prisma/migrations/<timestamp>_add_mcp_tokens/migration.sql`

- [ ] **Step 1: Add the model and relation**

In `prisma/schema.prisma`, add to the `User` model's relation list (alongside `sessions sessions[]`):

```prisma
  mcp_tokens       mcp_tokens[]
```

Then add this model after the `sessions` model:

```prisma
model mcp_tokens {
  id           String    @id @default(uuid())
  user_id      String
  token_hash   String    @unique
  name         String?
  expires_at   DateTime
  revoked_at   DateTime?
  last_used_at DateTime?
  created_at   DateTime  @default(now())
  users        User      @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id])
  @@index([token_hash])
}
```

- [ ] **Step 2: Generate the migration (do NOT use db push — repo policy is committed migrations)**

Run: `npx prisma migrate dev --name add_mcp_tokens`
Expected: a new folder `prisma/migrations/<timestamp>_add_mcp_tokens/` with `migration.sql`, and "Your database is now in sync".

- [ ] **Step 3: Verify the client regenerated**

Run: `npx prisma generate`
Expected: "Generated Prisma Client".

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add mcp_tokens table"
```

---

## Task 4: `mcpTokenService` — mint, validate, list, revoke

**Files:**

- Create: `src/services/mcpTokenService.js`
- Test: `test/services/mcpTokenService.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/services/mcpTokenService.test.js`:

```js
jest.mock("../../src/config/prisma", () => ({
  mcp_tokens: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
}));

const prisma = require("../../src/config/prisma");
const svc = require("../../src/services/mcpTokenService");

describe("mcpTokenService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("mintToken returns a raw token and stores only its hash", async () => {
    prisma.mcp_tokens.create.mockResolvedValue({ id: "t1" });
    const { rawToken } = await svc.mintToken("user-1", "Cursor");

    expect(rawToken).toMatch(/^ddm_[0-9a-f]{64}$/);
    const stored = prisma.mcp_tokens.create.mock.calls[0][0].data;
    expect(stored.token_hash).toBe(svc.hashToken(rawToken));
    expect(stored.token_hash).not.toContain(rawToken);
    expect(stored.user_id).toBe("user-1");
    expect(stored.name).toBe("Cursor");
  });

  it("validateToken returns the user for a live token", async () => {
    const user = { id: "user-1", slackUserId: "U1" };
    prisma.mcp_tokens.findUnique.mockResolvedValue({
      id: "t1",
      expires_at: new Date(Date.now() + 1000),
      revoked_at: null,
      users: user,
    });
    prisma.mcp_tokens.update.mockResolvedValue({});

    const result = await svc.validateToken("ddm_abc");
    expect(result).toBe(user);
    expect(prisma.mcp_tokens.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "t1" } })
    );
  });

  it("validateToken returns null for expired or revoked tokens", async () => {
    prisma.mcp_tokens.findUnique.mockResolvedValue({
      id: "t1",
      expires_at: new Date(Date.now() - 1000),
      revoked_at: null,
      users: { id: "u" },
    });
    expect(await svc.validateToken("ddm_x")).toBeNull();

    prisma.mcp_tokens.findUnique.mockResolvedValue({
      id: "t2",
      expires_at: new Date(Date.now() + 1000),
      revoked_at: new Date(),
      users: { id: "u" },
    });
    expect(await svc.validateToken("ddm_y")).toBeNull();
  });

  it("validateToken returns null when token unknown", async () => {
    prisma.mcp_tokens.findUnique.mockResolvedValue(null);
    expect(await svc.validateToken("ddm_z")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/services/mcpTokenService.test.js`
Expected: FAIL — cannot find module `mcpTokenService`.

- [ ] **Step 3: Implement the service**

Create `src/services/mcpTokenService.js`:

```js
const crypto = require("crypto");
const prisma = require("../config/prisma");

const TOKEN_PREFIX = "ddm_";
const DEFAULT_TTL_DAYS = 90;

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

async function mintToken(userId, name = null, ttlDays = DEFAULT_TTL_DAYS) {
  const rawToken = TOKEN_PREFIX + crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  const record = await prisma.mcp_tokens.create({
    data: {
      user_id: userId,
      token_hash: hashToken(rawToken),
      name,
      expires_at: expiresAt,
    },
  });

  // Raw token is returned ONCE; only the hash is persisted.
  return { rawToken, id: record.id, expiresAt };
}

async function validateToken(rawToken) {
  if (!rawToken || !rawToken.startsWith(TOKEN_PREFIX)) return null;

  const record = await prisma.mcp_tokens.findUnique({
    where: { token_hash: hashToken(rawToken) },
    include: { users: true },
  });

  if (!record || !record.users) return null;
  if (record.revoked_at) return null;
  if (record.expires_at <= new Date()) return null;

  await prisma.mcp_tokens.update({
    where: { id: record.id },
    data: { last_used_at: new Date() },
  });

  return record.users;
}

async function listTokens(userId) {
  return prisma.mcp_tokens.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      name: true,
      expires_at: true,
      revoked_at: true,
      last_used_at: true,
      created_at: true,
    },
  });
}

async function revokeToken(userId, tokenId) {
  // Scope by user_id so a caller can only revoke their own tokens.
  return prisma.mcp_tokens.updateMany({
    where: { id: tokenId, user_id: userId, revoked_at: null },
    data: { revoked_at: new Date() },
  });
}

module.exports = {
  hashToken,
  mintToken,
  validateToken,
  listTokens,
  revokeToken,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/services/mcpTokenService.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/mcpTokenService.js test/services/mcpTokenService.test.js
git commit -m "feat(mcp): add mcpTokenService (mint/validate/list/revoke)"
```

---

## Task 5: MCP auth router — member-gated Slack OAuth + token CRUD

Mirrors `src/routes/admin.js` OAuth (lines 146-265) but (a) drops the super/org-admin gate, requiring only a registered `users` row, and (b) adds token mint/list/revoke endpoints behind the session cookie.

**Files:**

- Create: `src/routes/mcpAuth.js`

This task is integration/IO glue (Slack OAuth + Express). It is verified manually in Task 10, not unit-tested — matching how `admin.js` is treated (no unit tests for its OAuth).

- [ ] **Step 1: Implement the router**

Create `src/routes/mcpAuth.js`:

```js
const express = require("express");
const crypto = require("crypto");
const { WebClient } = require("@slack/web-api");
const prisma = require("../config/prisma");
const tokenService = require("../services/mcpTokenService");

const router = express.Router();

const OAUTH_STATE_TTL = 5 * 60 * 1000;
const oauthStates = new Map();

// Reuse the admin session cookie machinery, but WITHOUT the admin gate:
// any registered user may hold an MCP session and manage their own tokens.
async function requireMcpSession(req, res, next) {
  const token = req.cookies?.mcp_session;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const session = await prisma.sessions.findUnique({
      where: { token },
      include: { users: true },
    });
    if (!session || !session.users || session.expires_at <= new Date()) {
      return res.status(401).json({ error: "Session expired" });
    }
    req.mcpSessionUser = session.users;
    next();
  } catch (err) {
    console.error("requireMcpSession error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// GET /api/mcp/auth/slack — initiate OAuth
router.get("/auth/slack", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  oauthStates.set(state, Date.now() + OAUTH_STATE_TTL);
  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID,
    user_scope: "identity.basic,identity.email",
    redirect_uri: process.env.MCP_OAUTH_REDIRECT_URI,
    state,
  });
  res.redirect(`https://slack.com/oauth/v2/authorize?${params}`);
});

// GET /api/mcp/auth/callback — handle OAuth callback
router.get("/auth/callback", async (req, res) => {
  const { code, state } = req.query;
  const expiry = oauthStates.get(state);
  const appUrl = process.env.APP_URL || "";

  if (!state || !expiry || Date.now() > expiry) {
    oauthStates.delete(state);
    return res.redirect(`${appUrl}/mcp-tokens?error=invalid_state`);
  }
  oauthStates.delete(state);

  try {
    if (!code) return res.redirect(`${appUrl}/mcp-tokens?error=oauth_denied`);

    const slack = new WebClient();
    const result = await slack.oauth.v2.access({
      client_id: process.env.SLACK_CLIENT_ID,
      client_secret: process.env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: process.env.MCP_OAUTH_REDIRECT_URI,
    });
    if (!result.ok) throw new Error(`Slack OAuth error: ${result.error}`);

    const userToken = result.authed_user?.access_token;
    if (!userToken) throw new Error("No user access token in OAuth response");

    const identity = await new WebClient(userToken).users.identity();
    const slackUserId = identity.user?.id;
    if (!slackUserId) throw new Error("Could not get Slack user ID");

    // Member gate only: the user must be registered. No admin requirement.
    const user = await prisma.user.findUnique({ where: { slackUserId } });
    if (!user) return res.redirect(`${appUrl}/mcp-tokens?error=not_registered`);

    const sessionToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.sessions.create({
      data: {
        id: crypto.randomUUID(),
        user_id: user.id,
        token: sessionToken,
        expires_at: expiresAt,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      },
    });
    res.cookie("mcp_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
    });
    res.redirect(`${appUrl}/mcp-tokens`);
  } catch (err) {
    console.error("MCP OAuth callback error:", err);
    res.redirect(`${appUrl}/mcp-tokens?error=oauth_failed`);
  }
});

// GET /api/mcp/me — who am I (for the SPA)
router.get("/me", requireMcpSession, (req, res) => {
  const u = req.mcpSessionUser;
  res.json({ id: u.id, slackUserId: u.slackUserId, name: u.name });
});

// GET /api/mcp/tokens — list caller's tokens (no secrets)
router.get("/tokens", requireMcpSession, async (req, res) => {
  res.json(await tokenService.listTokens(req.mcpSessionUser.id));
});

// POST /api/mcp/tokens — mint a token (raw value returned ONCE)
router.post("/tokens", requireMcpSession, async (req, res) => {
  const name =
    typeof req.body?.name === "string" ? req.body.name.slice(0, 100) : null;
  const { rawToken, id, expiresAt } = await tokenService.mintToken(
    req.mcpSessionUser.id,
    name
  );
  res.status(201).json({ id, token: rawToken, expiresAt });
});

// DELETE /api/mcp/tokens/:id — revoke
router.delete("/tokens/:id", requireMcpSession, async (req, res) => {
  await tokenService.revokeToken(req.mcpSessionUser.id, req.params.id);
  res.json({ ok: true });
});

module.exports = { router };
```

- [ ] **Step 2: Note the new env var**

Add `MCP_OAUTH_REDIRECT_URI` to `.env` (e.g. `https://<host>/api/mcp/auth/callback`) and register that redirect URL in the Slack app's OAuth settings. Document in Task 11.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/routes/mcpAuth.js
git commit -m "feat(mcp): add member-gated OAuth + token CRUD router"
```

---

## Task 6: Team resolver for MCP tools

Replaces Slack channel context: resolve a team by id or case-insensitive name within the user's org (mirrors `/dd-standup`, which uses `teamService.listTeams`).

**Files:**

- Create: `src/mcp/teamResolver.js`
- Test: `test/mcp/teamResolver.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/mcp/teamResolver.test.js`:

```js
jest.mock("../../src/services/teamService", () => ({
  listTeams: jest.fn(),
}));

const teamService = require("../../src/services/teamService");
const { resolveTeam } = require("../../src/mcp/teamResolver");

const teams = [
  { id: "t1", name: "Engineering" },
  { id: "t2", name: "Design" },
];

describe("resolveTeam", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    teamService.listTeams.mockResolvedValue(teams);
  });

  it("matches by case-insensitive name", async () => {
    const { team } = await resolveTeam("U1", "engineering");
    expect(team.id).toBe("t1");
  });

  it("matches by id", async () => {
    const { team } = await resolveTeam("U1", "t2");
    expect(team.id).toBe("t2");
  });

  it("returns an error for unknown teams, listing available names", async () => {
    const { team, error } = await resolveTeam("U1", "Marketing");
    expect(team).toBeUndefined();
    expect(error).toContain("Engineering");
    expect(error).toContain("Design");
  });

  it("returns an error when the user has no teams", async () => {
    teamService.listTeams.mockResolvedValue([]);
    const { error } = await resolveTeam("U1", "Engineering");
    expect(error).toMatch(/not a member of any teams/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/mcp/teamResolver.test.js`
Expected: FAIL — cannot find module `teamResolver`.

- [ ] **Step 3: Implement**

Create `src/mcp/teamResolver.js`:

```js
const teamService = require("../services/teamService");

/**
 * Resolve a team identifier (UUID or case-insensitive name) to a team the
 * given Slack user can submit standups for, within their organization.
 * @returns {Promise<{team?: object, error?: string}>}
 */
async function resolveTeam(slackUserId, identifier) {
  const teams = await teamService.listTeams(slackUserId);
  if (teams.length === 0) {
    return { error: "You are not a member of any teams." };
  }

  const needle = String(identifier || "")
    .trim()
    .toLowerCase();
  const team = teams.find(
    (t) => t.id === identifier || t.name.toLowerCase() === needle
  );

  if (!team) {
    const names = teams.map((t) => t.name).join(", ");
    return {
      error: `Team "${identifier}" not found. Available teams: ${names}`,
    };
  }
  return { team };
}

module.exports = { resolveTeam };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/mcp/teamResolver.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/mcp/teamResolver.js test/mcp/teamResolver.test.js
git commit -m "feat(mcp): add team resolver"
```

---

## Task 7: Phase 1 MCP tools

Pure tool logic, factored so it can be tested without the MCP transport. `src/mcp/tools.js` exports `buildToolHandlers(user, slackClient)` returning plain async functions, plus `registerTools(server, user, slackClient)` that wires them onto an `McpServer`. Testing targets the handlers.

**Files:**

- Create: `src/mcp/tools.js`
- Test: `test/mcp/tools.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/mcp/tools.test.js`:

```js
jest.mock("../../src/config/prisma", () => ({
  teamMember: { findMany: jest.fn() },
}));
jest.mock("../../src/mcp/teamResolver", () => ({ resolveTeam: jest.fn() }));
jest.mock("../../src/services/standupService", () => ({
  submitStandup: jest.fn(),
  getUserStandupHistory: jest.fn(),
}));
jest.mock("../../src/services/teamService", () => ({
  getTeamById: jest.fn(),
}));

const prisma = require("../../src/config/prisma");
const { resolveTeam } = require("../../src/mcp/teamResolver");
const standupService = require("../../src/services/standupService");
const teamService = require("../../src/services/teamService");
const { buildToolHandlers } = require("../../src/mcp/tools");

const user = { id: "user-1", slackUserId: "U1", name: "Alice" };
const slackClient = { chat: { postMessage: jest.fn() } };

describe("MCP Phase 1 tool handlers", () => {
  let tools;
  beforeEach(() => {
    jest.clearAllMocks();
    tools = buildToolHandlers(user, slackClient);
  });

  it("list_my_teams returns the user's active memberships with role", async () => {
    prisma.teamMember.findMany.mockResolvedValue([
      { role: "ADMIN", team: { id: "t1", name: "Eng" } },
      { role: "MEMBER", team: { id: "t2", name: "Design" } },
    ]);
    const result = await tools.list_my_teams({});
    expect(result).toEqual([
      { id: "t1", name: "Eng", role: "ADMIN" },
      { id: "t2", name: "Design", role: "MEMBER" },
    ]);
  });

  it("submit_standup requires at least one field", async () => {
    await expect(
      tools.submit_standup({
        team: "Eng",
        yesterdayTasks: "",
        todayTasks: "",
        blockers: "",
      })
    ).rejects.toThrow(/at least one field/i);
    expect(standupService.submitStandup).not.toHaveBeenCalled();
  });

  it("submit_standup resolves the team and delegates to submitStandup", async () => {
    resolveTeam.mockResolvedValue({ team: { id: "t1", name: "Eng" } });
    teamService.getTeamById.mockResolvedValue({
      id: "t1",
      name: "Eng",
      timezone: "Asia/Dhaka",
    });
    standupService.submitStandup.mockResolvedValue({ isLate: true });

    const result = await tools.submit_standup({
      team: "Eng",
      todayTasks: "ship it",
    });

    expect(resolveTeam).toHaveBeenCalledWith("U1", "Eng");
    expect(standupService.submitStandup).toHaveBeenCalledWith(
      expect.objectContaining({
        slackUserId: "U1",
        name: "Alice",
        isUpdate: false,
        fields: expect.objectContaining({ todayTasks: "ship it" }),
        slackClient,
      })
    );
    expect(result).toEqual(
      expect.objectContaining({ team: "Eng", isLate: true })
    );
  });

  it("submit_standup throws the resolver error for an unknown team", async () => {
    resolveTeam.mockResolvedValue({
      error: 'Team "X" not found. Available teams: Eng',
    });
    await expect(
      tools.submit_standup({ team: "X", todayTasks: "y" })
    ).rejects.toThrow(/not found/);
  });

  it("update_standup rejects an invalid date", async () => {
    await expect(
      tools.update_standup({ team: "Eng", date: "06/01/2026", todayTasks: "y" })
    ).rejects.toThrow(/YYYY-MM-DD/);
  });

  it("get_my_standup_history defaults missing dates and returns entries", async () => {
    standupService.getUserStandupHistory.mockResolvedValue([
      {
        standupDate: new Date("2026-06-10"),
        team: { name: "Eng" },
        todayTasks: "x",
        isLate: false,
      },
    ]);
    const result = await tools.get_my_standup_history({});
    expect(standupService.getUserStandupHistory).toHaveBeenCalled();
    expect(result[0]).toEqual(
      expect.objectContaining({ team: "Eng", todayTasks: "x" })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/mcp/tools.test.js`
Expected: FAIL — cannot find module `tools`.

- [ ] **Step 3: Implement the tools**

Create `src/mcp/tools.js`:

```js
const { z } = require("zod");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const customParseFormat = require("dayjs/plugin/customParseFormat");
const prisma = require("../config/prisma");
const { resolveTeam } = require("./teamResolver");
const standupService = require("../services/standupService");
const teamService = require("../services/teamService");

// Extend the plugins this module relies on directly — do not depend on another
// module's import side-effects (which won't run when that module is mocked).
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertValidDate(date) {
  if (!DATE_RE.test(date) || !dayjs(date, "YYYY-MM-DD", true).isValid()) {
    throw new Error(`Invalid date "${date}". Use YYYY-MM-DD format.`);
  }
}

/**
 * Plain async tool handlers bound to a specific user + Slack client.
 * Each throws Error on failure (the MCP layer converts to a tool error).
 */
function buildToolHandlers(user, slackClient) {
  async function resolveOrThrow(identifier) {
    const { team, error } = await resolveTeam(user.slackUserId, identifier);
    if (error) throw new Error(error);
    return team;
  }

  return {
    async list_my_teams() {
      const memberships = await prisma.teamMember.findMany({
        where: {
          isActive: true,
          team: { isActive: true },
          user: { slackUserId: user.slackUserId },
        },
        include: { team: true },
      });
      return memberships.map((m) => ({
        id: m.team.id,
        name: m.team.name,
        role: m.role,
      }));
    },

    async submit_standup({
      team,
      yesterdayTasks = "",
      todayTasks = "",
      blockers = "",
    }) {
      if (!yesterdayTasks && !todayTasks && !blockers) {
        throw new Error(
          "Provide at least one field (yesterdayTasks, todayTasks, or blockers)."
        );
      }
      const resolved = await resolveOrThrow(team);
      const full = await teamService.getTeamById(resolved.id);
      const { isLate } = await standupService.submitStandup({
        team: full,
        slackUserId: user.slackUserId,
        name: user.name || user.slackUserId,
        fields: { yesterdayTasks, todayTasks, blockers },
        standupDate: dayjs().tz(full.timezone).toDate(),
        isUpdate: false,
        slackClient,
      });
      return {
        team: resolved.name,
        date: dayjs().tz(full.timezone).format("YYYY-MM-DD"),
        isLate,
      };
    },

    async update_standup({
      team,
      date,
      yesterdayTasks = "",
      todayTasks = "",
      blockers = "",
    }) {
      assertValidDate(date);
      if (!yesterdayTasks && !todayTasks && !blockers) {
        throw new Error(
          "Provide at least one field (yesterdayTasks, todayTasks, or blockers)."
        );
      }
      const resolved = await resolveOrThrow(team);
      const full = await teamService.getTeamById(resolved.id);
      const { isLate } = await standupService.submitStandup({
        team: full,
        slackUserId: user.slackUserId,
        name: user.name || user.slackUserId,
        fields: { yesterdayTasks, todayTasks, blockers },
        standupDate: dayjs(date, "YYYY-MM-DD").toDate(),
        isUpdate: true,
        slackClient,
      });
      return { team: resolved.name, date, isLate };
    },

    async get_my_standup_history({ startDate, endDate } = {}) {
      if (startDate) assertValidDate(startDate);
      if (endDate) assertValidDate(endDate);
      const end = endDate || dayjs().format("YYYY-MM-DD");
      const start =
        startDate || dayjs(end).subtract(7, "day").format("YYYY-MM-DD");
      const rows = await standupService.getUserStandupHistory(
        user.slackUserId,
        start,
        end
      );
      return rows.map((r) => ({
        date: dayjs(r.standupDate).format("YYYY-MM-DD"),
        team: r.team?.name,
        yesterdayTasks: r.yesterdayTasks || "",
        todayTasks: r.todayTasks || "",
        blockers: r.blockers || "",
        isLate: r.isLate,
      }));
    },
  };
}

const TEAM_FIELD = z
  .string()
  .describe("Team name (case-insensitive) or team id");

/**
 * Register Phase 1 tools onto an McpServer. Each tool returns its data as a
 * JSON string in a text content block.
 */
function registerTools(server, user, slackClient) {
  const handlers = buildToolHandlers(user, slackClient);
  const json = (data) => ({
    content: [{ type: "text", text: JSON.stringify(data) }],
  });
  const fail = (err) => ({
    content: [{ type: "text", text: `Error: ${err.message}` }],
    isError: true,
  });

  server.registerTool(
    "list_my_teams",
    {
      title: "List my teams",
      description: "List the teams you belong to, with your role.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        return json(await handlers.list_my_teams({}));
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "submit_standup",
    {
      title: "Submit standup",
      description:
        "Submit today's standup for a team. At least one field is required.",
      inputSchema: z.object({
        team: TEAM_FIELD,
        yesterdayTasks: z.string().optional(),
        todayTasks: z.string().optional(),
        blockers: z.string().optional(),
      }),
    },
    async (args) => {
      try {
        return json(await handlers.submit_standup(args));
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "update_standup",
    {
      title: "Update standup",
      description:
        "Submit or update a standup for a specific date (YYYY-MM-DD).",
      inputSchema: z.object({
        team: TEAM_FIELD,
        date: z.string().describe("YYYY-MM-DD"),
        yesterdayTasks: z.string().optional(),
        todayTasks: z.string().optional(),
        blockers: z.string().optional(),
      }),
    },
    async (args) => {
      try {
        return json(await handlers.update_standup(args));
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "get_my_standup_history",
    {
      title: "Get my standup history",
      description:
        "Return your standup submissions. Defaults to the last 7 days.",
      inputSchema: z.object({
        startDate: z.string().optional().describe("YYYY-MM-DD"),
        endDate: z.string().optional().describe("YYYY-MM-DD"),
      }),
    },
    async (args) => {
      try {
        return json(await handlers.get_my_standup_history(args));
      } catch (e) {
        return fail(e);
      }
    }
  );
}

module.exports = { buildToolHandlers, registerTools };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/mcp/tools.test.js`
Expected: PASS (6 tests). (`dayjs.tz` is configured because `standupService` extends the timezone plugin globally; if a test hits `tz` before that import, add `require("../../src/services/standupService")` is already mocked — instead extend tz in the test setup with `require("dayjs/plugin/timezone")`. Only add this if a test errors on `dayjs(...).tz`.)

- [ ] **Step 5: Commit**

```bash
git add src/mcp/tools.js test/mcp/tools.test.js
git commit -m "feat(mcp): add Phase 1 standup tools"
```

---

## Task 8: Add MCP SDK + zod dependencies

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Install**

Run: `npm install @modelcontextprotocol/sdk zod`
Expected: both added to `dependencies`.

- [ ] **Step 2: Verify the SDK import works under CommonJS**

Create a throwaway check: `node -e "require('@modelcontextprotocol/sdk/server/mcp.js'); console.log('ok')"`
Expected: prints `ok`.
**If it throws `ERR_REQUIRE_ESM`:** the SDK is ESM-only in the installed version. Fallback — load it via dynamic import in Task 9's `server.js` (`const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js")`) and make `buildMcpHandler` async. Note which path you took in the commit message.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add @modelcontextprotocol/sdk and zod"
```

---

## Task 9: MCP server endpoint + token middleware, mounted in Express

**Files:**

- Create: `src/mcp/server.js`
- Modify: `src/app.js`

This is transport/IO glue verified end-to-end in Task 10.

- [ ] **Step 1: Implement `src/mcp/server.js`**

```js
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StreamableHTTPServerTransport,
} = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const tokenService = require("../services/mcpTokenService");
const { registerTools } = require("./tools");

// Express middleware: resolve Authorization: Bearer <token> -> req.mcpUser
async function validateMcpToken(req, res, next) {
  const header = req.headers.authorization || "";
  const rawToken = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!rawToken) {
    return res.status(401).json({ error: "Missing bearer token" });
  }
  try {
    const user = await tokenService.validateToken(rawToken);
    if (!user)
      return res.status(401).json({ error: "Invalid or expired token" });
    req.mcpUser = user;
    next();
  } catch (err) {
    console.error("validateMcpToken error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Build the POST /mcp handler. `slackApp` is the initialized Bolt app so tools
 * can reach slackApp.client to post to Slack.
 */
function createMcpHandler(slackApp) {
  return async function handleMcp(req, res) {
    // Stateless: a fresh server + transport per request, bound to the user.
    const server = new McpServer({
      name: "daily-dose-standup",
      version: "1.0.0",
    });
    registerTools(server, req.mcpUser, slackApp.client);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  };
}

module.exports = { validateMcpToken, createMcpHandler };
```

- [ ] **Step 2: Mount in `src/app.js`**

After the admin router mount (`receiver.app.use("/api/admin", adminRouter);`, line 58) add:

```js
const { router: mcpAuthRouter } = require("./routes/mcpAuth");
const { validateMcpToken, createMcpHandler } = require("./mcp/server");

receiver.app.use("/api/mcp", mcpAuthRouter);
receiver.app.post("/mcp", validateMcpToken, createMcpHandler(app));
```

`express.json()` is already applied globally (line 57), so `req.body` is parsed before `handleRequest`. The `/mcp` and `/api/mcp` paths sit above the SPA fallback (line 169), so they are not shadowed.

- [ ] **Step 3: Boot the server to confirm it starts**

Run: `node -e "require('./src/app.js')" ` is not viable (it starts Bolt). Instead run `npm start` briefly and confirm no startup crash, then stop it.
Expected: `⚡️ Daily Dose bot is running` with no MCP import errors.

- [ ] **Step 4: Commit**

```bash
git add src/mcp/server.js src/app.js
git commit -m "feat(mcp): mount /mcp endpoint and token middleware"
```

---

## Task 10: Manual end-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Auth unauthenticated request is rejected**

Run: `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/mcp -H "Content-Type: application/json" -d '{}'`
Expected: `401`.

- [ ] **Step 2: Mint a token**

Visit `http://localhost:3000/api/mcp/auth/slack` in a browser, complete Slack login as a _registered, non-admin_ user, land on `/mcp-tokens`, and mint a token. Copy the raw token.

- [ ] **Step 3: List tools over MCP**

Run (replace `$TOKEN`):

```bash
curl -s -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Expected: a JSON-RPC result listing `list_my_teams`, `submit_standup`, `update_standup`, `get_my_standup_history`.

- [ ] **Step 4: Call `submit_standup` and confirm parity with `/dd-standup`**

Call the tool via the same curl pattern with `method":"tools/call"` and `params:{name:"submit_standup",arguments:{team:"<your team>",todayTasks:"mcp test"}}`. Then confirm in the DB/Slack that the response was saved and admins were notified exactly as a `/dd-standup` submission would be (including late→thread behavior if after posting time).

- [ ] **Step 5: Revoke and confirm rejection**

Revoke the token on `/mcp-tokens`, repeat Step 3, expect `401`.

---

## Task 11: Token management web page

**Files:**

- Create: `web/src/pages/McpTokens.tsx`
- Modify: `web/src/App.tsx`

This follows the existing SPA patterns. No unit tests (the web app has none for pages).

- [ ] **Step 1: Build the page**

Create `web/src/pages/McpTokens.tsx` with a component that:

- On mount, GETs `/api/mcp/me`. On 401, render a "Sign in with Slack" button linking to `/api/mcp/auth/slack`.
- When authed, GET `/api/mcp/tokens` and render the list (name, created, last used, expires, revoked) with a Revoke button (`DELETE /api/mcp/tokens/:id`).
- A "Generate token" control (optional name input) that POSTs `/api/mcp/tokens` and shows the returned raw `token` ONCE in a copyable box with a warning that it won't be shown again.
- Read `?error=` from the URL and show a friendly message (`not_registered` → "Your Slack account isn't registered with Daily Dose yet.").

Match the styling/fetch conventions used in `web/src/pages/admin/*` and `web/src/hooks/useAdminAuth.ts` (read those first for the exact patterns).

- [ ] **Step 2: Add the route**

In `web/src/App.tsx`, add a public route `\/mcp-tokens` rendering `McpTokens` (outside the `/admin` branch, inside the normal SPA `Routes`).

- [ ] **Step 3: Build the SPA**

Run: `cd web && npm run build`
Expected: build succeeds, `web/dist/` updated.

- [ ] **Step 4: Verify the page**

Start the bot (`npm start`), visit `http://localhost:3000/mcp-tokens`, complete the flow from Task 10 Step 2 through mint/list/revoke in the UI.

- [ ] **Step 5: Lint + commit**

```bash
cd web && npm run lint && cd ..
git add web/src/pages/McpTokens.tsx web/src/App.tsx web/dist
git commit -m "feat(mcp): add token management web page"
```

---

## Task 12: Documentation & changelog

**Files:**

- Modify: `README.md`, `CHANGELOG.md`, `web/src/data/changelog.json`

- [ ] **Step 1: README**

Add an "MCP Server" section documenting: the `/mcp` endpoint, how to mint a token at `/mcp-tokens`, the MCP client config (HTTP server URL + `Authorization: Bearer` header), the Phase 1 tools, and the new `MCP_OAUTH_REDIRECT_URI` env var (plus registering the redirect URL in the Slack app).

- [ ] **Step 2: CHANGELOG.md (technical, always)**

Add an entry under a new version heading covering: `submitStandup` extraction, `mcp_tokens` table + migration, `mcpTokenService`, member-gated OAuth router, `/mcp` Streamable HTTP endpoint, Phase 1 tools, token web page, `MCP_OAUTH_REDIRECT_URI`.

- [ ] **Step 3: web/src/data/changelog.json (user-facing)**

Add one plain-language entry: team members can now submit, update, and review their standups from any AI agent by connecting Daily Dose's MCP server with a personal token from the new token page. No mention of internal file/function names.

- [ ] **Step 4: Commit**

```bash
git add README.md CHANGELOG.md web/src/data/changelog.json
git commit -m "docs(mcp): document MCP server, token setup, changelog"
```

---

## Phase 2 — read-only team views (outline; plan in detail after Phase 1 ships)

Add to `src/mcp/tools.js` (gated by `permissionHelper.canManageTeam(user.id, team.id)`; throw the permission-denied reason on failure):

- `get_team_standup({ team, date? })` → `{ responses, notSubmitted, onLeave }` built from `getTeamResponses`, `getActiveMembers`, and the on-leave query (mirror `previewStandup` in `src/commands/standup.js:1112-1183`), returned as JSON — **not** via `formatStandupMessage`.
- `get_member_standup({ team, member, date? })` → JSON via `getUserResponse` + `resolveTargetMember`-style lookup.

## Phase 3 — admin actions (outline; plan in detail after Phase 2 ships)

Add (gated by `canManageTeam`; Slack calls stay **sequential** per the ~1 req/sec/channel rule):

- `send_standup_reminders({ team })` → `schedulerService.sendStandupReminders(team)`.
- `send_followup_reminders({ team })` → `schedulerService.sendFollowupReminders(team)`.
- `post_team_standup({ team, date? })` → `standupService.postTeamStandup(team, date, { client: slackApp.client })` (no new extraction needed).
- `post_member_standup({ team, member, date? })` → `standupService.postIndividualResponse(...)`.

---

## Self-review notes

- **Spec coverage:** auth (Tasks 3-5, 9), transport/endpoint (Task 9), team resolution (Task 6), service extraction (Tasks 1-2), Phase 1 tools (Task 7), token lifecycle/revoke (Tasks 4-5, web in 11), docs/changelog (Task 12). Phases 2-3 outlined per spec scope.
- **Type/name consistency:** `submitStandup({team, slackUserId, name, fields, standupDate, isUpdate, slackClient})` is defined in Task 1 and called identically in Tasks 2 and 7. `validateToken`/`mintToken`/`listTokens`/`revokeToken` names match between Task 4 (service), Task 5 (router), Task 9 (middleware). `resolveTeam(slackUserId, identifier)` matches between Task 6 and Task 7. `mcp_tokens` column names (`token_hash`, `user_id`, `expires_at`, `revoked_at`, `last_used_at`) match between Task 3 (schema), Task 4 (service), and the test mocks.
- **Open risk flagged in-plan:** SDK ESM/CJS (Task 8 Step 2). New env var `MCP_OAUTH_REDIRECT_URI` (Tasks 5, 12).
