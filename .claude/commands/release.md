---
description: Cut a versioned release — bump version, update changelogs, commit, push, and create a GitHub release that triggers the deploy workflow.
---

# /release — Cut a Versioned Release

Drive a SemVer release of this repo end-to-end. The GitHub release you create at the end pushes the tag, which triggers `.github/workflows/deploy-version.yml` and deploys to production.

You must run through every step in order. Do not skip steps or batch destructive operations.

## 0. Read this whole file first

Then do the steps below. Pause where instructed — never push or create a release without explicit user confirmation.

## 1. Pre-flight checks

Run these in parallel via Bash:

- `git rev-parse --abbrev-ref HEAD` — must be `main`
- `git status --porcelain` — must be empty (clean working tree)
- `git fetch origin main` followed by `git rev-list --left-right --count origin/main...HEAD` — local must be in sync with origin (0 ahead, 0 behind) **before** the version bump commit lands. If local is ahead, ask the user whether to push existing commits first or abort.
- `node -p "require('./package.json').version"` — capture current version
- `git describe --tags --abbrev=0` — capture previous tag (e.g. `v1.6.0`); if no tag exists, treat previous as `(none)`
- `gh auth status` — confirm `gh` CLI is authenticated; abort with a clear message if not

If any check fails, stop and tell the user what's wrong. Do not proceed.

## 2. Show commits since last tag

`git log <prev-tag>..HEAD --oneline --no-merges` — show the user every commit that will be part of this release. Keep the output untruncated; this is what they're shipping.

## 3. Ask for version bump

Use AskUserQuestion with header "Bump type" and these options:

- **Patch** — `X.Y.Z` → `X.Y.(Z+1)`. Bug fixes, no behavior changes.
- **Minor** — `X.Y.Z` → `X.(Y+1).0`. New features, backwards-compatible.
- **Major** — `X.Y.Z` → `(X+1).0.0`. Breaking changes.
- **Custom** — let the user type the exact version string.

Compute the new version. Confirm it back to the user before continuing.

## 4. Verify [Unreleased] section has content

Read `CHANGELOG.md`. The `## [Unreleased]` section must have at least one entry under `### Added` / `### Changed` / `### Fixed` / etc.

- If it's empty, **don't fabricate entries from commit messages without consent**. Show the user the commits from step 2 and ask whether to draft entries from them, or whether they want to fill `[Unreleased]` manually and re-run `/release`.
- If it has content, show it to the user verbatim and ask them to confirm it's complete.

## 5. Update `CHANGELOG.md`

`CHANGELOG.md` is the **development reference** — the complete technical audit trail. Every release gets a section here, including internal refactors, dependency bumps, infra changes, and implementation detail (file names, function names). Never omit technical changes from it.

After the user confirms the `[Unreleased]` content:

- Replace `## [Unreleased]` with two headings:

  ```
  ## [Unreleased]

  ## [<NEW_VERSION>] - YYYY-MM-DD
  ```

  Today's date in `YYYY-MM-DD` (use the shell: `date +%Y-%m-%d` from `Bash`, not your assumed date).

- At the bottom of the file, update the link references:
  - Change `[Unreleased]: ...<PREV_TAG>...HEAD` to `[Unreleased]: ...v<NEW_VERSION>...HEAD`
  - Insert a new line `[<NEW_VERSION>]: ...<PREV_TAG>...v<NEW_VERSION>` below it

## 6. Update `web/src/data/changelog.json` (user-facing)

`changelog.json` is **user-facing only** — it gets an entry solely for changes a non-technical end user would notice. Skip internal refactors, dependency bumps, infra changes, and pure technical fixes per `CLAUDE.md`'s changelog policy. Unlike `CHANGELOG.md`, this file is not a complete record: a release with no user-visible changes gets no entry here at all (Case C below).

Three cases:

**Case A — an entry for `<NEW_VERSION>` already exists** (we may have pre-folded user-visible work in there during the cycle):

