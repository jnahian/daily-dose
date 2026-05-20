# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Server-side BasicAuth gate on `/scripts` route (`src/middleware/basicAuth.js`, `src/app.js`). Replaces the React-only client-side gate that was bypassable by direct URL access. Application refuses to start if `SCRIPTS_AUTH_USERNAME` or `SCRIPTS_AUTH_PASSWORD` is unset.
- `UserFacingError` class and `sanitizeError(err, fallback?)` helper in `src/utils/errorHelper.js`. Command handlers now emit a generic `Something went wrong (ref: ...)` message for unknown errors; service-provided messages are only rendered verbatim when the service throws `UserFacingError`.
- `parseTimeString(input)` validator and `TimeFormatError` in `src/utils/timeHelper.js`. Rejects malformed `HH:MM` input at command boundaries before scheduler registration.
- Jest test harness at the repo root (`jest.config.js`, `npm test`, `npm run test:watch`, `npm run test:coverage`). 32 tests across `timeHelper`, `errorHelper`, and `basicAuth` middleware.
- Composite database index `@@index([teamId, standupDate])` on `StandupResponse` (migration `20260520044120_standup_response_team_date_index`). The existing `@@unique([teamId, userId, standupDate])` constraint cannot serve team + date-range queries without a `userId`, the shape used by `getTeamResponses`, `getLateResponses`, and the response counting in `postTeamStandup`.
- `isWorkingDayPure({ date, workDays, holidayDateSet })`, `getHolidayDateSet()`, and `getOrgDefaultWorkDays()` in `src/utils/dateHelper.js` — a pure work-day check plus batch holiday lookup for hot-path callers. `test/utils/dateHelper.test.js` adds 7 tests.

### Changed

- `/dd-team-create` and `/dd-team-update` now validate time inputs and reject invalid formats (e.g. `99:99`) before scheduler registration.
- `schedulerService.scheduleTeam` defensively re-parses stored team times and skips registration with a logged warning for teams with invalid stored data.
- Command-handler catch blocks in `src/commands/team.js`, `src/commands/standup.js`, `src/commands/leave.js` route errors through `sanitizeError` rather than rendering raw `error.message`.
- `userService.promoteOrganizationMember` and `userService.setOrganizationMemberActive` convert all user-facing throws to `UserFacingError` so messages such as "You cannot promote yourself" and "Target user not found" are preserved through `sanitizeError` instead of being redacted.
- `teamService.promoteTeamMember` converts all user-facing throws to `UserFacingError` for the same reason; adds `UserFacingError` import to `teamService.js`.
- `parseTimeString` catch blocks in `/dd-team-create` and `/dd-team-update` route through `sanitizeError` for pattern consistency (behavior unchanged since `TimeFormatError.userFacing === true`).
- `standupService.getActiveMembers` batches its holiday and work-day lookups instead of calling the per-member async `isWorkingDay`, which re-fetched the same organization settings and per-user `workDays` every iteration. Query count is now O(1) in team size (~3 queries) instead of 2N+1 (~21 for a 10-person team, ~101 for 50). `isWorkingDay` is retained as a thin async wrapper for low-volume one-off callers and short-circuits on non-work days before its holiday query.

### Security

- `/scripts` is no longer reachable without valid `SCRIPTS_AUTH_USERNAME` / `SCRIPTS_AUTH_PASSWORD` credentials.
- Removed hardcoded `admin`/`daily-dose-admin` default credentials from `basicAuth` middleware.

## [1.6.2] - 2026-05-19

### Added

- `/dd-org-promote @user [TeamName]` — promotes a user to admin role (org owner/admin only)
  - With no `TeamName`: promotes the target's `OrganizationMember.role` from `MEMBER` to `ADMIN` in the actor's organization
  - With a `TeamName`: promotes the target's `TeamMember.role` from `MEMBER` to `ADMIN` in that team
  - Permission gate: actor must have an active `OrganizationMember` with role `OWNER` or `ADMIN`; team-scope path checks the team's org, not the channel
  - Guards: target must be an active member of the relevant scope (org or team); rejects self-promotion, already-admin targets, and org owners (already at the highest role)
  - Service layer: added `userService.promoteOrganizationMember()` and `teamService.promoteTeamMember()`
  - Accepts the same three target formats as the suspend commands (mention, raw Slack user ID, bare `@username`/`username`) via the existing `resolveTargetSlackUserId` helper
  - Command registered without `stripFormatting` so `<@U…|name>` mention tokens survive for `parseUserMention`
  - Team-scope lookup is scoped to the actor's organization to prevent cross-tenant collisions when a team of the same name exists in another org
  - Slash command added to `slack-app-manifest.json`

