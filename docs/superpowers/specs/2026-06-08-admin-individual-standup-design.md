# Admin preview / post of an individual member's standup

**Date:** 2026-06-08
**Status:** Approved (design)

## Summary

Let an admin (org owner, org admin, or team admin) preview and post a **single
team member's** standup, by extending the existing team-level
`/dd-standup-preview` and `/dd-standup-post` commands with an optional Slack
mention. Without a mention, both commands behave exactly as they do today.

This covers two needs:

- **Preview** one member's submission privately (ephemeral) before acting.
- **Post** one member's submission into the day's team standup thread (e.g. a
  late or manually-chased entry), appended as a threaded reply.

## Commands (extended, backward compatible)

| Command                                     | Without mention (unchanged)                 | With `@user` (new)                                         |
| ------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------- |
| `/dd-standup-preview [@user] [date] [team]` | Ephemeral preview of the whole team summary | Ephemeral preview of just that member's standup            |
| `/dd-standup-post [@user] [date] [team]`    | Post the team summary to the channel        | Append that member's standup as a reply in the team thread |

Argument order is free-form (mention, date, and team name are each detected by
pattern), matching the current parser's behavior.

## Permission

Reuse the shared `canManageTeam()` gate. **Broaden it to include org admins**:

```
canManage = org OWNER  ||  org ADMIN (new)  ||  team ADMIN
```

This is an intentional, repo-wide change: org admins gain management rights for
**all** admin commands (team post/remind/preview/followup, leave admin paths,
team update), not just this feature — consistent with treating `OrgRole.ADMIN`
as a real admin. Today only `OWNER` + team admin are granted anywhere.

- Add `isOrganizationAdmin(userId, organizationId)` to `permissionHelper.js`
  (mirrors `isOrganizationOwner`, matching `role === "ADMIN"`).
- In `canManageTeam`, grant management when the user is org owner **or** org
  admin **or** team admin. Report the resolved role accordingly.

## Argument parsing

Extend `teamHelper.parseCommandArguments(commandText)` to also extract a Slack
mention before team-name parsing:

- Match `<@U…>` or `<@U…|name>` via `/<@([A-Z0-9]+)(?:\|[^>]+)?>/`.
- Strip the matched mention from the text, then parse date and team name as
  today.
- Return `{ date, teamName, mentionedUserId }`. Existing callers ignore the new
  field, so they are unaffected.
- If multiple mentions are present, use the first and ignore the rest.

## Individual preview flow

In `previewStandup`, when `mentionedUserId` is present:

1. Resolve requesting user, resolve team from context, check `canManageTeam`
   (existing steps, ephemeral errors).
2. Resolve the target user via `getUserBySlackId(mentionedUserId)`; verify they
   are an **active `TeamMember`** of the resolved team — else ephemeral error
   "That user isn't a member of <team>."
3. Fetch the target's response for the date via
   `standupService.getUserResponse(team.id, targetUser.id, targetDate)` (regular
   or late).
4. No response ⇒ ephemeral "No standup found for <@user> on <date>."
5. Render an ephemeral preview: a short header (member + date) followed by
   `blockHelper.createUserResponseBlocks(response)`.

## Individual post flow

In `postStandup`, when `mentionedUserId` is present:

1. Steps 1–4 as preview (errors use the same response style as the existing team
   post command).
2. Ensure the day's team `StandupPost` thread exists
   (`standupService.getStandupPost`). **If missing, auto-post the team summary**
   via `standupService.postTeamStandup(team, date, { client })` to create the
   thread, then re-fetch the post.
3. Append the member's standup as a threaded reply (`thread_ts`,
   `reply_broadcast: true`) using `createUserResponseBlocks(response)` — **no
   "posted by admin" label**; it reads like a normal entry.
4. **Always appends** — no dedup, even if the member already appears in the
   summary or an earlier reply (mirrors how late responses already work). No
   schema change.
5. Ephemeral success confirmation to the admin (member, date, message ts).

## New / changed code

- `src/utils/permissionHelper.js` — add `isOrganizationAdmin`; broaden
  `canManageTeam`; export the new helper.
- `src/utils/teamHelper.js` — `parseCommandArguments` returns `mentionedUserId`.
- `src/services/standupService.js`:
  - `getUserResponse(teamId, userId, date)` — single member's response for the
    date (either `isLate`).
  - `postIndividualResponse(team, date, response, slackApp)` — ensure/auto-create
    thread, then post the reply.
- `src/commands/standup.js` — branch `previewStandup` and `postStandup` on
  `mentionedUserId`.
- `src/utils/blockHelper.js` — **no new builder**; reuse `createUserResponseBlocks`.
  A thin individual-preview header may reuse `createSectionBlock`.

## Testing

- `teamHelper.parseCommandArguments`: mention extraction in combination with
  date and team name, and mention-only; multiple mentions → first wins.
- `permissionHelper.canManageTeam`: org admin now returns `canManage: true`;
  org member still denied.
- `standupService.postIndividualResponse` (mocked Slack client): auto-posts the
  team summary when no thread exists, then replies; appends a reply when the
  thread already exists.
- (Covered already) `createUserResponseBlocks` stays within Slack field limits.

## Documentation

- `README.md` — document the `@user` form of both commands.
- `CHANGELOG.md` — technical entry (always).
- `web/src/data/changelog.json` — user-facing entry (admins can post/preview a
  single member's standup; org admins now have admin access).
- Help/usage text in `standup.js`.
- Slack manifest: **unchanged** (same command names).

## Edge cases

- `@user` not a member of the team → clear error.
- `@user` has no submission for the date → "no standup found".
- Multiple mentions → first wins.
- Admin posts their own standup → allowed.
- No team standup posted yet (post flow) → auto-post summary, then reply.

## Out of scope

- Per-member message tracking / in-place edit of replies (we append).
- Modal/user-picker UX (command + mention only).
- A distinct standalone (non-threaded) post mode.