- Set `isLatest: true` on the new version's entry.
- Set `isLatest: false` on every other entry.
- Make sure its `date` matches today.
- Show the entry to the user and ask if it needs edits.

**Case B — no entry exists**:

- Draft a new entry by translating the `CHANGELOG.md` `[Unreleased]` content into plain language:
  - Skip internal refactors, dependency bumps, and pure technical changes per `CLAUDE.md`'s changelog policy.
  - Use `type` values: `added` / `changed` / `fixed` / `removed`.
  - Group related items under one `title` rather than one item per commit.
  - Write items as user-visible benefits, not implementation details.
- Insert at the top of the `versions` array.
- Set `isLatest: true` on the new entry and flip the previous latest to `isLatest: false`.
- Show the draft to the user and let them edit before committing.

**Case C — the release has no user-visible changes** (e.g. an internal-only refactor, infra change, dependency bump, or admin-only fix):

- Do not add an entry. Leave `changelog.json` untouched — do not flip `isLatest`, do not change any dates. The previous version stays `isLatest: true`.
- Tell the user you are skipping `changelog.json` because the release has nothing user-facing, so they can correct you if they disagree.

Validate the file parses (skip in Case C — file unchanged): `node -e "JSON.parse(require('fs').readFileSync('web/src/data/changelog.json','utf8'))"`.

## 7. Update `package.json` version

Edit `package.json` and set `"version": "<NEW_VERSION>"`. If `package-lock.json` exists at the repo root, update its top-level `"version"` (and the root `""` package entry's `"version"`) too — but **do not run `npm install`** during /release.

## 8. Stage and commit

Stage exactly these files (whichever exist and were modified):

- `package.json`
- `package-lock.json`
- `CHANGELOG.md`
- `web/src/data/changelog.json`

Commit with this message (use HEREDOC via Bash to preserve formatting):

```
🔖 Bump version to v<NEW_VERSION>

<bullet list summarizing the [Unreleased] entries, lifted from CHANGELOG.md>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

Do not push yet.

## 9. Confirm before pushing

Show the user:

- `git log -1 --stat` of the bump commit
- The new version number
- The previous tag and how many commits go into this release

Ask explicitly: "Push to origin/main and create the GitHub release?" Wait for an affirmative reply. **Do not proceed on a non-affirmative response.**

## 10. Push commit, then create the release

Once confirmed:

1. `git push origin main` — push the bump commit.
2. Extract the new version's `CHANGELOG.md` section into `/tmp/release-notes.md`:

   ```
   awk "/^## \[<NEW_VERSION>\]/{flag=1; next} /^## \[/{flag=0} flag" CHANGELOG.md > /tmp/release-notes.md
   ```

3. Create the release. **This is what creates the tag — do not pre-create a tag locally.**

   ```
   gh release create v<NEW_VERSION> \
     --target main \
     --title "Release v<NEW_VERSION>" \
     --notes-file /tmp/release-notes.md
   ```

4. Print the release URL from the `gh` output and tell the user the deploy workflow has been triggered. They can watch it with `gh run watch` or in the Actions tab.

## Edge cases & notes

- The deploy workflow (`.github/workflows/deploy-version.yml`) triggers on tag push (`v*.*.*`). It validates that `package.json` version matches the tag, deploys to the VPS, and runs a health check. It no longer creates a GitHub release — that's now this skill's responsibility.
- If `gh release create` fails after the commit pushed, the version bump is still in `main` but no tag exists. Tell the user; they can rerun just step 10 with the same `<NEW_VERSION>`. Do not roll back the commit automatically.
- If push fails because origin advanced, abort. Tell the user to rebase manually and rerun `/release`. Never force-push.
- Never use `--no-verify` on the commit. Never amend an earlier commit.
- The previous tag's release notes live in CHANGELOG.md too; this skill never touches them.
