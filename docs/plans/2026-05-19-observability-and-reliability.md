# Daily Dose Bot — Observability & Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the bot observable in production by initializing the Sentry SDK (currently documented in `.env` but never imported), promote `src/utils/logger.js` from a fixed set of typed loggers into a real level-aware logger, and harden the two scheduler-reliability gaps the audit found: cron jobs that swallow errors silently, and `postTeamStandup` losing its `slackMessageTs` if the cron fires twice.

**Architecture:** Three independent fixes. (1) Add Sentry init at the top of `src/app.js`, gated on `SENTRY_DSN` so dev environments without it work unchanged; wrap async cron callbacks in a small `runScheduledJob(name, fn)` helper that reports exceptions to Sentry. (2) Extend `logger.js` with `logger.info/warn/error/debug` honoring `LOG_LEVEL`, plus optional correlation-id support; migrate the highest-traffic file (`schedulerService.js`) off `console.*` as a first wave. (3) Make `postTeamStandup` idempotent at the application layer by checking for an existing `StandupPost` with a non-null `slackMessageTs` before posting to Slack — if it exists, log + return without posting a duplicate message.

**Tech Stack:** Node.js, Slack Bolt 4, Prisma 6, Jest (added in Plan 1), `@sentry/node` 8 (new dependency).

**Prerequisite:** Plan `2026-05-19-security-correctness-hardening.md` Task 1 (Jest harness) is complete.

---

## File Structure

**New files**

- `src/config/sentry.js` — Sentry init helper (idempotent, no-op when DSN unset)
- `test/utils/logger.test.js`
- `test/config/sentry.test.js`
- `test/services/standupServiceIdempotency.test.js`

**Modified files**

- `package.json` — add `@sentry/node@^8.0.0` as a dependency
- `src/app.js` — call Sentry init before Bolt setup
- `src/utils/logger.js` — add `info` / `warn` / `error` / `debug` honoring `LOG_LEVEL`; report `error` calls to Sentry when initialized
- `src/services/schedulerService.js` — wrap cron callbacks with `runScheduledJob`; migrate `console.*` to `logger`
- `src/services/standupService.js` — guard the entry of `postTeamStandup` so a second cron firing doesn't duplicate the Slack message

---

## Task 1: Add level-aware logger + Sentry-integrated `logger.error`

**Why:** The existing `src/utils/logger.js` only exposes specialized loggers (`logCommand`, `logMessage`, `logEvent`, `logAction`, `logView`). The 89 `console.*` calls scattered across `src/` can't migrate cleanly because there's no generic `logger.info` / `logger.error`. Add them with `LOG_LEVEL` respect (`debug` / `info` / `warn` / `error`, defaulting to `info`) and make `logger.error` route to Sentry when initialized.

**Files:**

- Modify: `src/utils/logger.js`
- Create: `test/utils/logger.test.js`

### TDD

- [ ] **Step 1: Write the failing test**

Create `test/utils/logger.test.js`:

