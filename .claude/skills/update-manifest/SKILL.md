---
name: update-manifest
description: Use when slack-app-manifest.json has changed (slash commands, scopes, OAuth redirect URLs, event or interactivity URLs) and Slack still holds the old one, or when Slack rejects a /dd-* command as unknown, a redirect_uri as bad_redirect_uri, or a scope as missing_scope after a deploy.
---

# Updating the Slack App Manifest

`slack-app-manifest.json` is the source of truth; Slack only learns about it through `scripts/updateSlackManifest.js`, which validates with `apps.manifest.validate` before it calls `apps.manifest.update`. The manifest and code edits are done before this skill starts.

**Fast path.** If the change removes or renames anything that the deployed code still sends, do nothing from your machine: commit, let the tag deploy push it, export afterwards (steps 4 and 5). Everything else below is for deciding whether that applies and for the add-only case.

## Sequence

1. **Diff against what is deployed, not HEAD.** A feature branch may already carry committed manifest changes, so:

   ```bash
   git diff $(git describe --tags --abbrev=0 origin/main) -- slack-app-manifest.json src/utils/slackIdentity.js
   ```

   Redirect URLs come from `src/utils/slackIdentity.js` and `ADMIN_OAUTH_REDIRECT_URI`; if a URL leaves the manifest while the deployed `slackIdentity.js` still returns it, the deployed code still sends it.

2. **Validate.** `npm run manifest:validate`. This is the only pre-check that asks Slack; `--dry-run` is offline and only prints the resolved manifest for eyeballing `{{APP_URL}}` substitution. On failure the output lists each problem as `pointer: message`; fix the manifest and re-run. Expect a token rotation on the first call after 12 hours (see below).

3. **Decide who pushes**, from the step 1 diff:

   | Diff                                                   | Who pushes                                            | Why                                                                                                                                                                                                                                                                                                                               |
   | ------------------------------------------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | Only adds (new command, scope, URL)                    | Push now, from any machine: `npm run manifest:update` | Running code is unaffected by extra entries                                                                                                                                                                                                                                                                                       |
   | Removes or renames something deployed code still sends | The tag deploy, nothing from your machine             | `.github/workflows/deploy-version.yml` runs the update between `pm2 stop` and `pm2 start`, so old code never runs against the new manifest. The step is gated by a change detector that watches the manifest, `slackIdentity.js`, `src/app.js` and `src/commands/`, and the job fails after starting the app if the update errors |
   | Changes scopes                                         | Either, then reinstall the app                        | Slack does not grant new scopes until reinstall; `permissions_updated: true` in the output confirms                                                                                                                                                                                                                               |

   If the deploy job fails with the "Slack manifest update failed" annotation, `npm run manifest:update` from your machine is safe at that point: the new code is already live.

4. **Verify.** `npm run manifest:export | grep -A6 redirect_urls` (or the section you changed) and compare against the file with `{{APP_URL}}` resolved. "✅ App manifest updated successfully!" only means Slack accepted a manifest, not that it was the one you meant.

5. **Confirm the local side effect.** If the run printed "✅ .env file updated successfully", the config token rotated and the new pair is in the ignored `.env`. Nothing tracked changes; do not commit.

## The token

The script needs an _app configuration_ token (`xoxe.xoxp-…`, 12-hour lifetime) plus its refresh token, not a bot token. When it sees `invalid_auth` it calls `tooling.tokens.rotate` and writes the new pair into the local `.env`. That is normal on the first run of the day.

- `Token refresh failed: internal_error` means that refresh token was already rotated on another machine. The production VPS keeps its own pair. Generate a fresh one at api.slack.com/apps under "Your App Configuration Tokens" and paste both values into `.env`. Do not copy the VPS pair down, or the next deploy fails the same way.
- If writing `.env` fails, the script prints the new tokens to the console so they are not lost. Do not paste that output into a ticket or PR.

## Common mistakes

- **Pushing a removal from a laptop while the old code is still live.** MCP or admin sign-in breaks with `bad_redirect_uri` until the deploy lands. Use the deploy for removals.
- **Diffing against HEAD.** It hides what an earlier commit on the branch already changed and misclassifies the push.
- **Trusting `--dry-run` as validation.** It is offline. Only `--validate` asks Slack.
- **Skipping export after update.**
- **Passing `--app-id`.** There is no such flag; the app ID always comes from `SLACK_APP_ID` in `.env`.
