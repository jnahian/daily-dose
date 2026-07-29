# Zoho People Integration Setup

Connects an organization to Zoho People so the nightly sync pulls **org holidays**
and **approved leave** into Daily Dose's own `Holiday` and `Leave` tables. The
standup gating then works unchanged — nothing in the standup path calls Zoho at
request time.

Optional and per-organization: an org with no `ZohoCredential` row is skipped
entirely.

> Most of this page exists because each step below failed in a way that was not
> self-explanatory the first time it was set up. The
> [Troubleshooting](#troubleshooting) table maps the exact error strings to
> their causes.

---

## Prerequisite: the Zoho account needs API access

**This is the step that is easiest to miss and hardest to diagnose.** Everything
else can be correct and the sync will still fail with `HTTP 403`.

In Zoho People, as an administrator:

**Settings → Manage Accounts → User Access Control → Function Based Permissions → API access**

Set it to **granted** (green) for the **role of the account that authorizes the
integration** — that is, whoever is logged into the Zoho API console when the
grant token is generated. Not the employees being synced; the authorizing
account.

Without it, every call returns:

```
Zoho rejected the request as unauthorized (HTTP 403) at /api/leave/v2/holidays/get
— Zoho said: Sorry!your role is not allowed to access api's.
```

The permission is evaluated per request, so after granting it you can retry
immediately — no need to re-run the setup script or generate a new token.

### Leave visibility (second, separate hurdle)

API access gets past the door. The **leave** sync additionally needs the
authorizing account to be able to _see other people's leave_ — Zoho scopes leave
visibility by reporting hierarchy. Holidays are org-wide and unaffected.

A plausible state is therefore holidays syncing while leaves return zero rows or
a second `403`. The error names the endpoint, so
`/api/leave/v2/holidays/get` vs `/api/v2/leavetracker/leaves/records` identifies
which half is unhappy.

Resolving that generally means giving the account an HR/admin role, or
reporting-manager scope covering the team. **Not yet verified against a live
org** — treat as the expected next obstacle rather than a documented fix.

---

## 1. Create a Self Client app

Go to `https://api-console.zoho.<dc>/` and create a **Self Client** app.

`<dc>` is your data center suffix. Read it off the URL you use for Zoho People:

| Zoho People URL      | `<dc>`   |
| -------------------- | -------- |
| `people.zoho.com`    | `com`    |
| `people.zoho.in`     | `in`     |
| `people.zoho.eu`     | `eu`     |
| `people.zoho.com.au` | `com.au` |
| `people.zoho.jp`     | `jp`     |
| `people.zoho.com.cn` | `com.cn` |

Apps, grant tokens and accounts are **all per-data-center** — a code generated in
one region cannot be exchanged in another. Getting this wrong produces an HTML
error page from the accounts server rather than a useful JSON error.

Note the **Client ID** and **Client Secret** from the _Client Secret_ tab.

> **Self Client has no redirect URI**, by design. If you are looking for a field
> to fill in, there isn't one — and Daily Dose does not send one. See
> [`zohoAuthService.exchangeGrantToken`](../src/services/zoho/zohoAuthService.js).

## 2. Configure the environment

In `.env` on the server:

```bash
ZOHO_CLIENT_ID=1000.XXXXXXXXXXXXXXXXXXXX
ZOHO_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
ZOHO_DATA_CENTER=com     # must match the table above
# ZOHO_SYNC_CRON=30 1 * * *   # optional; this is the default
```

`ZOHO_DATA_CENTER` is read when the grant token is exchanged and then **stored on
the credential row**, so set it before step 4. Restart the app (`pm2 restart
daily-dose`) so the values are picked up.

There is no `ZOHO_REDIRECT_URI` — if an old `.env` still has one, delete the line.

## 3. Generate a grant token

In the API console, on your Self Client app: the **Generate Code** tab (it only
exists on Self Client apps — the type cannot be changed after creation).

Scope: `ZOHOPEOPLE.leave.ALL`, which covers both endpoints the sync uses.

> ⚠️ **Grant tokens are single-use and expire in minutes.** Have the next command
> typed and ready _before_ clicking Generate.

## 4. Exchange it for a refresh token

```bash
npm run zoho:auth-setup -- "<Organization Name>" <grant-token>
```

The name must match `Organization.name` in the database; the script lists the
available names if it doesn't. On success it stores a long-lived refresh token in
`ZohoCredential` and prints the data center and access-token expiry.

One-time per organization. Access tokens refresh automatically five minutes
before expiry.

## 5. Map employees to Slack users

Zoho identifies people by employee ID and Slack by user ID; nothing links them
automatically. **Leave records for unmapped employees are silently skipped** —
this is the most common reason a sync appears to do nothing.

- **Admin panel:** `/admin/zoho` → **Map member** (a dropdown of org members)
- **Slack:** `/dd-zoho-map-member @user ZP-0012345`

Both write the same `ZohoUserMapping` table. Holidays are org-wide and need no
mapping.

## 6. Run a sync

- **Admin panel:** `/admin/zoho` → **Sync now**
- **CLI:** `npm run zoho:sync -- "<Organization Name>"` (omit the name for every
  enabled org)

Then the nightly cron takes over at **01:30** server time (`ZOHO_SYNC_CRON`).

---

## Troubleshooting

Every message below is one that actually occurred during first setup.

| Message                                                         | Cause                                                          | Fix                                                                            |
| --------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `Sorry!your role is not allowed to access api's.`               | The authorizing account's Zoho People role has no API access   | Grant it — see [prerequisite](#prerequisite-the-zoho-account-needs-api-access) |
| Anything mentioning **scope** on a 401/403                      | Grant token issued with the wrong OAuth scope                  | Regenerate with `ZOHOPEOPLE.leave.ALL`, re-run step 4                          |
| Other 401/403 (`NO_PERMISSION`, access denied)                  | Account lacks visibility of the data                           | Widen the account's role / leave visibility                                    |
| Token exchange returns **HTML** from `accounts.zoho.*`          | `ZOHO_DATA_CENTER` doesn't match the org's region              | Fix the DC, recreate the app in the correct console, new token                 |
| `invalid_code`                                                  | Grant token expired or already used                            | Generate a fresh one and exchange it immediately                               |
| `invalid_client`                                                | Client ID/secret mismatch, whitespace, or from a different app | Re-copy from the console's _Client Secret_ tab                                 |
| Sync succeeds, **0 records, "unmapped employee"** warning       | Nobody is mapped                                               | Step 5                                                                         |
| Sync succeeds, **0 records, "no record could be read"** warning | Zoho's response field names differ for this org                | See [field mappings](#field-mappings-are-unverified)                           |

`/admin/zoho` surfaces the last run per type with these warnings, so a
misconfigured integration is distinguishable from an idle night rather than
both showing `0`.

### Field mappings are unverified

`mapZohoHoliday` and `mapZohoLeaveRecord` in
[`zohoSyncService.js`](../src/services/zoho/zohoSyncService.js) carry explicit
comments saying their field names are a best-effort reading of Zoho's published
response shapes, **never confirmed against a live org**. Zoho People fields can
also be renamed per organization. The same caveat applies to the `MM-DD-YYYY`
query-parameter format in `formatZohoRequestDate`.

A high `skippedInvalid` count, or a holiday sync returning zero with no other
warning, points here. Capture the raw response and adjust the mappers.

---

## How the data is used

| Zoho source          | Daily Dose table           | Effect                                             |
| -------------------- | -------------------------- | -------------------------------------------------- |
| Org holiday calendar | `Holiday` (`source: ZOHO`) | Reminders skip the day org-wide                    |
| Approved leave       | `Leave` (`source: ZOHO`)   | Member excluded from standup and shown as on leave |

Precedence: the nightly sync is **authoritative** for any date Zoho returns and
overwrites a same-date manual entry, tagging `source` so it is visible which won.
Leave that flips to pending/rejected/cancelled in Zoho has its synced row
**deleted**, so nobody stays marked on leave after Zoho rescinds it.

Leave is synced over a window of **7 days back to 30 days forward** — backwards
to catch leave approved after the fact, forwards so the gate sees it coming.

See [`admin-panel.md`](./admin-panel.md#zoho-sync-adminzoho) for the operator UI
and [`zohoSyncService.js`](../src/services/zoho/zohoSyncService.js) for the sync
itself.