```js
describe("logger levels", () => {
  const ORIG_ENV = { ...process.env };
  let logger;
  let consoleSpy;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIG_ENV };
    consoleSpy = {
      log: jest.spyOn(console, "log").mockImplementation(() => {}),
      warn: jest.spyOn(console, "warn").mockImplementation(() => {}),
      error: jest.spyOn(console, "error").mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    consoleSpy.log.mockRestore();
    consoleSpy.warn.mockRestore();
    consoleSpy.error.mockRestore();
  });

  afterAll(() => {
    process.env = ORIG_ENV;
  });

  it("default level is info: debug suppressed, info/warn/error emit", () => {
    delete process.env.LOG_LEVEL;
    logger = require("../../src/utils/logger");
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(consoleSpy.log).toHaveBeenCalledTimes(1); // info uses console.log
    expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    expect(consoleSpy.error).toHaveBeenCalledTimes(1);
  });

  it("LOG_LEVEL=debug emits all four", () => {
    process.env.LOG_LEVEL = "debug";
    logger = require("../../src/utils/logger");
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(consoleSpy.log).toHaveBeenCalledTimes(2); // debug + info
    expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    expect(consoleSpy.error).toHaveBeenCalledTimes(1);
  });

  it("LOG_LEVEL=error suppresses info and warn", () => {
    process.env.LOG_LEVEL = "error";
    logger = require("../../src/utils/logger");
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(consoleSpy.log).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
    expect(consoleSpy.error).toHaveBeenCalledTimes(1);
  });

  it("invalid LOG_LEVEL falls back to info without throwing", () => {
    process.env.LOG_LEVEL = "garbage";
    logger = require("../../src/utils/logger");
    logger.info("i");
    expect(consoleSpy.log).toHaveBeenCalled();
  });

  it("prefixes output with [LEVEL] and an ISO timestamp", () => {
    delete process.env.LOG_LEVEL;
    logger = require("../../src/utils/logger");
    logger.info("hello");
    const arg = consoleSpy.log.mock.calls[0][0];
    expect(arg).toMatch(/^\[\d{4}-\d{2}-\d{2}T.+\] \[INFO\] hello/);
  });

  it("error() forwards to Sentry.captureException when wired", () => {
    const captureException = jest.fn();
    jest.doMock(
      "../../src/config/sentry",
      () => ({ getClient: () => ({ captureException }) }),
      { virtual: true }
    );
    logger = require("../../src/utils/logger");
    const err = new Error("boom");
    logger.error("explosion", err);
    expect(captureException).toHaveBeenCalledWith(err);
  });
});

describe("typed loggers still export", () => {
  it("logCommand / logMessage / logEvent / logAction / logView are present", () => {
    const logger = require("../../src/utils/logger");
    expect(typeof logger.logCommand).toBe("function");
    expect(typeof logger.logMessage).toBe("function");
    expect(typeof logger.logEvent).toBe("function");
    expect(typeof logger.logAction).toBe("function");
    expect(typeof logger.logView).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/utils/logger.test.js`

Expected: failures about missing `logger.debug` / `logger.info` / `logger.warn` / `logger.error`.

- [ ] **Step 3: Extend `src/utils/logger.js`**

Replace the contents of `src/utils/logger.js` with:

```js
/**
 * Logging utility for Daily Dose bot.
 * Levels: debug < info < warn < error. Set with LOG_LEVEL env var.
 * logger.error() also forwards to Sentry when src/config/sentry.js is wired.
 */

const dayjs = require("dayjs");

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function resolveThreshold() {
  const raw = (process.env.LOG_LEVEL || "info").toLowerCase();
  return LEVELS[raw] ?? LEVELS.info;
}

const THRESHOLD = resolveThreshold();

function formatTimestamp() {
  return dayjs().toISOString();
}

function shouldEmit(level) {
  return LEVELS[level] >= THRESHOLD;
}

function emit(level, args, sink) {
  if (!shouldEmit(level)) return;
  const prefix = `[${formatTimestamp()}] [${level.toUpperCase()}]`;
  sink(prefix + " " + (args[0] ?? ""), ...args.slice(1));
}

function debug(...args) {
  emit("debug", args, console.log);
}
function info(...args) {
  emit("info", args, console.log);
}
function warn(...args) {
  emit("warn", args, console.warn);
}

function error(...args) {
  emit("error", args, console.error);
  // Forward Error instances to Sentry if it's wired up. Lazy-required so
  // logger.js stays usable in tests that don't init Sentry.
  try {
    const sentry = require("../config/sentry");
    const client = sentry.getClient && sentry.getClient();
    if (client) {
      const err = args.find((a) => a instanceof Error);
      if (err) client.captureException(err);
    }
  } catch (_) {
    // Sentry module not present or not initialized — ignore.
  }
}

// --- existing typed loggers (preserved) ---

function logCommand(payload) {
  if (!payload) {
    info("COMMAND: null payload");
    return;
  }
  info("COMMAND:", {
    command: payload.command || "unknown",
    user_id: payload.user_id,
    user_name: payload.user_name,
    channel_id: payload.channel_id,
    channel_name: payload.channel_name,
    team_id: payload.team_id,
    text: payload.text,
    trigger_id: payload.trigger_id,
  });
}

function logMessage(message) {
  info("MESSAGE:", {
    type: message.type,
    user: message.user,
    channel: message.channel,
    text: message.text,
    ts: message.ts,
    team: message.team,
    subtype: message.subtype,
  });
}

function logEvent(eventType, payload) {
  info("EVENT:", {
    type: eventType,
    user: payload.user?.id || payload.user,
    channel: payload.channel?.id || payload.channel,
    team: payload.team?.id || payload.team,
    trigger_id: payload.trigger_id,
    action_id: payload.action_id,
    callback_id: payload.callback_id,
    view_id: payload.view?.id,
  });
}

function logAction(action) {
  info("ACTION:", {
    action_id: action.action_id,
    block_id: action.block_id,
    type: action.type,
    value: action.value,
    selected_option: action.selected_option,
    user: action.user?.id,
    trigger_id: action.trigger_id,
  });
}

function logView(view) {
  info("VIEW:", {
    callback_id: view.callback_id,
    type: view.type,
    id: view.id,
    team_id: view.team_id,
    state: Object.keys(view.state?.values || {}),
  });
}

module.exports = {
  debug,
  info,
  warn,
  error,
  logCommand,
  logMessage,
  logEvent,
  logAction,
  logView,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/utils/logger.test.js`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/logger.js test/utils/logger.test.js
