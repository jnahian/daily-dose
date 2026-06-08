# Admin Individual Standup Preview/Post — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin (org owner, org admin, or team admin) preview and post a single team member's standup by adding an optional `@mention` to the existing `/dd-standup-preview` and `/dd-standup-post` commands.

**Architecture:** Extend the argument parser to surface a mentioned Slack user; broaden the shared `canManageTeam` gate to include org admins; add two `standupService` methods (`getUserResponse`, `postIndividualResponse`) plus a formatter; branch the two command handlers on the presence of a mention. Individual posting appends the member's standup as a threaded reply under the day's team post, auto-creating that post if it doesn't exist yet. No schema changes.

**Tech Stack:** Node.js, Slack Bolt, Prisma/PostgreSQL, dayjs, Jest.

**Spec:** `docs/superpowers/specs/2026-06-08-admin-individual-standup-design.md`

---

## File Structure

- `src/utils/permissionHelper.js` — add `isOrganizationAdmin`; broaden `canManageTeam`; export helper. (Task 1)
- `src/utils/teamHelper.js` — `parseCommandArguments` returns `mentionedUserId`. (Task 2)
- `src/services/standupService.js` — `getUserResponse`, `formatIndividualResponseMessage`, `postIndividualResponse`. (Tasks 3–5)
- `src/commands/standup.js` — `resolveTargetMember` helper; individual branches in `previewStandup` and `postStandup`. (Tasks 6–7)
- `README.md`, `CHANGELOG.md`, `web/src/data/changelog.json` — docs. (Task 8)
- Tests: `test/utils/permissionHelper.test.js`, `test/utils/teamHelper.test.js`, `test/services/standupServiceIndividual.test.js`.

---

## Task 1: Broaden permission to include org admins

**Files:**

- Modify: `src/utils/permissionHelper.js`
- Test: `test/utils/permissionHelper.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `test/utils/permissionHelper.test.js`:

```js
jest.mock("../../src/config/prisma", () => ({
  team: { findFirst: jest.fn() },
  organizationMember: { findUnique: jest.fn() },
  teamMember: { findFirst: jest.fn() },
  user: { findUnique: jest.fn() },
}));

const prisma = require("../../src/config/prisma");
const {
  canManageTeam,
  isOrganizationAdmin,
} = require("../../src/utils/permissionHelper");

