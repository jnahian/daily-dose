# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

### Changed

- Leave management section in README reorganized to separate personal vs admin commands
- Slack manifest updated with new admin leave commands

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

[Unreleased]: https://github.com/jnahian/daily-dose/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/jnahian/daily-dose/releases/tag/v1.0.0