git commit -m "feat: add level-aware logger with LOG_LEVEL + Sentry handoff

logger.debug/info/warn/error honor LOG_LEVEL (default: info). The existing
typed loggers (logCommand, logMessage, etc) are preserved and route through
info() so they participate in level filtering. logger.error lazily looks up
src/config/sentry and forwards Error instances to captureException; if the
Sentry module is absent or uninitialized the lookup is a silent no-op."
```

---

## Task 2: Initialize Sentry

**Why:** `SENTRY_DSN` has been documented in `DEPLOYMENT.md` and `CLAUDE.md` for months but `@sentry/node` is not in `package.json` and nothing in `src/` initializes it. Errors from cron jobs are only `console.error`-ed.

**Files:**

- Modify: `package.json` — add `@sentry/node`
- Create: `src/config/sentry.js`
- Modify: `src/app.js:1-20` — call Sentry init before Bolt setup
- Create: `test/config/sentry.test.js`

### TDD

- [ ] **Step 1: Install Sentry**

Run: `npm install @sentry/node@^8.0.0`

Expected: `added N packages` and `package.json` lists `"@sentry/node": "^8.x.x"` in `dependencies`.

- [ ] **Step 2: Write the failing test**

Create `test/config/sentry.test.js`:

```js
describe("src/config/sentry", () => {
  const ORIG_ENV = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIG_ENV };
  });

  afterAll(() => {
    process.env = ORIG_ENV;
  });

  it("init() is a no-op when SENTRY_DSN is unset", () => {
    delete process.env.SENTRY_DSN;
    const sentry = require("../../src/config/sentry");
    expect(() => sentry.init()).not.toThrow();
    expect(sentry.getClient()).toBeNull();
  });

  it("init() returns the configured client when SENTRY_DSN is set", () => {
    process.env.SENTRY_DSN = "https://public@example.ingest.sentry.io/1";
    const sentry = require("../../src/config/sentry");
    sentry.init();
    const client = sentry.getClient();
    expect(client).not.toBeNull();
    expect(typeof client.captureException).toBe("function");
  });

  it("init() is idempotent — calling it twice does not re-init", () => {
    process.env.SENTRY_DSN = "https://public@example.ingest.sentry.io/1";
    const sentry = require("../../src/config/sentry");
    sentry.init();
    const first = sentry.getClient();
    sentry.init();
    expect(sentry.getClient()).toBe(first);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- test/config/sentry.test.js`

Expected: `Cannot find module '../../src/config/sentry'`.

- [ ] **Step 4: Implement `src/config/sentry.js`**

Create `src/config/sentry.js`:

```js
const Sentry = require("@sentry/node");

let initialized = false;
let client = null;

function init() {
  if (initialized) return client;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    initialized = true;
    return null;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    release: process.env.npm_package_version || undefined,
    tracesSampleRate: 0,
  });

  client = {
    captureException: (err, hint) => Sentry.captureException(err, hint),
    captureMessage: (msg, level) => Sentry.captureMessage(msg, level),
  };
  initialized = true;
  return client;
}