### Changed

- `teamService.findTeamByName(teamName, organizationId = null)` now accepts an optional `organizationId` filter; existing call sites that omit it retain the previous global behavior

## [1.6.1] - 2026-05-17

### Changed

- `/dd-team-list` is now scoped by role. Members and team admins see only the teams they are an active member of; org owners, org admins, and active super admins continue to see every team in the organization.
  - Added `teamService.listTeamsForUser(slackUserId)` returning `{ teams, scope, organization }` — single `findUnique` on `User` with `super_admins` and active `organizations` includes, then a filtered `team.findMany` (privileged: all org teams; unprivileged: filtered via `members: { some: { userId, isActive: true } }`)
  - "Privileged" = `OrganizationMember.role` in `OWNER`/`ADMIN`, or an active row in `super_admins` (no `revoked_at`)
  - `/dd-team-list` heading now reads `Teams in <Org Name>:` for privileged users and `Your teams:` for regular members; empty-state message differs accordingly
  - Existing `teamService.listTeams` left untouched; its callers in `src/commands/standup.js` use it for separate semantics
- Replaced the npm-script release flow with a Claude Code `/release` skill (`.claude/commands/release.md`). Removed `version:patch`, `version:minor`, `version:major`, `version:check`, `preversion`, `postversion`, and `release` scripts from `package.json` and deleted `scripts/checkVersion.js`. Removed the now-redundant `create-release` job from `.github/workflows/deploy-version.yml` — the skill creates the GitHub release before pushing the tag, so the in-workflow create would fail with "release exists"

### Fixed

- `/dd-team-suspend`, `/dd-team-unsuspend`, `/dd-org-suspend`, and `/dd-org-unsuspend` now accept additional input formats so admins can target Slack users who have already been deactivated and can no longer be @-mentioned in chat:
  - Raw Slack user ID (e.g., `U0123ABCD` / `W0123ABCD`) — globally unique, accepted without an org lookup
  - Bare `@username` or `username` — resolved via the user's stored Slack `username` field, scoped to the admin's organization (since `User.username` is `String?` and not `@unique` in `schema.prisma`)
  - The standard `<@U…|name>` mention token remains the primary path for active users
- Added `userService.findUserByUsernameInOrg(username, organizationId)` and a `resolveTargetSlackUserId(token, organizationId)` helper in `src/commands/team.js` covering all three formats in priority order
- `handleTeamSuspension` now resolves the team first so `team.organizationId` is available for the username lookup; `handleOrgSuspension` pre-fetches the admin's org via `userService.getUserOrganization`
- Error message in `parseUserMention`'s "invalid mention" branch updated to list all three supported input formats

## [1.6.0] - 2026-05-17

### Added

- Member suspension feature
  - `/dd-team-suspend @user [TeamName]` — team admin (or org owner/admin) can suspend a member from a single team; falls back to channel's team when no name given
  - `/dd-team-unsuspend @user [TeamName]` — reactivate a suspended team member
  - `/dd-org-suspend @user` — org owner/admin suspends a member across the entire organization (cascades to currently-active `TeamMember` rows in that org)
  - `/dd-org-unsuspend @user` — reactivates the user's `OrganizationMember` only; does **not** resurrect team memberships (admin must use `/dd-team-unsuspend` per team) to avoid silently re-adding users who had left or been team-suspended independently
  - Suspension is implemented by toggling `TeamMember.isActive` / `OrganizationMember.isActive` — no new schema or migration required
  - Service layer: `teamService.setTeamMemberActive()` and `userService.setOrganizationMemberActive()` enforce permission checks and prevent self-suspension, suspending the only active team admin (per-team and org-wide), non-owners changing an owner's status, and team-reactivating a user who is currently org-suspended
  - Cascade and org-membership update wrapped in a Prisma transaction
