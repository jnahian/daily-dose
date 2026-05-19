# Daily Dose Bot — Security & Correctness Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate three P0 issues from the 2026-05-19 codebase review — unenforced `/scripts` auth, raw `error.message` leakage into Slack messages, and missing `HH:MM` validation in `/dd-team-create` and `/dd-team-update` — while bootstrapping a minimal Jest harness so every fix ships with a real regression test.

**Architecture:** Three independent fixes, each TDD'd. Task 1 bootstraps Jest at the repo root since `test/` is currently empty. Task 2 adds a pure `parseTimeString` validator and adopts it where time strings enter the system. Task 3 adds a `UserFacingError` + `sanitizeError` pair so command handlers can stop leaking internals. Task 4 turns the dormant `basicAuth` middleware into a startup-checked factory and mounts it on `/scripts` before the SPA fallback.

**Tech Stack:** Node.js (backend is plain JS), Slack Bolt 4, Express (via Bolt's `ExpressReceiver`), Prisma 6. Adds **Jest 30** as the only new devDependency. No runtime additions, no schema changes.

---

## File Structure

**New files**
- `jest.config.js` — Jest configuration (Node env, `test/**/*.test.js` matcher)
- `src/utils/timeHelper.js` — `parseTimeString` + `TimeFormatError`
- `src/utils/errorHelper.js` — `UserFacingError` + `sanitizeError`
- `test/utils/timeHelper.test.js`
- `test/utils/errorHelper.test.js`
- `test/middleware/basicAuth.test.js`

**Modified files**
- `package.json` — add Jest devDep + `test` / `test:watch` scripts
- `src/middleware/basicAuth.js` — convert to `createBasicAuth()` factory; remove hardcoded credential defaults; add constant-time compare
- `src/app.js` — mount `createBasicAuth()` on `/scripts` before the static + SPA fallback
- `src/commands/team.js` — call `parseTimeString` in `createTeam` and `updateTeam`; replace raw `${error.message}` with `sanitizeError(error)`
- `src/commands/standup.js` — replace raw `${error.message}` with `sanitizeError(error)` in all catch blocks
- `src/commands/leave.js` — replace raw `${error.message}` with `sanitizeError(error)` in all catch blocks
- `src/services/schedulerService.js` — use `parseTimeString` in `scheduleTeam` so any legacy bad data fails loud at registration

Each task produces self-contained changes with a single commit at the end.

---

## Task 1: Bootstrap Jest test harness

**Why first:** Tasks 2-4 are TDD'd. Without a test runner there is nothing to drive them.

**Files:**
- Create: `jest.config.js`
- Modify: `package.json` (root) — add devDep + scripts
- Create: `test/sanity.test.js` (deleted at end of task — exists only to prove the harness works)

- [ ] **Step 1: Install Jest as a devDependency**

Run: `npm install --save-dev jest@^30.0.0`

Expected output ends with something like:
```
added 1 package, and audited N packages in Xs
```
`package.json` now contains `"jest": "^30.x.x"` under `devDependencies`.

- [ ] **Step 2: Create `jest.config.js` at the repo root**

```js
module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/**/*.test.js"],
  moduleFileExtensions: ["js", "json"],
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/app.js",
    "!**/node_modules/**",
  ],
  coverageDirectory: "coverage",
  verbose: true,
};
```

- [ ] **Step 3: Replace the placeholder `test` script in `package.json`**

In `package.json` `"scripts"`, replace:
```json
"test": "echo \"Error: no test specified\" && exit 1"
```
with:
```json
"test": "jest",
"test:watch": "jest --watch",
"test:coverage": "jest --coverage"
```

- [ ] **Step 4: Write a sanity test to prove the harness runs**

Create `test/sanity.test.js`:
```js
describe("jest harness", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run the sanity test**

Run: `npm test -- test/sanity.test.js`

Expected: `Tests: 1 passed, 1 total` and exit code 0.

- [ ] **Step 6: Delete the sanity test (the real tests in later tasks replace it)**

Run: `rm test/sanity.test.js`

- [ ] **Step 7: Update `.gitignore` to ignore coverage output**

If `/Users/nahian/Projects/daily-dose-bot/.gitignore` does not already contain `coverage/`, append:
```
coverage/
```

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json jest.config.js .gitignore
git commit -m "chore: bootstrap Jest test harness"
```

---

## Task 2: `parseTimeString` validator + adoption

**Why:** `team.js:56-99` (`createTeam`) and `team.js:364-498` (`updateTeam`) accept any string and pass it through. `schedulerService.js:54-57` then `parseInt`s it with no bounds checking, so `"99:99"` becomes a valid-looking but garbage cron expression.

**Files:**
- Create: `src/utils/timeHelper.js`
- Create: `test/utils/timeHelper.test.js`
- Modify: `src/commands/team.js` — lines 102-111 (`createTeam` call site) and the time-parsing section of `updateTeam` (around lines 430-498 — find the place where `standup=` / `posting=` values are accepted)
- Modify: `src/services/schedulerService.js:50-57`

### TDD: write tests first

- [ ] **Step 1: Write the failing test file**

Create `test/utils/timeHelper.test.js`:
```js
const { parseTimeString, TimeFormatError } = require("../../src/utils/timeHelper");

describe("parseTimeString", () => {
  describe("valid input", () => {
    it("parses HH:MM", () => {
      expect(parseTimeString("09:30")).toEqual({
        hour: 9,
        minute: 30,
        normalized: "09:30",
      });
    });

    it("parses single-digit hour and pads it", () => {
      expect(parseTimeString("9:30")).toEqual({
        hour: 9,
        minute: 30,
        normalized: "09:30",
      });
    });

    it("accepts boundary values 00:00 and 23:59", () => {
      expect(parseTimeString("00:00").normalized).toBe("00:00");
      expect(parseTimeString("23:59").normalized).toBe("23:59");
    });
  });

  describe("invalid input", () => {
    it.each([
      ["99:99", "hour"],
      ["24:00", "hour"],
      ["12:60", "minute"],
      ["9:5", "format"],
      [":30", "format"],
      ["12:", "format"],
      ["abc", "format"],
      ["", "format"],
      ["12:30:00", "format"],
    ])("rejects %s", (input) => {
      expect(() => parseTimeString(input)).toThrow(TimeFormatError);
    });

    it.each([null, undefined, 930, {}, []])("rejects non-string %p", (input) => {
      expect(() => parseTimeString(input)).toThrow(TimeFormatError);
    });

    it("error is flagged userFacing for sanitizer interop", () => {
      try {
        parseTimeString("99:99");
        throw new Error("should not reach here");
      } catch (err) {
        expect(err).toBeInstanceOf(TimeFormatError);
        expect(err.userFacing).toBe(true);
      }
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/utils/timeHelper.test.js`

Expected: `Cannot find module '../../src/utils/timeHelper'` failure.

- [ ] **Step 3: Implement `src/utils/timeHelper.js`**

Create `src/utils/timeHelper.js`:
```js
class TimeFormatError extends Error {
  constructor(message) {
    super(message);
    this.name = "TimeFormatError";
    this.userFacing = true;
  }
}

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

function parseTimeString(input) {
  if (typeof input !== "string" || input.length === 0) {
    throw new TimeFormatError(
      "Time must be a string in HH:MM (24-hour) format, e.g. 09:30"
    );
  }

  const match = input.match(TIME_RE);
  if (!match) {
    throw new TimeFormatError(
      `Invalid time "${input}". Use HH:MM (24-hour) format, e.g. 09:30`
    );
  }

  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);

  if (hour < 0 || hour > 23) {
    throw new TimeFormatError(
      `Invalid hour ${hour} in "${input}". Hours must be 0-23`
    );
  }
  if (minute < 0 || minute > 59) {
    throw new TimeFormatError(
      `Invalid minute ${minute} in "${input}". Minutes must be 0-59`
    );
  }

  const normalized = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  return { hour, minute, normalized };
}

module.exports = { parseTimeString, TimeFormatError };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/utils/timeHelper.test.js`

Expected: all tests pass, exit code 0.

### Adopt in `/dd-team-create`

- [ ] **Step 5: Add the import at the top of `src/commands/team.js`**

After the existing `require` block (around line 10), add:
```js
const { parseTimeString } = require("../utils/timeHelper");
```

- [ ] **Step 6: Validate time inputs in `createTeam`**

In `src/commands/team.js`, find the block immediately before `const team = await teamService.createTeam(` (currently around line 102) and insert validation. The full replacement for lines 89-111 should become:

```js
    if (!standupTime || !postingTime) {
      await updateResponse({
        blocks: createCommandErrorBlocks(
          "Usage: `/dd-team-create [TeamName] HH:MM HH:MM`",
          [
            "`/dd-team-create 09:30 10:00` (uses channel name)",
            "`/dd-team-create Engineering 09:30 10:00`",
          ]
        ),
      });
      return;
    }

    let parsedStandup, parsedPosting;
    try {
      parsedStandup = parseTimeString(standupTime);
      parsedPosting = parseTimeString(postingTime);
    } catch (err) {
      await updateResponse({
        blocks: createCommandErrorBlocks(err.message),
      });
      return;
    }

    const team = await teamService.createTeam(
      command.user_id,
      command.channel_id,
      {
        name,
        standupTime: parsedStandup.normalized,
        postingTime: parsedPosting.normalized,
      },
      client
    );
```

### Adopt in `/dd-team-update`

- [ ] **Step 7: Find the time-parsing section in `updateTeam`**

Run: `grep -n "standup=\|posting=" /Users/nahian/Projects/daily-dose-bot/src/commands/team.js`

This locates the param-parsing block inside `updateTeam` (starts near line 430). Note the exact lines where `updateData.standupTime` and `updateData.postingTime` are assigned from the parsed `value`.

- [ ] **Step 8: Wrap those assignments in `parseTimeString`**

For each assignment of the form `updateData.standupTime = value;` (and the equivalent for `postingTime`), replace with:

```js
case "standup":
  try {
    updateData.standupTime = parseTimeString(value).normalized;
  } catch (err) {
    await updateResponse({
      blocks: createCommandErrorBlocks(err.message),
    });
    return;
  }
  break;
```

…and the same pattern for the `posting` case. Match the surrounding switch/if structure that already exists — do not rewrite the dispatch logic, only the body that assigns the time.

- [ ] **Step 9: Use `parseTimeString` in `schedulerService.scheduleTeam` as a defense-in-depth**

In `src/services/schedulerService.js`, replace lines 50-57:
```js
  async scheduleTeam(team) {
    const { standupTime, postingTime, timezone } = team;

    // Parse times
    const standupHour = parseInt(standupTime.split(":")[0]);
    const standupMinute = parseInt(standupTime.split(":")[1]);
    const postingHour = parseInt(postingTime.split(":")[0]);
    const postingMinute = parseInt(postingTime.split(":")[1]);
```

with:
```js
  async scheduleTeam(team) {
    const { standupTime, postingTime, timezone } = team;

    let standupParsed, postingParsed;
    try {
      standupParsed = parseTimeString(standupTime);
      postingParsed = parseTimeString(postingTime);
    } catch (err) {
      console.error(
        `❌ Skipping schedule for team "${team.name}" (id=${team.id}): invalid time data in DB — ${err.message}`
      );
      return;
    }
    const standupHour = standupParsed.hour;
    const standupMinute = standupParsed.minute;
    const postingHour = postingParsed.hour;
    const postingMinute = postingParsed.minute;
```

And add at the top of `src/services/schedulerService.js` with the other requires:
```js
const { parseTimeString } = require("../utils/timeHelper");
```

- [ ] **Step 10: Re-run all tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 11: Manual smoke test the command flow**

In a Slack workspace (or by running `npm run dev` and triggering via a test channel), try:
- `/dd-team-create TestTeam 99:99 10:00` → should respond with usage/format error, no team created.
- `/dd-team-create TestTeam 9:30 10:00` → should succeed and the team should have `standupTime = "09:30"` (normalized).

If you cannot run Slack interactively, at minimum verify the schedulerService change by inspecting an existing team with `npx prisma studio` and confirming no crash on `node src/app.js` startup.

- [ ] **Step 12: Commit**

```bash
git add src/utils/timeHelper.js test/utils/timeHelper.test.js src/commands/team.js src/services/schedulerService.js
git commit -m "feat: validate HH:MM time inputs in /dd-team-create and /dd-team-update

Reject invalid time strings (out-of-range hours/minutes, malformed input) at
the command boundary instead of silently producing garbage cron expressions.
schedulerService also calls parseTimeString defensively so any legacy bad
data in the DB is skipped with a logged warning rather than crashing job
registration."
```

---

## Task 3: `UserFacingError` + `sanitizeError` + adoption

**Why:** `team.js:125`, `team.js:688`, `team.js:783`, `standup.js:129`, `standup.js:341`, `standup.js:647`, `leave.js:92` (and similar) all render `${error.message}` directly into Slack messages. Prisma errors, internal validation messages, and stack info can leak to end users. A typed error class + a single sanitizer fixes this in one pattern.

**Files:**
- Create: `src/utils/errorHelper.js`
- Create: `test/utils/errorHelper.test.js`
- Modify: `src/commands/team.js`, `src/commands/standup.js`, `src/commands/leave.js`

### TDD

- [ ] **Step 1: Write the failing test**

Create `test/utils/errorHelper.test.js`:
```js
const {
  UserFacingError,
  sanitizeError,
} = require("../../src/utils/errorHelper");

describe("UserFacingError", () => {
  it("preserves message and flags userFacing", () => {
    const err = new UserFacingError("nope");
    expect(err.message).toBe("nope");
    expect(err.userFacing).toBe(true);
    expect(err.name).toBe("UserFacingError");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("sanitizeError", () => {
  let consoleErrorSpy;
  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns the message of a UserFacingError verbatim", () => {
    const err = new UserFacingError("Team not found");
    expect(sanitizeError(err)).toBe("Team not found");
  });

  it("returns the message of any error with userFacing=true", () => {
    const err = new Error("custom");
    err.userFacing = true;
    expect(sanitizeError(err)).toBe("custom");
  });

  it("returns a generic message with a correlation id for unknown errors", () => {
    const err = new Error("database exploded with secrets in the message");
    const out = sanitizeError(err);
    expect(out).not.toContain("database exploded");
    expect(out).toMatch(/ref:\s[a-f0-9]{8}/);
  });

  it("logs the full error server-side with the same correlation id", () => {
    const err = new Error("internal detail");
    const out = sanitizeError(err);
    const ref = out.match(/ref:\s([a-f0-9]{8})/)[1];
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(ref),
      err
    );
  });

  it("accepts a custom fallback message", () => {
    const out = sanitizeError(new Error("x"), "Could not save your standup.");
    expect(out).toContain("Could not save your standup.");
  });

  it("handles null/undefined gracefully", () => {
    expect(sanitizeError(null)).toMatch(/ref:\s[a-f0-9]{8}/);
    expect(sanitizeError(undefined)).toMatch(/ref:\s[a-f0-9]{8}/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/utils/errorHelper.test.js`

Expected: `Cannot find module '../../src/utils/errorHelper'`.

- [ ] **Step 3: Implement `src/utils/errorHelper.js`**

Create `src/utils/errorHelper.js`:
```js
const { randomBytes } = require("crypto");

class UserFacingError extends Error {
  constructor(message) {
    super(message);
    this.name = "UserFacingError";
    this.userFacing = true;
  }
}

const DEFAULT_FALLBACK =
  "Something went wrong. Please try again, or contact an admin if this keeps happening.";

function sanitizeError(err, fallback = DEFAULT_FALLBACK) {
  if (err && err.userFacing && typeof err.message === "string") {
    return err.message;
  }
  const ref = randomBytes(4).toString("hex");
  console.error(`[error:${ref}]`, err);
  return `${fallback} (ref: ${ref})`;
}

module.exports = { UserFacingError, sanitizeError };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/utils/errorHelper.test.js`

Expected: all tests pass.

### Adopt in command handlers

- [ ] **Step 5: Find every leaky catch block**

Run: `grep -rn '\${error\.message}' /Users/nahian/Projects/daily-dose-bot/src/commands/`

Expected: a list of files and line numbers. Each one is a candidate.

- [ ] **Step 6: Migrate `src/commands/team.js`**

Add to the imports near the top:
```js
const { sanitizeError } = require("../utils/errorHelper");
```

For every line matching the pattern:
```js
blocks: createCommandErrorBlocks(`Error: ${error.message}`),
```
replace with:
```js
blocks: createCommandErrorBlocks(sanitizeError(error)),
```

Do not change the surrounding `try/catch` structure or the `await updateResponse(...)` call.

- [ ] **Step 7: Migrate `src/commands/standup.js`**

Same: add the import, then replace every `${error.message}` template in `createCommandErrorBlocks` with `sanitizeError(error)`.

- [ ] **Step 8: Migrate `src/commands/leave.js`**

Same pattern.

- [ ] **Step 9: Throw `UserFacingError` from one representative service to confirm the interop**

In `src/services/userService.js`, find the existing line:
```js
throw new Error("You must belong to an organization to manage members");
```
(around line 255 inside `promoteOrganizationMember`).

Replace with:
```js
throw new UserFacingError(
  "You must belong to an organization to manage members"
);
```

…and add at the top of `userService.js`:
```js
const { UserFacingError } = require("../utils/errorHelper");
```

This proves the round-trip: a service throws `UserFacingError`, the command catches it, `sanitizeError` returns the message verbatim, the user sees the original guidance instead of "ref: ...".

> **Note for the next plan:** every other `throw new Error("user-friendly text")` in services should eventually migrate to `UserFacingError`. That migration is out of scope here — only the one above is in this plan to validate the round-trip.

- [ ] **Step 10: Re-run all tests**

Run: `npm test`

Expected: every test passes.

- [ ] **Step 11: Manual smoke test**

Run `npm run dev`. In Slack:
- Trigger any command that would error (e.g. `/dd-team-join NonexistentTeam`). Confirm the user sees the friendly message defined in the service, **not** "Error: <prisma stack frame>".
- Force an unexpected error if possible (e.g. temporarily break a DB call). Confirm the user sees the generic fallback with a `ref:` correlation id, and that the server log contains the same id.

- [ ] **Step 12: Commit**

```bash
git add src/utils/errorHelper.js test/utils/errorHelper.test.js \
        src/commands/team.js src/commands/standup.js src/commands/leave.js \
        src/services/userService.js
git commit -m "feat: sanitize errors sent to Slack via UserFacingError + correlation ids

Command handlers previously rendered \`\${error.message}\` directly into
Slack blocks, leaking Prisma error text and internal validation messages.
Introduce a UserFacingError class that services throw when the message is
safe to show; sanitizeError() returns its message verbatim, or for any
other error returns a generic message with an 8-char correlation id that
matches the full server-side log entry."
```

---

## Task 4: Server-side `/scripts` BasicAuth gate

**Why:** `src/middleware/basicAuth.js` exists, has weak hardcoded defaults (`admin` / `daily-dose-admin`), and is never imported anywhere in `src/app.js`. The React `BasicAuth` component is purely client-side — anyone hitting `/scripts` gets `index.html` from the SPA fallback at `src/app.js:41-43`, and the React gate runs entirely in the user's browser. Real protection must happen in Express.

**Files:**
- Modify: `src/middleware/basicAuth.js` — convert to `createBasicAuth()` factory, remove credential defaults, add constant-time comparison
- Modify: `src/app.js:36-43` — mount the middleware before the static + SPA fallback
- Create: `test/middleware/basicAuth.test.js`

### TDD

- [ ] **Step 1: Write the failing test**

Create `test/middleware/basicAuth.test.js`:
```js
describe("createBasicAuth", () => {
  const ORIG_ENV = { ...process.env };
  let createBasicAuth;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIG_ENV };
    process.env.SCRIPTS_AUTH_USERNAME = "alice";
    process.env.SCRIPTS_AUTH_PASSWORD = "wonderland";
    ({ createBasicAuth } = require("../../src/middleware/basicAuth"));
  });

  afterAll(() => {
    process.env = ORIG_ENV;
  });

  function makeRes() {
    return {
      statusCode: undefined,
      headers: {},
      body: undefined,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(obj) {
        this.body = obj;
        return this;
      },
      setHeader(k, v) {
        this.headers[k] = v;
      },
    };
  }

  function basicAuthHeader(user, pass) {
    return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
  }

  it("throws at construction if env vars are missing", () => {
    delete process.env.SCRIPTS_AUTH_USERNAME;
    jest.resetModules();
    const { createBasicAuth: factory } = require("../../src/middleware/basicAuth");
    expect(() => factory()).toThrow(/SCRIPTS_AUTH_USERNAME/);
  });

  it("returns 401 when no Authorization header is present", () => {
    const mw = createBasicAuth();
    const res = makeRes();
    const next = jest.fn();
    mw({ headers: {} }, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.headers["WWW-Authenticate"]).toMatch(/Basic realm=/);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization is not Basic", () => {
    const mw = createBasicAuth();
    const res = makeRes();
    const next = jest.fn();
    mw({ headers: { authorization: "Bearer abc" } }, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 with bad credentials", () => {
    const mw = createBasicAuth();
    const res = makeRes();
    const next = jest.fn();
    mw(
      { headers: { authorization: basicAuthHeader("alice", "wrong") } },
      res,
      next
    );
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 with malformed base64 (no colon)", () => {
    const mw = createBasicAuth();
    const res = makeRes();
    const next = jest.fn();
    const malformed =
      "Basic " + Buffer.from("nocolon").toString("base64");
    mw({ headers: { authorization: malformed } }, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() with valid credentials", () => {
    const mw = createBasicAuth();
    const res = makeRes();
    const next = jest.fn();
    mw(
      { headers: { authorization: basicAuthHeader("alice", "wonderland") } },
      res,
      next
    );
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeUndefined();
  });

  it("handles passwords containing colons", () => {
    process.env.SCRIPTS_AUTH_PASSWORD = "wonder:land:1";
    jest.resetModules();
    const { createBasicAuth: factory } = require("../../src/middleware/basicAuth");
    const mw = factory();
    const res = makeRes();
    const next = jest.fn();
    mw(
      { headers: { authorization: basicAuthHeader("alice", "wonder:land:1") } },
      res,
      next
    );
    expect(next).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/middleware/basicAuth.test.js`

Expected: failures because `createBasicAuth` is not exported yet (current export is `{ basicAuth }`).

- [ ] **Step 3: Rewrite `src/middleware/basicAuth.js`**

Replace the entire contents with:
```js
const { timingSafeEqual } = require("crypto");

function timingSafeEqualString(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function createBasicAuth() {
  const validUsername = process.env.SCRIPTS_AUTH_USERNAME;
  const validPassword = process.env.SCRIPTS_AUTH_PASSWORD;

  if (!validUsername || !validPassword) {
    throw new Error(
      "SCRIPTS_AUTH_USERNAME and SCRIPTS_AUTH_PASSWORD must be set in env to enable /scripts auth. See DEPLOYMENT.md."
    );
  }

  return function basicAuth(req, res, next) {
    const auth = req.headers && req.headers.authorization;
    if (!auth || !auth.startsWith("Basic ")) {
      res.setHeader("WWW-Authenticate", 'Basic realm="Scripts Documentation"');
      return res.status(401).json({ error: "Authentication required" });
    }

    const decoded = Buffer.from(auth.slice(6), "base64").toString("utf-8");
    const idx = decoded.indexOf(":");
    if (idx === -1) {
      res.setHeader("WWW-Authenticate", 'Basic realm="Scripts Documentation"');
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const username = decoded.slice(0, idx);
    const password = decoded.slice(idx + 1);

    if (
      timingSafeEqualString(username, validUsername) &&
      timingSafeEqualString(password, validPassword)
    ) {
      return next();
    }

    res.setHeader("WWW-Authenticate", 'Basic realm="Scripts Documentation"');
    return res.status(401).json({ error: "Invalid credentials" });
  };
}

module.exports = { createBasicAuth };
```

> Note: this removes the old `basicAuth` named export. Nothing imports it today (`grep -rn "require.*basicAuth\|from.*basicAuth" src/` returns no hits), so the rename is safe.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/middleware/basicAuth.test.js`

Expected: all tests pass.

### Wire it into the Express receiver

- [ ] **Step 5: Mount `createBasicAuth()` on `/scripts` in `src/app.js`**

Replace `src/app.js:36-43`:
```js
// Serve static files from web/dist directory (React SPA)
const express = require('express');
receiver.app.use(express.static(path.join(__dirname, '../web/dist')));

// SPA fallback - serve index.html for all other routes (client-side routing)
receiver.app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../web/dist/index.html'));
});
```

with:
```js
// Serve static files from web/dist directory (React SPA)
const express = require('express');