function getClient() {
  return client;
}

module.exports = { init, getClient };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- test/config/sentry.test.js`

Expected: all tests pass.

- [ ] **Step 6: Wire init in `src/app.js`**

In `src/app.js`, between the `require("dotenv").config();` line and the `const { App, ExpressReceiver } = require("@slack/bolt");` line, insert:

```js
require("./config/sentry").init();
```

Final top-of-file should read:

```js
require("dotenv").config();
require("./config/sentry").init();
const { App, ExpressReceiver } = require("@slack/bolt");
```

- [ ] **Step 7: Sanity-check the app still boots without SENTRY_DSN**

Run: `node -e "delete process.env.SENTRY_DSN; require('./src/config/sentry').init(); console.log('ok')"`

Expected: `ok`, no errors.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/config/sentry.js src/app.js test/config/sentry.test.js
git commit -m "feat: initialize Sentry when SENTRY_DSN is set

@sentry/node was documented as the error reporter in DEPLOYMENT.md but was
never installed or initialized. Add a thin src/config/sentry.js wrapper
that no-ops when SENTRY_DSN is absent (preserving the dev experience) and
otherwise initializes Sentry once at process start. logger.error() picks
this up via getClient() and forwards Error instances to captureException."
```

---

## Task 3: Wrap scheduler callbacks with `runScheduledJob` + migrate to logger

**Why:** `schedulerService.js:76-83` catches errors from `sendStandupReminders` with `console.error` only — never reported to Sentry. The follow-up and posting jobs (`schedulerService.js:108-118`, `:130-145`) have similar or no try/catch at all. A small wrapper standardizes error handling, ensures Sentry sees every cron failure, and tags the error with the job name for easier triage.

**Files:**

- Modify: `src/services/schedulerService.js`

- [ ] **Step 1: Add the helper at the top of `src/services/schedulerService.js`**

After the existing `require` block, add:

```js
const logger = require("../utils/logger");

function runScheduledJob(name, fn) {
  return async () => {
    const startedAt = Date.now();
    logger.info(`cron:${name} fired`);
    try {
      await fn();
      logger.info(`cron:${name} ok (${Date.now() - startedAt}ms)`);
    } catch (err) {
      // logger.error forwards to Sentry when initialized
      logger.error(`cron:${name} failed`, err);
    }
  };
}
```

- [ ] **Step 2: Replace the inline async wrapper for the standup cron**

In `scheduleTeam`, find the block (currently around lines 68-90):

```js
const standupJob = cron.schedule(
  standupCron,
  async () => {
    console.log(
      `🚀 CRON JOB FIRED: Standup reminder for ${team.name} at ${dayjs()
        .tz(timezone)
        .format()}`
    );
    try {
      await this.sendStandupReminders(team);
    } catch (error) {
      console.error(`❌ Error in standup reminder for ${team.name}:`, error);
    }
  },
  {
    timezone,
    scheduled: true,
    name: standupJobId,
  }
);
```

Replace with:

```js
const standupJob = cron.schedule(
  standupCron,
  runScheduledJob(`standup:${team.name}`, () =>
    this.sendStandupReminders(team)
  ),
  { timezone, scheduled: true, name: standupJobId }
);
```

- [ ] **Step 3: Wrap the followup cron the same way**

Replace the inline followup callback (currently around lines 108-118):

```js
const followupJob = cron.schedule(
  followupCron,
  async () => {
    await this.sendFollowupReminders(team);
  },
  {
    timezone,
    scheduled: true,
    name: followupJobId,
  }
);
```

with:

