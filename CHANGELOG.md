# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/jnahian/daily-dose/compare/v1.4.2...HEAD
[1.4.2]: https://github.com/jnahian/daily-dose/compare/v1.4.1...v1.4.2
[1.4.1]: https://github.com/jnahian/daily-dose/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/jnahian/daily-dose/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/jnahian/daily-dose/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/jnahian/daily-dose/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/jnahian/daily-dose/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/jnahian/daily-dose/compare/v1.0.0...v1.0.2
[1.0.0]: https://github.com/jnahian/daily-dose/releases/tag/v1.0.0