// Gate the /scripts route at the server level before the SPA fallback can
// hand out index.html to an unauthenticated user. The middleware factory
// throws at startup if SCRIPTS_AUTH_USERNAME / SCRIPTS_AUTH_PASSWORD are
// not set.
const { createBasicAuth } = require('./middleware/basicAuth');
const scriptsAuth = createBasicAuth();
receiver.app.use('/scripts', scriptsAuth);

receiver.app.use(express.static(path.join(__dirname, '../web/dist')));

// SPA fallback - serve index.html for all other routes (client-side routing)
receiver.app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../web/dist/index.html'));
});
```

- [ ] **Step 6: Verify the app still boots with valid env vars**

In a shell with `SCRIPTS_AUTH_USERNAME` and `SCRIPTS_AUTH_PASSWORD` set in `.env` (add temporary values if absent), run:

```bash
node -e "process.env.SCRIPTS_AUTH_USERNAME='u'; process.env.SCRIPTS_AUTH_PASSWORD='p'; require('./src/middleware/basicAuth').createBasicAuth(); console.log('ok')"
```
Expected: `ok` is printed, no throw.

Then:
```bash
node -e "delete process.env.SCRIPTS_AUTH_USERNAME; require('./src/middleware/basicAuth').createBasicAuth()"
```
Expected: throws with the `SCRIPTS_AUTH_USERNAME and SCRIPTS_AUTH_PASSWORD must be set` message.

- [ ] **Step 7: Manual smoke test (requires the dev server)**

With `SCRIPTS_AUTH_USERNAME=alice` and `SCRIPTS_AUTH_PASSWORD=wonderland` in `.env`:

```bash
npm run dev
```

In a second terminal:
```bash
curl -i http://localhost:3000/scripts
# Expected: HTTP/1.1 401 Unauthorized, WWW-Authenticate header present.