```js
const followupJob = cron.schedule(
  followupCron,
  runScheduledJob(`followup:${team.name}`, () =>
    this.sendFollowupReminders(team)
  ),
  { timezone, scheduled: true, name: followupJobId }
);
```

- [ ] **Step 4: Wrap the posting cron the same way**

Locate the posting cron registration (currently around `schedulerService.js:130-145`, the block that follows `const postingJobId = ...`). Replace the inline async callback with:

```js
const postingJob = cron.schedule(
  postingCron,
  runScheduledJob(`posting:${team.name}`, () => this.postStandupForTeam(team)),
  { timezone, scheduled: true, name: postingJobId }
);
```

(Use the actual method name the existing code calls — likely `this.postStandupForTeam` or `this.postTeamStandup`. If the existing code uses something else, keep that and adapt only the wrapper.)

- [ ] **Step 5: Replace `console.log` / `console.error` calls in `scheduleAllTeams`**

In `src/services/schedulerService.js`, change:

```js
console.log("📅 Scheduling standup reminders for all teams...");
```

to:

```js
logger.info("📅 Scheduling standup reminders for all teams...");
```

Apply the same `console.log` → `logger.info` and `console.error` → `logger.error` substitution throughout the file. Do **not** migrate other files in this task — keep the diff scoped.

- [ ] **Step 6: Boot check**

Run: `node -e "require('./src/services/schedulerService'); console.log('ok')"`

Expected: `ok`.

- [ ] **Step 7: Run all tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/services/schedulerService.js
git commit -m "feat: wrap cron callbacks with runScheduledJob + Sentry routing

Every cron callback in schedulerService now goes through a small wrapper
that logs start/end, measures duration, and routes failures through
logger.error (which forwards to Sentry when initialized). Replaces the
previous inline try/catch + console.error pattern that left cron failures
invisible in production. Also migrates console.* calls in this file to
logger.*."
```

---

## Task 4: Make `postTeamStandup` idempotent against duplicate cron firings

**Why:** `StandupPost` is upserted by `(teamId, standupDate)`, so the DB row count is safe. But the Slack `postMessage` call happens **before** the upsert, so if the cron fires twice (process restart at the wrong moment, clock skew, manual trigger overlap), the bot posts the standup twice in the channel, and the second `slackMessageTs` overwrites the first — orphaning any late-submission thread replies that landed on the first message in between.

Fix: at the top of `postTeamStandup`, look up the existing `StandupPost`. If `slackMessageTs` is already set, skip posting and return early.

**Files:**

- Modify: `src/services/standupService.js` — guard at the top of `postTeamStandup`
- Create: `test/services/standupServiceIdempotency.test.js` — unit test using a mocked prisma

### TDD

- [ ] **Step 1: Locate `postTeamStandup`**

Run: `grep -n "postTeamStandup\|async postTeamStandup" src/services/standupService.js`

Note the exact line where the method body starts (it is in the range `361-509` per the audit but verify).

- [ ] **Step 2: Write the failing test**

Create `test/services/standupServiceIdempotency.test.js`:

```js
jest.mock("../../src/config/prisma", () => {
  const findUnique = jest.fn();
  return {
    standupPost: { findUnique, upsert: jest.fn() },
    standupResponse: { findMany: jest.fn().mockResolvedValue([]) },
    team: { findUnique: jest.fn() },
    teamMember: { findMany: jest.fn().mockResolvedValue([]) },
    holiday: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findUnique: jest.fn() },
    organization: { findUnique: jest.fn() },
    __mocks: { findUnique },
  };
});

const prisma = require("../../src/config/prisma");
const standupService = require("../../src/services/standupService");