- Auto-suspension when a Slack workspace user is deactivated
  - New `user_change` bot event subscription (`slack-app-manifest.json`)
  - `src/events/index.js` handles the event; when `event.user.deleted === true` calls `userService.suspendUserSystemWide(slackUserId)` which deactivates every active `OrganizationMember` and `TeamMember` row for that user across all orgs
  - System-triggered path bypasses admin-permission and sole-active-admin guards — the deactivated Slack user can no longer act, so suspension must apply regardless
  - Idempotent (only touches `isActive: true` rows); no-op when the Slack user isn't in our DB
  - Commands registered in `src/commands/index.js`; slash commands added to `slack-app-manifest.json`

## [1.5.1] - 2026-04-30

### Fixed

- Fixed `/dd-standup` returning a 500 error when run without a team name in a DM with the bot or in a non-team channel
  - Previously the no-team fallback rendered `createTeamSelectionBlocks`, which builds a Slack `actions` block with one button per team and exceeds Slack's 5-element-per-actions-block limit when the user belongs to 6+ teams
  - Replaced the team-selection fallback in `submitManual` (`src/commands/standup.js`) with a `createCommandErrorBlocks` usage hint listing the user's available teams
- Removed unused `createTeamSelectionBlocks` import from `src/commands/standup.js`

### Changed

- Normalized all slash-command error responses across `standup.js`, `team.js`, `leave.js`, `holiday.js`, and `preferences.js` to use `createCommandErrorBlocks` instead of plain `text:` responses
  - Replaces inline `❌ ...` strings with structured blocks (primary message + bulleted suggestions)
  - Affects usage hints, "team not found" / "no team in channel" branches, validation errors, and generic catch-block fallbacks
  - Interactive transports left untouched: `ack({text})` for action handlers, modal block content inside `client.views.update`, and `client.chat.postMessage` direct DMs

### Documentation

- Added `/dd-standup-history` entry to `web/src/data/docs.json` Standup Commands section so it surfaces on the `/docs` page (matching its existing presence in `README.md` and `slack-app-manifest.json`)
- Added v1.5.0 user-facing entry to `web/src/data/changelog.json` and demoted v1.4.6 from `isLatest`
- Trimmed `CLAUDE.md` from 556 to ~300 lines: removed the generic "Software Development Best Practices" section (KISS/DRY/YAGNI, naming, error-handling, git, React advice) and replaced with a focused "Project-Specific Conventions" section
  - Added "Deployment & Infrastructure" pointers (`DEPLOYMENT.md`, `docker-compose.yml`, `ecosystem.config.js`, `slack-app-manifest.json`)
  - Documented the recurring Cloudflare DNS-only requirement for Slack endpoints under Slack Integration
  - Listed `/dd-standup-history` in the Manual Standup Trigger Commands section
  - Noted empty `admin/` and `test/` placeholder directories
- Removed `GEMINI.md` (was a symlink to `CLAUDE.md`); project standardizes on `CLAUDE.md`

## [1.5.0] - 2026-04-30

### Added

- New `/dd-standup-history [start-date] [end-date]` slash command for members to view their own submitted standups across all their teams
  - No arguments: returns submissions from the user's last submitted day
  - Single date (`YYYY-MM-DD`): returns that day's submissions
  - Two dates: inclusive date range (order-independent)
  - Response is ephemeral; entries grouped by date with team name, yesterday/today/blockers, and late marker
- `standupService.getUserStandupHistory(slackUserId, startDate, endDate)` — fetches the user's responses across teams within a date range, ordered by date desc
- `standupService.getUserLastSubmissionDate(slackUserId)` — returns the most recent `standupDate` the user has submitted
- Registered `/dd-standup-history` in `src/commands/index.js` and `slack-app-manifest.json`

## [1.4.6] - 2026-03-30

### Changed

- Replaced "Add to Slack" buttons in Navbar and Hero with GitHub repository links
- Added repository field to package.json

## [1.4.5] - 2026-03-30

### Fixed

