# Member status in `/dd-team-list` & `/dd-team-members`

**Date:** 2026-06-23
**Status:** Approved (design)

## Goal

Surface each team member's current status in two existing Slack commands:

- **`/dd-team-members`** (`listMembers`) — detailed, two-line "card" per member (Option C).
- **`/dd-team-list`** (`listTeams`) — keep the existing per-team meta line, with a compact one-line-per-member list nested under each team (Option A).

"Status" means: today's standup (submitted / not), on leave today, notifications on/off, role, and active/inactive (team **and** org).

## Status model (shared)

Resolved per member for **today's date in the team's timezone**. Exactly one _primary_ badge, plus _secondary_ flags.

Precedence (top-down — first match wins):

| Condition                                                                                       | Primary badge          |
| ----------------------------------------------------------------------------------------------- | ---------------------- |
| Inactive in team (`TeamMember.isActive=false`) **or** org (`OrganizationMember.isActive=false`) | `💤 inactive`          |
| On leave today (a `Leave` row overlaps today)                                                   | `🌴 on leave`          |
| Role is `ADMIN`                                                                                 | _(standup suppressed)_ |
| Today is not a work day for them, or an org holiday                                             | _(standup suppressed)_ |
| Submitted a `StandupResponse` for today (late or on-time)                                       | `✅ submitted`         |
| Otherwise                                                                                       | `⏳ not submitted`     |

Secondary flags (shown for active members):

- Role: `👑` admin / `👤` member.
- Notifications: `🔔` on / `🔕` off (`TeamMember.receiveNotifications`).

Display rules:

- **Inactive** members show role + `💤` only — no standup/notification noise.
- **Admins** and **non-working-day** members show role + notifications + active, but **no** `✅`/`⏳` (admins are not expected to submit, consistent with reminder/summary behavior elsewhere).

### `hideFromNotResponded`

Explicitly **ignored** here. That flag only hides a member from the "not responded" list in _posted summaries_; these commands are an explicit "show me the members" view, so everyone is listed.

## Data layer — `teamService.getTeamMembersWithStatus(teamId, date)`

One new method returning enriched members. Steps:

1. Fetch **all** team members including inactive (drop the current `isActive: true` filter used by `getTeamMembers`), `include: { user: true }`.
2. Fetch `OrganizationMember` (`isActive`) for the team's org → map by `userId`.
3. Build `respondedUserIds` from `StandupResponse` for `teamId` + today (**any `isLate`** — cannot reuse `getTeamResponses`, which filters `isLate: false`).
4. Build `onLeaveUserIds` via the existing leave-overlap query pattern (`startDate <= today <= endDate`).
5. Compute `workingToday` per member via `getHolidayDateSet(orgId, today, today)` + `isWorkingDayPure({ date, workDays, holidayDateSet })`, matching reminder gating. Members with no `workDays` fall back to the org default (same as reminders).

Returns an array of plain objects:

```js
{
  user,                  // includes slackUserId, name/username, timezone
  role,                  // 'ADMIN' | 'MEMBER'
  teamActive,            // TeamMember.isActive
  orgActive,             // OrganizationMember.isActive (default true if no row)
  receiveNotifications,
  onLeave,               // bool
  workingToday,          // bool
  responded,             // bool
}
```

### Pure resolver — `deriveMemberStatus(member)`

A standalone, DB-free function applying the precedence table above and returning a small descriptor, e.g.:

```js
{ active: bool, primary: 'inactive'|'leave'|'submitted'|'pending'|'none', showStandup: bool }
```

Kept separate so every precedence branch is unit-testable without the database.

## Display layer — `src/utils/blockHelper.js`

Per repo rule, all Block Kit lives here (no inline blocks at call sites).

- **`createTeamMembersStatusBlocks(team, members)`** — Option C, labeled two-line cards. Self-documenting; no legend needed. Member count line: `N active · M inactive`.

  ```
  👑 *Alice* (@alice) — Admin
      🔔 Notifications on  ·  🟢 Active

  👤 *Bob* (@bob) — Member
      ⏳ Not submitted  ·  🔕 Notifications off  ·  🟢 Active

  👤 *Carol* (@carol) — Member
      🌴 On leave today  ·  🔔 Notifications on  ·  🟢 Active

  💤 *Eve* (@eve) — Member
      ⚪ Inactive in team
  ```

- **`createTeamListWithMembersBlocks(...)`** — Option A. **One section block per team** (avoids the 3000-char section limit), existing meta line (member count + reminder/posting/timezone) retained, compact member lines beneath, plus one trailing **context-block legend** (Option A is emoji-only).

  ```
  *👥 Engineering — 5 members*
  🔔 Reminder: 9:30 AM | 📊 Posting: 10:00 AM | 🌍 America/New_York
  👑 @alice · ✅ · 🔔
  👤 @bob · ⏳ · 🔕
  👤 @carol · 🌴 · 🔔
  💤 @eve · inactive
  ```

## Command wiring — `src/commands/team.js`

- **`listMembers`** — call `getTeamMembersWithStatus`, render with `createTeamMembersStatusBlocks`. Empty-team and all-inactive cases handled.
- **`listTeams`** — for each team **sequentially** (no parallel DB/Slack fan-out, per repo rule), call `getTeamMembersWithStatus`, render nested Option A via `createTeamListWithMembersBlocks`. The existing meta line is preserved.

## Edge cases

- Empty team / all-inactive team.
- Org holiday today (standup suppressed for all).
- Member with no `workDays` (falls back to org default).
- `/dd-team-list` "all teams" scope can be large → per-team section blocks keep each block under limits.

## Out of scope / no change

- No new permission gate (neither command has one today; the only newly exposed field is per-member notification on/off — leave and responded status are already public via posted summaries).
- No `deletedAt` filtering beyond existing patterns (current leave/response queries don't filter it; match that).
- No Slack manifest change (no new command).

## Tests & docs

- **Jest** unit tests for `deriveMemberStatus` (every precedence branch: inactive-team, inactive-org, on-leave, admin, non-work-day, submitted, not-submitted) and the block-helper output shape.
- Update `README.md`, `CHANGELOG.md`, and `web/src/data/changelog.json` (user-facing commands).