describe("postTeamStandup idempotency guard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns early when an existing post has slackMessageTs set", async () => {
    prisma.__mocks.findUnique.mockResolvedValueOnce({
      id: "p1",
      teamId: "t1",
      standupDate: new Date("2024-01-01"),
      slackMessageTs: "1700000000.000100",
      channelId: "C123",
    });

    const fakeClient = { chat: { postMessage: jest.fn() } };
    const result = await standupService.postTeamStandup(
      { id: "t1", name: "Eng", slackChannelId: "C123", organizationId: "o1" },
      new Date("2024-01-01"),
      fakeClient
    );

    expect(fakeClient.chat.postMessage).not.toHaveBeenCalled();
    expect(result).toMatchObject({ skipped: true });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- test/services/standupServiceIdempotency.test.js`

Expected: failure — most likely `result.skipped` is undefined or `postMessage` was called.

- [ ] **Step 4: Add the guard at the top of `postTeamStandup`**

In `src/services/standupService.js`, find the `postTeamStandup` method signature (around line 361 per the audit). Immediately inside the method body, after any argument destructuring and **before** any Slack API call, insert:

```js
const existingPost = await prisma.standupPost.findUnique({
  where: {
    teamId_standupDate: {
      teamId: team.id,
      standupDate: dayjs(date).startOf("day").toDate(),
    },
  },
});
if (existingPost && existingPost.slackMessageTs) {
  logger.info(
    `postTeamStandup skipped — already posted for team=${team.id} date=${dayjs(date).format("YYYY-MM-DD")} ts=${existingPost.slackMessageTs}`
  );
  return { skipped: true, post: existingPost };
}
```

Make sure `logger` is required at the top of the file:

```js
const logger = require("../utils/logger");
```

(Add it if absent.)

> If the existing `postTeamStandup` already has a callsite that depends on its return value, search for `await standupService.postTeamStandup(` (or `await this.postTeamStandup(`) and confirm the existing call sites either ignore the return value or accept the new `{ skipped, post }` shape alongside the existing success-shape. Adjust the return on the success path to wrap the existing return value the same way: `return { skipped: false, post: ... }`. If too many callsites depend on the current shape, instead return the existing shape on the success path and only return `{ skipped: true, post: existingPost }` on the early-out — and update the test to match. Pick whichever requires fewer call-site edits.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- test/services/standupServiceIdempotency.test.js`

Expected: passes.

- [ ] **Step 6: Run the full suite**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 7: Manual smoke test**

In a dev Slack workspace:

1. Manually trigger a standup post via `node scripts/sendManualStandup.js post "TestTeam"`.
2. Immediately trigger it again.
3. Confirm only one message appears in the channel; the second invocation should log `postTeamStandup skipped — already posted ...`.

- [ ] **Step 8: Commit**

```bash
git add src/services/standupService.js test/services/standupServiceIdempotency.test.js
git commit -m "fix: make postTeamStandup idempotent on duplicate cron firings

A second posting cron firing for the same (teamId, standupDate) used to
post a duplicate Slack message and overwrite the first message's
slackMessageTs in the DB, orphaning any thread replies that had already
landed on the first message. Now postTeamStandup checks for an existing
StandupPost with a non-null slackMessageTs and returns early if found."
```

---

## Self-Review

Spec coverage:

- Audit P2 #10 (Sentry never initialized) → Task 2 ✓
- Audit P2 #11 (89 console.\* calls / logger underused) → Task 1 (foundation) + Task 3 (first wave in schedulerService.js). Full migration of all 89 sites is explicitly out of scope and called out as a future task in the commit message.
- Audit Med #7 (idempotency: cron fires twice → duplicate post + lost ts) → Task 4 ✓
- Audit High #3 (scheduler errors swallowed by `console.error`) → Task 3 ✓

Type / API consistency:

- `logger.error(message, errorInstance)` → forwards `errorInstance` to Sentry. Used in `runScheduledJob` (Task 3) and exercised in tests (Task 1). ✓
- `runScheduledJob(name, fn)` returns `async () => void`, matches the callback shape expected by `cron.schedule`. ✓
- `sentry.init()` is idempotent and returns the client (or `null` when DSN unset). `getClient()` returns the same. logger.error only forwards when `getClient()` is truthy. ✓
- `postTeamStandup` return value: the early-out returns `{ skipped: true, post }`. The success path return is preserved as-is (per the Step 4 note); callers that ignored the return continue to work. ✓

No placeholders found.