- Fixed all slash commands failing with "app did not respond" error in production
  - `ackWithProcessing` now properly awaits `ack()` as required by Bolt v4
  - Without `await`, the HTTP acknowledgment to Slack was not guaranteed to send within the 3-second window
  - Affected all `/dd-*` commands across team, leave, standup, holiday, and preferences modules
- Added missing `text` fallback argument to `chat.postMessage` calls in standup and followup reminders
  - Required by Slack for push notifications and screen reader accessibility

## [1.4.4] - 2026-03-18

### Added

- Web application favicon and PWA manifest assets
  - Android Chrome icons (192x192 and 512x512 PNG)
  - Apple touch icon for iOS home screen support
  - Favicon in multiple formats (16x16, 32x32, and ICO)
  - Site.webmanifest for Progressive Web App configuration
  - Enables proper branding across browsers and devices
- Git Town configuration file for branch and hosting setup
- Admin configuration files for database and environment setup
  - Docker Compose configuration for local development
  - Environment variable examples for admin setup

### Changed

- Database schema migration (20260318061742)

## [1.4.3] - 2026-02-05

### Added

- Bulk operations support for standup automation scripts
  - `triggerStandup.js` now supports `--all` flag for reminder and followup commands
  - `sendManualStandup.js` now supports `--all` flag for post and remind commands
  - Interactive confirmation prompts before bulk operations
  - Table preview showing all teams to be processed
  - Only processes teams with active members
  - Summary statistics with success/skipped/failed counts
  - Sequential processing to avoid rate limits
  - Comprehensive error handling for individual team failures

### Changed

- Enhanced standup automation scripts with bulk operation capabilities
  - `npm run standup:trigger -- reminder --all` - Send reminders to all active teams
  - `npm run standup:trigger -- followup --all` - Send followups to all active teams
  - `npm run standup:post -- post --all` - Post standups for all active teams
  - `npm run standup:post -- post --all --date YYYY-MM-DD` - Bulk post for specific date
  - `npm run standup:post -- post --all --dry-run` - Preview bulk posts
  - `npm run standup:post -- remind --all` - Send reminders to all active teams

## [1.4.2] - 2026-02-05

### Fixed

- Fixed holiday system database schema mismatch causing runtime errors
  - Updated Holiday model to use `organization_id` instead of `country` field
  - Changed unique constraint from `date_country` to `organization_id_date`
  - Updated `dateHelper.js` to query holidays by organization
  - Updated `holiday.js` commands (set, update, delete, list) to use organization-scoped holidays
  - Regenerated Prisma client to sync with database schema
  - Resolved "The column `holidays.country` does not exist" error in scheduler service

### Changed

- Holiday system is now fully organization-scoped instead of country-based
  - Each organization manages its own holidays independently
  - Holiday queries now require organization context
  - Added `description` and `updated_at` fields to Holiday model

## [1.4.1] - 2025-02-03

### Changed

- Updated project dependencies to latest versions
- Enhanced CLAUDE.md with comprehensive project documentation
  - Added utility scripts section with admin, team, and debug commands
  - Documented Web Frontend (React SPA) development workflow and build commands
  - Expanded Architecture Overview with detailed service descriptions
  - Enhanced Database Schema section with multi-tenant design patterns
  - Documented Slack Integration including Block Kit UI and markdown guidelines
  - Added Web Frontend Architecture section covering React, routing, styling, and theme system
  - Expanded Environment Configuration with categorized variable descriptions
  - Added Development Notes section with frontend workflow and conventions
- Improved command documentation with better clarity and examples
  - Refined `/dd-standup-reminder` command syntax and parameter requirements
  - Updated standup submission examples with correct field names
  - Added "Smart Prefilling" note explaining automatic pre-population
  - Enhanced "Channel-Based Commands" note with context-aware operation details
  - Clarified `/dd-team-update` notifications parameter with examples
  - Expanded leave management documentation with admin-only commands
  - Enhanced holiday management section with organization-wide clarification