curl -i -u alice:wonderland http://localhost:3000/scripts
# Expected: HTTP/1.1 200 OK serving index.html.

curl -i http://localhost:3000/
# Expected: HTTP/1.1 200 OK serving index.html (the homepage is unaffected).

curl -i http://localhost:3000/health
# Expected: HTTP/1.1 200 OK serving the health JSON (the health endpoint is unaffected).
```

- [ ] **Step 8: Document the env var requirement**

In `DEPLOYMENT.md`, find the section that lists `SCRIPTS_AUTH_USERNAME` / `SCRIPTS_AUTH_PASSWORD` and amend the note so it reads "Required — the app will refuse to start without these." (Do not invent the line if it already says this; just verify.)

- [ ] **Step 9: Commit**

```bash
git add src/middleware/basicAuth.js src/app.js test/middleware/basicAuth.test.js DEPLOYMENT.md
git commit -m "feat: enforce BasicAuth on /scripts at the Express layer

The basicAuth middleware existed but was never wired into the app, so the
React-only gate was bypassable — any unauthenticated request to /scripts
got index.html via the SPA fallback. Convert to a createBasicAuth() factory
that throws at startup if SCRIPTS_AUTH_USERNAME / SCRIPTS_AUTH_PASSWORD are
unset, drop the weak hardcoded defaults, use crypto.timingSafeEqual for
credential comparison, and mount the middleware on /scripts before the
static + SPA fallback handlers in src/app.js."
```

---

## Self-Review

Spec coverage:
- P0 #1 (BasicAuth) → Task 4 ✓
- P0 #2 (error.message leakage) → Task 3 ✓
- P0 #3 (HH:MM validation) → Task 2 ✓
- Side-effect goal (Jest harness) → Task 1 ✓

Type / API consistency:
- `parseTimeString(input) → { hour, minute, normalized }` — used identically in `team.js` (twice) and `schedulerService.js` ✓
- `TimeFormatError` has `userFacing = true` → `sanitizeError` returns its message verbatim ✓ (cross-task interop covered by tests in both files)
- `UserFacingError` has `userFacing = true` → same path ✓
- `createBasicAuth()` returns an Express middleware `(req, res, next) => void` — matches `receiver.app.use('/scripts', mw)` signature ✓
- Old `{ basicAuth }` export removed; nothing else imports it (verified via grep in Task 4 Step 3 note) ✓

No placeholders found.