describe("canManageTeam org admin access", () => {
  beforeEach(() => jest.clearAllMocks());

  it("grants management to an active org admin", async () => {
    prisma.team.findFirst.mockResolvedValue({ organizationId: "o1" });
    // Both the owner check and the admin check call findUnique; ADMIN role
    // fails the owner check (role !== OWNER) and passes the admin check.
    prisma.organizationMember.findUnique.mockResolvedValue({
      role: "ADMIN",
      isActive: true,
    });
    prisma.teamMember.findFirst.mockResolvedValue(null);

    const res = await canManageTeam("u1", "t1");
    expect(res).toMatchObject({ canManage: true, role: "ORG_ADMIN" });
  });

  it("denies a plain org member who is not a team admin", async () => {
    prisma.team.findFirst.mockResolvedValue({ organizationId: "o1" });
    prisma.organizationMember.findUnique.mockResolvedValue({
      role: "MEMBER",
      isActive: true,
    });
    prisma.teamMember.findFirst.mockResolvedValue(null);

    const res = await canManageTeam("u1", "t1");
    expect(res.canManage).toBe(false);
  });

  it("isOrganizationAdmin is false for an inactive admin", async () => {
    prisma.organizationMember.findUnique.mockResolvedValue({
      role: "ADMIN",
      isActive: false,
    });
    expect(await isOrganizationAdmin("u1", "o1")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/utils/permissionHelper.test.js`
Expected: FAIL — `isOrganizationAdmin is not a function` / `role` is not `"ORG_ADMIN"`.

- [ ] **Step 3: Add `isOrganizationAdmin` and broaden `canManageTeam`**

In `src/utils/permissionHelper.js`, add this function immediately after `isOrganizationOwner`:

```js
async function isOrganizationAdmin(userId, organizationId) {
  try {
    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { role: true, isActive: true },
    });

    return !!membership && membership.isActive && membership.role === "ADMIN";
  } catch (error) {
    console.error("Error checking organization admin:", error);
    return false;
  }
}
```

In `canManageTeam`, insert this block between the owner check and the team-admin check (i.e. directly after the `if (isOwner) { ... }` block):

```js
// Check if user is an organization admin
const isOrgAdmin = await isOrganizationAdmin(userId, team.organizationId);
if (isOrgAdmin) {
  return {
    canManage: true,
    role: "ORG_ADMIN",
    reason: null,
  };
}
```

Add `isOrganizationAdmin` to `module.exports` (alongside `isOrganizationOwner`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/utils/permissionHelper.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/permissionHelper.js test/utils/permissionHelper.test.js
git commit -m "feat: grant org admins team-management permission"
```

---

## Task 2: Parse a mentioned user from command text

**Files:**

- Modify: `src/utils/teamHelper.js` (`parseCommandArguments`, ~line 192)
- Test: `test/utils/teamHelper.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `test/utils/teamHelper.test.js`:

```js
const { parseCommandArguments } = require("../../src/utils/teamHelper");

describe("parseCommandArguments mention extraction", () => {
  it("returns null mentionedUserId when no mention present", () => {
    expect(parseCommandArguments("2025-01-15 Engineering")).toEqual({
      date: "2025-01-15",
      teamName: "Engineering",
      mentionedUserId: null,
    });
  });

  it("extracts a mention with a pipe label and keeps date + team", () => {
    const res = parseCommandArguments(
      "<@U123ABC|alice> 2025-01-15 Engineering"
    );
    expect(res).toEqual({
      date: "2025-01-15",
      teamName: "Engineering",
      mentionedUserId: "U123ABC",
    });
  });

  it("extracts a bare mention with no label", () => {
    const res = parseCommandArguments("<@U999>");
    expect(res).toEqual({
      date: null,
      teamName: null,
      mentionedUserId: "U999",
    });
  });

  it("uses the first mention when several are present", () => {
    const res = parseCommandArguments("<@U111|a> <@U222|b>");
    expect(res.mentionedUserId).toBe("U111");
  });

  it("returns all-null for empty input", () => {
    expect(parseCommandArguments("")).toEqual({
      date: null,
      teamName: null,
      mentionedUserId: null,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/utils/teamHelper.test.js`
Expected: FAIL — result objects lack `mentionedUserId`.

- [ ] **Step 3: Update `parseCommandArguments`**

Replace the body of `parseCommandArguments` in `src/utils/teamHelper.js` with:

```js
function parseCommandArguments(commandText) {
  if (!commandText || !commandText.trim()) {
    return { date: null, teamName: null, mentionedUserId: null };
  }

  let text = commandText.trim();
  let date = null;
  let teamName = null;
  let mentionedUserId = null;

  // Mention pattern: <@U123> or <@U123|name>. Use the first, strip all.
  const mentionPattern = /<@([A-Z0-9]+)(?:\|[^>]+)?>/g;
  const mentionMatch = text.match(mentionPattern);
  if (mentionMatch) {
    const first = /<@([A-Z0-9]+)(?:\|[^>]+)?>/.exec(mentionMatch[0]);
    mentionedUserId = first[1];
    text = text.replace(mentionPattern, "").trim();
  }

  // Date pattern: YYYY-MM-DD
  const datePattern = /\b(\d{4}-\d{2}-\d{2})\b/;
  const dateMatch = text.match(datePattern);

  if (dateMatch) {
    date = dateMatch[1];
    const remainingText = text.replace(dateMatch[0], "").trim();
    if (remainingText) {
      teamName = parseTeamName(remainingText);
    }
  } else if (text) {
    teamName = parseTeamName(text);
  }

  return { date, teamName, mentionedUserId };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest test/utils/teamHelper.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run: `npm test`
Expected: PASS (existing callers ignore the new field).

- [ ] **Step 6: Commit**

```bash
git add src/utils/teamHelper.js test/utils/teamHelper.test.js
git commit -m "feat: parse mentioned user from standup command args"
```

---

## Task 3: `standupService.getUserResponse`

**Files:**

- Modify: `src/services/standupService.js` (add method after `getLateResponses`, ~line 163)
- Test: `test/services/standupServiceIndividual.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `test/services/standupServiceIndividual.test.js`:

```js
jest.mock("../../src/config/prisma", () => ({
  standupResponse: { findFirst: jest.fn(), findMany: jest.fn() },
  standupPost: { findUnique: jest.fn(), upsert: jest.fn() },
  team: { findUnique: jest.fn() },
  teamMember: { findMany: jest.fn() },
  holiday: { findMany: jest.fn() },
  user: { findUnique: jest.fn() },
  organization: { findUnique: jest.fn() },
}));

const prisma = require("../../src/config/prisma");
const standupService = require("../../src/services/standupService");

describe("getUserResponse", () => {
  beforeEach(() => jest.clearAllMocks());

  it("queries the member's response for the date window", async () => {
    const row = { id: "r1", user: { slackUserId: "U1" } };
    prisma.standupResponse.findFirst.mockResolvedValue(row);

    const result = await standupService.getUserResponse(
      "t1",
      "u1",
      new Date("2025-01-15T10:00:00Z")
    );

    expect(result).toBe(row);
    const arg = prisma.standupResponse.findFirst.mock.calls[0][0];
    expect(arg.where.teamId).toBe("t1");
    expect(arg.where.userId).toBe("u1");
    expect(arg.where.standupDate.gte).toBeInstanceOf(Date);
    expect(arg.where.standupDate.lte).toBeInstanceOf(Date);
    expect(arg.include).toEqual({ user: true });
  });

  it("returns null when there is no response", async () => {
    prisma.standupResponse.findFirst.mockResolvedValue(null);
    const result = await standupService.getUserResponse("t1", "u1", new Date());
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/services/standupServiceIndividual.test.js -t getUserResponse`
Expected: FAIL — `getUserResponse is not a function`.

- [ ] **Step 3: Implement `getUserResponse`**

In `src/services/standupService.js`, add this method directly after `getLateResponses`:

```js
  async getUserResponse(teamId, userId, date) {
    const startOfDay = dayjs(date).startOf("day").toDate();
    const endOfDay = dayjs(date).endOf("day").toDate();

    return await prisma.standupResponse.findFirst({
      where: {
        teamId,
        userId,
        standupDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        user: true,
      },
      orderBy: {
        submittedAt: "desc",
      },
    });
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/services/standupServiceIndividual.test.js -t getUserResponse`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/standupService.js test/services/standupServiceIndividual.test.js
git commit -m "feat: add getUserResponse to standup service"
```

---

## Task 4: `standupService.formatIndividualResponseMessage`

**Files:**

- Modify: `src/services/standupService.js` (import `createUserResponseBlocks`; add method after `formatLateResponseMessage`, ~line 353)
- Test: `test/services/standupServiceIndividual.test.js` (append)

- [ ] **Step 1: Write the failing test**

Append to `test/services/standupServiceIndividual.test.js`:

```js
describe("formatIndividualResponseMessage", () => {
  it("returns text and blocks with the member section, no admin label", async () => {
    const response = {
      user: { slackUserId: "U1", name: "Alice" },
      yesterdayTasks: "shipped X",
      todayTasks: "review Y",
      blockers: null,
    };

    const msg = await standupService.formatIndividualResponseMessage(response);

    expect(typeof msg.text).toBe("string");
    expect(Array.isArray(msg.blocks)).toBe(true);
    // First block is the member header section "*👤 <@U1>*"
    expect(msg.blocks[0].text.text).toContain("<@U1>");
    // No "Late Submission" / "posted by admin" labelling anywhere
    const serialized = JSON.stringify(msg.blocks);
    expect(serialized).not.toContain("Late Submission");
    expect(serialized.toLowerCase()).not.toContain("posted by admin");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/services/standupServiceIndividual.test.js -t formatIndividualResponseMessage`
Expected: FAIL — `formatIndividualResponseMessage is not a function`.

- [ ] **Step 3: Implement the formatter**

In `src/services/standupService.js`, add `createUserResponseBlocks` to the destructured `blockHelper` import (the block at lines ~16-23):

```js
const {
  createSectionBlock,
  createTaskFieldBlocks,
  createDividerBlock,
  createLateResponseBlocks,
  createUserResponseBlocks,
  createNotRespondedBlocks,
  createOnLeaveBlocks,
} = require("../utils/blockHelper");
```

Add this method directly after `formatLateResponseMessage`:

```js
  async formatIndividualResponseMessage(response) {
    const responseData = {
      userMention: getUserMention(response.user),
      yesterdayTasks: formatTasks(response.yesterdayTasks),
      todayTasks: formatTasks(response.todayTasks),
      blockers: response.blockers,
    };

    return {
      text: `Standup from ${getDisplayName(response.user)}`,
      blocks: createUserResponseBlocks(responseData),
    };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/services/standupServiceIndividual.test.js -t formatIndividualResponseMessage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/standupService.js test/services/standupServiceIndividual.test.js
git commit -m "feat: add individual standup response formatter"
```

---

## Task 5: `standupService.postIndividualResponse`

**Files:**

- Modify: `src/services/standupService.js` (add method after `postLateResponses`, ~line 665)
- Test: `test/services/standupServiceIndividual.test.js` (append)

- [ ] **Step 1: Write the failing test**

Append to `test/services/standupServiceIndividual.test.js`:

```js
describe("postIndividualResponse", () => {
  const team = { id: "t1", name: "Eng", slackChannelId: "C1" };
  const response = {
    user: { slackUserId: "U1", name: "Alice" },
    yesterdayTasks: "a",
    todayTasks: "b",
    blockers: null,
  };

  afterEach(() => jest.restoreAllMocks());

  it("appends a threaded reply when a thread already exists", async () => {
    jest
      .spyOn(standupService, "getStandupPost")
      .mockResolvedValue({ slackMessageTs: "111.1", channelId: "C1" });
    const postTeam = jest
      .spyOn(standupService, "postTeamStandup")
      .mockResolvedValue({});
    const postMessage = jest.fn().mockResolvedValue({ ts: "222.2" });
    const slackApp = { client: { chat: { postMessage } } };

    const result = await standupService.postIndividualResponse(
      team,
      new Date("2025-01-15"),
      response,
      slackApp
    );

    expect(postTeam).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C1",
        thread_ts: "111.1",
        reply_broadcast: true,
      })
    );
    expect(result).toMatchObject({ ts: "222.2", channel: "C1" });
  });

  it("auto-posts the team summary first when no thread exists", async () => {
    jest
      .spyOn(standupService, "getStandupPost")
      .mockResolvedValueOnce(null) // before
      .mockResolvedValueOnce({ slackMessageTs: "333.3", channelId: "C1" }); // after
    const postTeam = jest
      .spyOn(standupService, "postTeamStandup")
      .mockResolvedValue({});
    const postMessage = jest.fn().mockResolvedValue({ ts: "444.4" });
    const slackApp = { client: { chat: { postMessage } } };

    await standupService.postIndividualResponse(
      team,
      new Date("2025-01-15"),
      response,
      slackApp
    );

    expect(postTeam).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ thread_ts: "333.3", reply_broadcast: true })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/services/standupServiceIndividual.test.js -t postIndividualResponse`
Expected: FAIL — `postIndividualResponse is not a function`.

- [ ] **Step 3: Implement `postIndividualResponse`**

In `src/services/standupService.js`, add this method directly after `postLateResponses` (just before the closing `}` of the class):

```js
  async postIndividualResponse(team, date, response, slackApp) {
    // Ensure a team standup thread exists; auto-create it if missing.
    let standupPost = await this.getStandupPost(team.id, date);
    if (!standupPost || !standupPost.slackMessageTs) {
      await this.postTeamStandup(team, date, slackApp);
      standupPost = await this.getStandupPost(team.id, date);
    }

    if (!standupPost || !standupPost.slackMessageTs) {
      throw new Error("Could not find or create a standup thread to post into");
    }

    const message = await this.formatIndividualResponseMessage(response);

    const result = await slackApp.client.chat.postMessage({
      channel: standupPost.channelId,
      thread_ts: standupPost.slackMessageTs,
      reply_broadcast: true,
      ...message,
    });

    return { ts: result.ts, channel: standupPost.channelId };
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest test/services/standupServiceIndividual.test.js`
Expected: PASS (all describes).

- [ ] **Step 5: Commit**

```bash
git add src/services/standupService.js test/services/standupServiceIndividual.test.js
git commit -m "feat: post an individual standup into the team thread"
```

---

## Task 6: Individual branch in `previewStandup` + shared member resolver

**Files:**

- Modify: `src/commands/standup.js` — add `resolveTargetMember` helper; update `previewStandup` (~line 900) to destructure `mentionedUserId` and branch.

No unit test (command handlers aren't unit-tested in this repo, consistent with existing code). Verified by the unit-tested helpers above plus manual Slack testing in Step 4.

- [ ] **Step 1: Add the `resolveTargetMember` helper**

In `src/commands/standup.js`, add this function near the other module-level helpers (e.g. directly above `previewStandup`):

```js
/**
 * Resolve a mentioned Slack user to an active member of the given team.
 * @returns {Promise<{targetUser?: object, error?: string}>}
 */
async function resolveTargetMember(teamId, mentionedUserId) {
  const targetUser = await getUserBySlackId(mentionedUserId);
  if (!targetUser) {
    return { error: "That user isn't registered in the system." };
  }

  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: targetUser.id } },
  });

  if (!membership || !membership.isActive) {
    return { error: "That user isn't an active member of this team." };
  }

  return { targetUser };
}
```

- [ ] **Step 2: Destructure `mentionedUserId` in `previewStandup`**

In `previewStandup`, change the argument parse line:

```js
const { date: dateStr, teamName } = parseCommandArguments(command.text);
```

to:

```js
const {
  date: dateStr,
  teamName,
  mentionedUserId,
} = parseCommandArguments(command.text);
```

- [ ] **Step 3: Add the individual branch**

In `previewStandup`, immediately after the `targetDate` is computed:

```js
// Determine target date
const targetDate = dateStr
  ? dayjs(dateStr).tz(team.timezone)
  : dayjs().tz(team.timezone);
```

insert:

```js
// Individual member preview
if (mentionedUserId) {
  const { targetUser, error: memberError } = await resolveTargetMember(
    team.id,
    mentionedUserId
  );
  if (memberError) {
    await updateResponse({
      blocks: createCommandErrorBlocks(memberError),
      response_type: "ephemeral",
    });
    return;
  }

  const response = await standupService.getUserResponse(
    team.id,
    targetUser.id,
    targetDate.toDate()
  );
  if (!response) {
    await updateResponse({
      blocks: createNoDataBlocks(
        `standup from ${getUserMention(targetUser)}`,
        targetDate.format("MMM DD, YYYY")
      ),
      response_type: "ephemeral",
    });
    return;
  }

  const message =
    await standupService.formatIndividualResponseMessage(response);

  await updateResponse({
    blocks: [
      createSectionBlock(
        `🔍 *Preview — ${getUserMention(targetUser)}'s standup* · ${targetDate.format(
          "MMM DD, YYYY"
        )}`
      ),
      ...message.blocks,
    ],
    response_type: "ephemeral",
  });

  console.log(
    `🔍 ${getUserLogIdentifier(user)} previewed ${getUserMention(
      targetUser
    )}'s standup for team ${team.name} (${targetDate.format("YYYY-MM-DD")})`
  );
  return;
}
```

- [ ] **Step 4: Manual verification**

Run: `npm test` (confirm nothing broke).
Then in Slack (admin in a team channel):

- `/dd-standup-preview @someMember` → ephemeral preview of that member's standup, with the "Preview — …" header.
- `/dd-standup-preview @nonMember` → "isn't an active member" error.
- `/dd-standup-preview @memberWithNoSubmission` → "No data" message.
- `/dd-standup-preview` (no mention) → unchanged team preview.

- [ ] **Step 5: Commit**

```bash
git add src/commands/standup.js
git commit -m "feat: preview an individual member's standup via mention"
```

---

## Task 7: Individual branch in `postStandup`

**Files:**

- Modify: `src/commands/standup.js` — update `postStandup` (~line 764) to destructure `mentionedUserId` and branch (ephemeral errors + success).

No unit test (command handler); verified by service unit tests + manual Slack testing in Step 3.

- [ ] **Step 1: Destructure `mentionedUserId` in `postStandup`**

In `postStandup`, change:

```js
const { date: dateStr, teamName } = parseCommandArguments(command.text);
```

to:

```js
const {
  date: dateStr,
  teamName,
  mentionedUserId,
} = parseCommandArguments(command.text);
```

- [ ] **Step 2: Add the individual branch**

In `postStandup`, immediately after the `targetDate` is computed:

```js
// Determine target date
const targetDate = dateStr
  ? dayjs(dateStr).tz(team.timezone)
  : dayjs().tz(team.timezone);
```

insert:

```js
// Individual member post (ephemeral errors + confirmation)
if (mentionedUserId) {
  const { targetUser, error: memberError } = await resolveTargetMember(
    team.id,
    mentionedUserId
  );
  if (memberError) {
    await updateResponse({
      blocks: createCommandErrorBlocks(memberError),
      response_type: "ephemeral",
    });
    return;
  }

  const response = await standupService.getUserResponse(
    team.id,
    targetUser.id,
    targetDate.toDate()
  );
  if (!response) {
    await updateResponse({
      blocks: createNoDataBlocks(
        `standup from ${getUserMention(targetUser)}`,
        targetDate.format("MMM DD, YYYY")
      ),
      response_type: "ephemeral",
    });
    return;
  }

  const result = await standupService.postIndividualResponse(
    team,
    targetDate.toDate(),
    response,
    { client }
  );

  await updateResponse({
    blocks: createCommandSuccessBlocks(
      `Posted ${getUserMention(targetUser)}'s standup to *${team.name}*`,
      {
        Date: targetDate.format("MMM DD, YYYY"),
        "Message timestamp": result.ts,
      }
    ),
    response_type: "ephemeral",
  });

  console.log(
    `📊 ${getUserLogIdentifier(user)} posted ${getUserMention(
      targetUser
    )}'s standup for team ${team.name} (${targetDate.format("YYYY-MM-DD")})`
  );
  return;
}
```

- [ ] **Step 3: Manual verification**

Run: `npm test` (confirm nothing broke).
Then in Slack (admin in a team channel):

- With an existing team standup posted today: `/dd-standup-post @member` → adds a threaded reply (broadcast to channel) with that member's standup; ephemeral success to admin.
- With NO team standup posted yet today: `/dd-standup-post @member` → posts the team summary (creating the thread), then adds the member reply.
- `/dd-standup-post @member` again → a second reply appended (no dedup), as designed.
- `/dd-standup-post @nonMember` → ephemeral "isn't an active member" error.
- `/dd-standup-post` (no mention) → unchanged team post.
- As an **org admin** (OrgRole ADMIN, not owner, not team admin): the above commands are now permitted.

- [ ] **Step 4: Commit**

```bash
git add src/commands/standup.js
git commit -m "feat: post an individual member's standup via mention"
```

---

## Task 8: Documentation

**Files:**

- Modify: `README.md`, `CHANGELOG.md`, `web/src/data/changelog.json`

- [ ] **Step 1: README — document the `@user` form**

Find the sections describing `/dd-standup-preview` and `/dd-standup-post` in `README.md` and add the mention form. Example additions (adapt to surrounding wording):

```markdown
- `/dd-standup-preview [@user] [date] [team-name]` — Preview the team summary, or a single member's standup when you @mention them (ephemeral).
- `/dd-standup-post [@user] [date] [team-name]` — Post the team summary, or append a single member's standup into the day's team thread when you @mention them. If no team standup exists yet for the date, the summary is posted first to create the thread.
```

Also note org-admin access where command permissions are described: "Org owners, org admins, and team admins can run admin commands."

- [ ] **Step 2: CHANGELOG.md — technical entry under `[Unreleased]`**

Add under `## [Unreleased]` (create `### Added` / `### Changed` as needed):

```markdown
### Added

- `/dd-standup-preview` and `/dd-standup-post` now accept an optional `@mention` to preview or post a single team member's standup. Preview is ephemeral; post appends the member's response as a threaded reply under the day's team standup post (`reply_broadcast: true`), auto-posting the team summary first if no thread exists yet. New `standupService.getUserResponse`, `formatIndividualResponseMessage`, and `postIndividualResponse`; argument parsing in `teamHelper.parseCommandArguments` now returns `mentionedUserId`; reuses `blockHelper.createUserResponseBlocks` (no admin label). Always appends — no dedup. (`src/commands/standup.js`, `src/services/standupService.js`, `src/utils/teamHelper.js`)

### Changed

- `permissionHelper.canManageTeam` now grants management to organization **admins** (`OrgRole.ADMIN`), not just owners and team admins — applies to all admin commands. New `isOrganizationAdmin` helper. (`src/utils/permissionHelper.js`)
```

- [ ] **Step 3: changelog.json — user-facing entry**

Add a new entry at the top of the `versions` array in `web/src/data/changelog.json`, set its `isLatest: true`, and set the previously-latest entry's `isLatest: false`. Use the next version number (decided at release time — use a placeholder section the release skill will reconcile, or coordinate with the maintainer). Entry content:

```json
{
  "version": "UNRELEASED",
  "date": "2026-06-08",
  "isLatest": true,
  "changes": [
    {
      "type": "added",
      "title": "Preview and post a single member's standup",
      "items": [
        "Admins can now preview or post one team member's standup by mentioning them, e.g. /dd-standup-preview @alice or /dd-standup-post @alice",
        "Posting a member adds their update as a reply under the day's team standup"
      ]
    },
    {
      "type": "changed",
      "title": "Organization admins get admin access",
      "items": [
        "Organization admins can now run admin standup commands, alongside owners and team admins"
      ]
    }
  ]
}
```

> Note: this repo versions/changelogs via the `/release` skill. Leave the `version` as `UNRELEASED` here and let the release flow assign the real number, or set it to the agreed next version. Do not flip `isLatest` on a released entry without bumping the version.

- [ ] **Step 4: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('web/src/data/changelog.json','utf8')); console.log('valid')"`
Expected: `valid`.

- [ ] **Step 5: Commit**

```bash
git add README.md CHANGELOG.md web/src/data/changelog.json
git commit -m "docs: document individual standup preview/post and org-admin access"
```

---

## Final verification

- [ ] Run the full test suite: `npm test` — Expected: all pass.
- [ ] Run lint: `npm run lint` — Expected: clean.
- [ ] Manual Slack smoke test of both commands (mention + no-mention paths, org-admin role) per Tasks 6–7.

---

## Self-Review Notes (author)

- **Spec coverage:** permission broadening (Task 1), mention parsing (Task 2), preview flow (Task 6), post flow incl. auto-thread + always-append (Tasks 5, 7), no admin label (Task 4 reuses `createUserResponseBlocks`), ephemeral individual errors/success (Tasks 6–7), tests (Tasks 1–5), docs (Task 8). Edge cases (not-a-member, no-submission, multiple mentions, self-post, no-thread) all covered.
- **Type consistency:** `mentionedUserId` returned by `parseCommandArguments` and consumed in both handlers; `resolveTargetMember(teamId, mentionedUserId) -> {targetUser?, error?}` used identically in Tasks 6–7; `getUserResponse(teamId, userId, date)`, `formatIndividualResponseMessage(response) -> {text, blocks}`, `postIndividualResponse(team, date, response, slackApp) -> {ts, channel}` consistent across definition and call sites; role label `"ORG_ADMIN"`.
- **No placeholders** except the deliberate `changelog.json` version, which this repo intentionally assigns via the `/release` skill.