- Clarified notification system behavior in documentation
  - Added comprehensive Notification System section explaining `receiveNotifications` behavior
  - Documented that `notify=off` disables ALL notifications (reminders + admin submission alerts)
  - Clarified `notify` parameter controls both standup reminders and admin submission notifications
  - Added use cases for team admins wanting to reduce notification noise
  - Updated web documentation (docs.json) with corrected command examples

### Removed

- Removed non-existent "view preferences" command examples from documentation

### Fixed

- Corrected preferences command implementation to match documented behavior

## [1.4.0] - 2025-11-26

### Added

- React-based web application with modern UI
  - Home page with hero section, features, and how it works
  - Comprehensive documentation with search functionality
  - Changelog page with version history
  - Contact form with functional form submission
  - Theme toggle for dark/light mode support
  - Lazy loading for pages with loading fallbacks
  - Global page transitions and scroll-to-top functionality
- GitHub issue and pull request templates for better issue tracking
- Organization administrator management script (`addOrgAdmin.js`)
- Documentation search functionality to filter navigation and content
- Lucide icons integration for UI components
- Enhanced responsiveness across all pages with sticky sidebar

### Changed

- Removed legacy static HTML routes and `basicAuth` middleware
- Replaced multiple static routes with single-page application (SPA)
- Refactored documentation sidebar navigation to use external `docs.json`
- Updated Node.js version requirement to 20.19+ or 22.12+
- Improved Slack manifest update script with better error handling
- Enhanced Tailwind CSS configuration and styling
- Restructured UI components for theme-aware styling

### Removed

- Web frontend application static files (migrated to React)
- Legacy HTML routes and basic auth middleware
- Unnecessary console log statements

## [1.3.0] - 2025-11-20

### Added

- Manual standup trigger commands for admins and organization owners
  - `/dd-standup-remind [team-name]` - Send standup reminders to team members
  - `/dd-standup-post [YYYY-MM-DD] [team-name]` - Post standup summary for specific date
  - `/dd-standup-preview [YYYY-MM-DD] [team-name]` - Preview standup summary (ephemeral)
  - `/dd-standup-followup [team-name]` - Send followup reminders to non-responders
- Permission system with role-based access control
  - `permissionHelper.js` utility for checking Organization Owner and Team Admin roles
  - `isOrganizationOwner()`, `isTeamAdmin()`, and `canManageTeam()` functions
- Context-aware team resolution in `teamHelper.js`
  - Admins can run commands from team channel without specifying team name
  - Owners must specify team name when running from any location
  - `resolveTeamFromContext()` function for automatic team detection
  - `parseCommandArguments()` for flexible date and team name parsing
- Block helper functions for formatted command responses
  - `createCommandSuccessBlocks()` - Success messages with details
  - `createCommandErrorBlocks()` - Error messages with suggestions
  - `createPermissionDeniedBlocks()` - Permission error messages
  - `createStandupPreviewHeaderBlocks()` - Preview header formatting
  - `createNoDataBlocks()` - No data available messages
- Comprehensive audit logging for all admin actions
- User stories and implementation plan documentation

## [1.2.0] - 2025-01-09

### Changed

- Late standup submissions now create full standup posts when no parent message exists
  - First late submission for the day creates a complete standup post with all sections
  - Subsequent late submissions are added as threaded replies to the parent
  - Applies to both `/dd-standup` submissions and `/dd-standup-update` updates
  - New `postStandupOnDemand()` method in StandupService for on-demand standup post creation

## [1.1.0] - 2025-01-02

### Added

- Admin leave management commands for team admins
  - `/dd-leave-set-member` - Set leave for any team member (admin only)
  - `/dd-leave-cancel-member` - Cancel team member's leave (admin only)
  - `/dd-leave-list-member` - List team member's upcoming leaves (admin only)
- `isTeamAdmin()` method in TeamService to check admin permissions
- `getUserTeams()` method in TeamService to get user's teams
- `setMemberLeave()`, `cancelMemberLeave()`, and `listMemberLeaves()` methods in UserService
- Support for @mentions in admin leave commands
- Smart team detection for single-team admins
- Comprehensive permission checks for admin leave operations
- Admin leave management documentation in README
- Slack app manifest auto-update during deployment
- Release workflow separating version bump from tag creation

### Changed

- Leave management section in README reorganized to separate personal vs admin commands
- Slack manifest updated with new admin leave commands
- Version commands now only bump version without creating tags
- Release command creates tags and triggers deployment
- Manifest update script always uses `SLACK_APP_ID` from environment

## [1.0.2] - 2025-11-02

### Added

- Git-based package versioning with SemVer policy
- Automated deployment on version tag push
- Version management scripts (patch, minor, major)
- Pre-version checks for clean git state
- GitHub Actions workflow for version releases
- CHANGELOG.md for tracking version history

### Changed

- Standup posting logic to skip when no eligible members exist
- Standup messages exclude mention=off members from display

## [1.0.0] - 2025-11-02

### Added

- Initial release of Daily Dose Slack bot
- Automated daily standup reminders
- Team management commands
- Leave tracking system
- Timezone-aware scheduling
- Work day configuration
- Standup response collection via modals
- Team standup summaries
- Late submission threading
- User preference management
- Admin role management
- Multi-tenant organization support
- PostgreSQL database with Prisma ORM
- PM2 process management
- Health check endpoint
- Comprehensive documentation

### Features

- `/dd-team-create` - Create new standup teams
- `/dd-team-list` - List all teams
- `/dd-team-info` - View team details
- `/dd-team-update` - Update team configuration
- `/dd-team-delete` - Delete teams
- `/dd-team-leave` - Leave a team
- `/dd-team-join` - Join existing teams
- `/dd-standup-submit` - Submit standup updates
- `/dd-standup-reminder` - Configure reminder preferences
- `/dd-leave-add` - Add leave periods
- `/dd-leave-list` - View leave history
- `/dd-leave-remove` - Remove leave entries
- Automated standup reminders via DM
- Follow-up reminders for pending submissions
- Channel-based standup summaries
- Mention control for "Not Responded" lists

---

## Version History Guidelines

### Version Format: MAJOR.MINOR.PATCH

- **MAJOR** (X.0.0): Incompatible API changes, major feature overhauls
- **MINOR** (1.X.0): New features, backwards-compatible functionality
- **PATCH** (1.0.X): Bug fixes, minor improvements, backwards-compatible

### Change Categories

- **Added**: New features
- **Changed**: Changes in existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security vulnerability fixes

### How to Update

1. Make your changes on a feature branch
2. Update this CHANGELOG.md under `[Unreleased]`
3. Merge to main branch
4. Run version bump command:
   - `npm run version:patch` for bug fixes (1.0.X)
   - `npm run version:minor` for new features (1.X.0)
   - `npm run version:major` for breaking changes (X.0.0)
5. The version bump will:
   - Update package.json version
   - Create a git tag
   - Push to remote
   - Trigger automated deployment

[Unreleased]: https://github.com/jnahian/daily-dose/compare/v1.6.2...HEAD
[1.6.2]: https://github.com/jnahian/daily-dose/compare/v1.6.1...v1.6.2
[1.6.1]: https://github.com/jnahian/daily-dose/compare/v1.6.0...v1.6.1
[1.6.0]: https://github.com/jnahian/daily-dose/compare/v1.5.1...v1.6.0
[1.5.1]: https://github.com/jnahian/daily-dose/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/jnahian/daily-dose/compare/v1.4.6...v1.5.0
[1.4.6]: https://github.com/jnahian/daily-dose/compare/v1.4.5...v1.4.6
[1.4.5]: https://github.com/jnahian/daily-dose/compare/v1.4.4...v1.4.5
[1.4.4]: https://github.com/jnahian/daily-dose/compare/v1.4.3...v1.4.4
[1.4.3]: https://github.com/jnahian/daily-dose/compare/v1.4.2...v1.4.3
[1.4.2]: https://github.com/jnahian/daily-dose/compare/v1.4.1...v1.4.2
[1.4.1]: https://github.com/jnahian/daily-dose/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/jnahian/daily-dose/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/jnahian/daily-dose/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/jnahian/daily-dose/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/jnahian/daily-dose/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/jnahian/daily-dose/compare/v1.0.0...v1.0.2
[1.0.0]: https://github.com/jnahian/daily-dose/releases/tag/v1.0.0
