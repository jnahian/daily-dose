# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Daily Dose is a Slack bot that automates daily standup meetings for teams. Built with Node.js, it uses Slack's Bolt framework, PostgreSQL/Supabase for data storage, and Prisma as the ORM.

## Development Commands

### Core Operations
- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server
- `node src/app.js` - Direct app startup

### Database Operations
- `npx prisma generate` - Generate Prisma client after schema changes
- `npx prisma db push` - Push schema changes to database
- `npx prisma studio` - Open Prisma database GUI

### Utility Scripts
- `npm run seed` - Seed organization data
- `npm run org:add-admin` - Add organization admin
- `npm run standup:trigger` - Manually trigger standup reminders/followups
  - Supports specific team: `node scripts/triggerStandup.js reminder "Team Name"`
  - Supports all teams: `node scripts/triggerStandup.js reminder --all` (with confirmation)
  - Followup reminders: `node scripts/triggerStandup.js followup "Team Name"` or `followup --all`
- `npm run standup:post` - Send manual standup posts
  - Post for specific team: `node scripts/sendManualStandup.js post "Team Name"`
  - Post for all teams: `node scripts/sendManualStandup.js post --all` (with confirmation)
  - Supports `--date YYYY-MM-DD` for specific dates
  - Supports `--dry-run` for previewing without sending
  - Remind specific team: `node scripts/sendManualStandup.js remind "Team Name"`
  - Remind all teams: `node scripts/sendManualStandup.js remind --all` (with confirmation)
- `npm run slack:info` - View Slack team information
- `npm run team:members [team-name] [date]` - Check active team members and reminder eligibility
- `npm run team:promote` - Promote team member to admin
- `npm run debug:scheduler` - Debug scheduler jobs

### Slack Manifest Management
- `npm run manifest:create` - Create new Slack app manifest
- `npm run manifest:update` - Update existing Slack app manifest
- `npm run manifest:dry-run` - Preview manifest changes

### Web Frontend (React SPA)
- `cd web && npm run dev` - Start Vite dev server (separate from bot)
- `cd web && npm run build` - Build React app to `web/dist/`
- `cd web && npm run preview` - Preview production build
- `cd web && npm run lint` - Lint frontend code
- `cd web && npm run format` - Format frontend code with Prettier

### Version Management
- `npm run version:patch` - Bump patch version (bug fixes)
- `npm run version:minor` - Bump minor version (new features)
- `npm run version:major` - Bump major version (breaking changes)
- `npm run version:check` - Check version and git status
- `npm run release` - Tag and push release

### Changelog Management
**Two separate changelog files serve different purposes:**

1. **CHANGELOG.md** - Development reference only
   - Technical details for developers
   - All implementation details (file names, function names, code changes)
   - Database schema changes and technical fixes
   - Complete audit trail of all changes
   - Follows Keep a Changelog format
   - Not visible to end users

2. **web/src/data/changelog.json** - User-facing changelog
   - Displayed on the web application changelog page
   - Written for end users (non-technical)
   - Focus on user-visible features and improvements
   - Highlight benefits and use cases, not implementation details
   - Use plain language, avoid technical jargon
   - Emphasize what users can do, not how it works internally
   - Include only changes that matter to users

**When to update each:**
- Always update CHANGELOG.md for all changes
- Only update changelog.json for user-visible features, major fixes, or improvements
- Skip technical refactors, dependency updates, internal fixes from changelog.json
- For changelog.json, rewrite technical changes in user-friendly language

## Architecture Overview

### Core Structure
- **Entry Point**: `src/app.js` - Main application file with Slack Bolt setup and Express server
- **Commands**: `src/commands/` - Slack slash command handlers (team, leave, standup, preferences, holiday)
- **Workflows**: `src/workflows/` - Slack interactive component handlers (buttons, modals, actions)
- **Services**: `src/services/` - Business logic (scheduler, standup, team, user)
- **Utilities**: `src/utils/` - Helper functions (date, message, command, user, logger, permission, team, blockHelper)
- **Database**: Prisma ORM with PostgreSQL via Supabase
- **Web Frontend**: React SPA in `web/` directory (served from `web/dist/`)
- **Scripts**: Administrative scripts in `scripts/` directory

### Key Services
- **SchedulerService**: Manages cron jobs for standup reminders and posting
- **StandupService**: Handles standup submission, formatting, and posting logic
- **TeamService**: Team creation, member management, and configuration
- **UserService**: User onboarding and organization membership

### Database Schema
Multi-tenant design with Organizations → Teams → Users hierarchy:
- **Organizations**: One per Slack workspace (slackWorkspaceId unique)
- **Teams**: Multiple per org, linked to Slack channels (slackChannelId unique)
- **Users**: Identified by slackUserId, can join multiple organizations and teams
- **Junction Tables**: OrganizationMember (with OrgRole), TeamMember (with TeamRole)
- **Leave System**: Leave table tracks user absences with date ranges
- **Holiday System**: Holiday table for organization-wide holidays
- **Standup Data**: StandupResponse (submissions), StandupPost (channel posts with thread tracking)

**Key Schema Patterns:**
- All IDs are UUIDs generated by Prisma
- Cascade deletes configured for organizational hierarchy
- Indexes on frequently queried fields (slackUserId, teamId, standupDate)
- TeamMember table has `receiveNotifications` and `hideFromNotResponded` flags for user preferences
- Team table stores times as strings (HH:MM format) with timezone
- Work days stored as JSON array in User table (e.g., [1,2,3,4,5] for Mon-Fri)

### Slack Integration
- Socket mode disabled - uses HTTP endpoints via ExpressReceiver
- Comprehensive slash commands with `/dd-` prefix
- Interactive components (buttons, modals) for standup submission
- Automated posting to team channels with formatting
- Block Kit UI components defined in `src/utils/blockHelper.js`
- All blocks must follow formatting guidelines from `docs/slack-markdown-guidelines.md`
- **Cloudflare gotcha**: Slack endpoints must be DNS-only on Cloudflare (proxy disabled). Cloudflare's edge buffering breaks Slack's 3-second ack window and causes recurring `/dd-*` command timeouts. See `DEPLOYMENT.md`.

### Web Frontend Architecture
- **Framework**: React 19 with TypeScript and Vite
- **Routing**: React Router 7 for client-side routing with SPA fallback
- **Styling**: Tailwind CSS v4 with custom theme support
- **Animations**: Framer Motion for transitions and interactive elements
- **Icons**: Lucide React + LordIcon for animated icons
- **Build Output**: Built to `web/dist/` and served by Express static middleware
- **Pages**: Home, Docs, Scripts (auth-protected), Changelog, Contact, Legal (Privacy, Terms)
- **Components**: Organized by feature (home, docs, scripts, changelog, auth)
- **Theme System**: Dark/light mode with context provider in `web/src/context/ThemeContext.tsx`

### Environment Configuration
Key environment variables in `.env`:
- **Slack tokens**: BOT_TOKEN, SIGNING_SECRET, APP_TOKEN, USER_TOKEN
- **Database URLs**: DATABASE_URL, DIRECT_URL
- **App settings**: PORT, DEFAULT_TIMEZONE, APP_URL
- **Logging**: LOG_LEVEL, SENTRY_DSN (optional)
- **Scripts Auth**: SCRIPTS_AUTH_USERNAME, SCRIPTS_AUTH_PASSWORD (for /scripts-docs route protection)

## Development Notes

### Web Frontend Development Workflow

**Development Setup:**
1. Main bot runs on port 3000 (configured via PORT env var)
2. Web dev server runs separately: `cd web && npm run dev` (usually port 5173)
3. In development, test web UI via Vite dev server for hot reload
4. Before deployment, build web app: `cd web && npm run build`
5. Production serves built files from `web/dist/` via Express static middleware

**Key Frontend Conventions:**
- All routes use React Router with SPA fallback in `src/app.js`
- Theme switching via ThemeContext (localStorage persistence)
- Page transitions with Framer Motion via PageTransition component
- Protected routes (like /scripts-docs) should implement BasicAuth component
- Mobile-first responsive design with Tailwind breakpoints

**Adding New Web Pages:**
1. Create page component in `web/src/pages/`
2. Add route to `web/src/App.tsx`
3. Update Navbar component if needed
4. Build and test: `npm run build && npm start`
5. Verify SPA fallback works for direct URL access

### Middleware System
- Global logging middleware for all Slack interactions
- Command formatting removal middleware to handle Slack's automatic formatting
- Comprehensive request/response logging for debugging

### Scheduling Architecture
Uses node-cron for:
- Daily standup reminders at configured team times
- Automatic standup posting after collection period
- Daily schedule refresh at midnight
- Timezone-aware scheduling per team

### Data Flow
1. Users join organizations automatically via Slack workspace (OrganizationMember created)
2. Teams created in specific channels with configured times (Team + TeamMember records)
3. Scheduler sends DM reminders at standup time (via schedulerService cron jobs)
4. User clicks button → opens modal (action handler in workflows/)
5. Responses collected via modal submission (StandupResponse created/updated)
6. Summary posted to team channel at posting time (StandupPost record tracks thread)
7. Late submissions added as thread replies (using slackMessageTs from StandupPost)

### Common Development Patterns

**Command Parameter Parsing:**
- Use `commandHelper.parseCommandText()` for consistent parsing
- Support both channel-based (no team name) and name-based (explicit team) commands
- Use `teamHelper.resolveTeamFromContext()` for context-aware team resolution

**Permission Checking:**
- Use `permissionHelper.isTeamAdmin()` and `permissionHelper.isOrgOwner()`
- Context-aware commands allow admins in team channel or owners from anywhere
- Always check permissions before executing admin-only operations

**Date Handling:**
- Use dayjs for all date operations with timezone support
- Convert team.timezone for accurate scheduling
- Use `dateHelper.isWorkDay()` to check user's work days
- Check holidays with Holiday table before sending reminders

**Message Formatting:**
- Rich text from modals: use `messageHelper.extractPlainText()` or `messageHelper.convertRichTextToSlack()`
- Always escape user input when constructing messages
- Use blockHelper functions for consistent UI
- Test block rendering in Slack (especially mentions, links, formatting)

**Notification System:**
- `TeamMember.receiveNotifications` controls ALL notifications for a user:
  - Standup reminder DMs (though admins are excluded from reminders by role)
  - Admin notifications about team member submissions (notificationService)
- Use `/dd-standup-reminder notify=on/off` to toggle this setting
- Admin submission notifications sent via `notificationService.notifyAdminsOfStandupSubmission()`
- Admins are automatically filtered out of standup reminders in schedulerService

### Permission System
The application implements a role-based permission system for administrative commands:
- **Organization Owners**: Users who created the organization (have access to all teams)
- **Team Admins**: Members with ADMIN role in TeamMember table (can manage specific teams)
- **Permission Helper** (`src/utils/permissionHelper.js`): Provides functions to check user roles
- **Context-Aware Commands**: Automatically resolve team from channel for admins, require explicit team name for owners

### Manual Standup Trigger Commands (Admin/Owner)
Slash commands for manual control of automated standup operations:
- `/dd-standup-remind [team-name]` - Manually send standup reminders to all active team members
- `/dd-standup-post [date] [team-name]` - Post standup summary for any date (includes late responses)
- `/dd-standup-preview [date] [team-name]` - Preview standup summary as ephemeral message before posting
- `/dd-standup-followup [team-name]` - Send followup reminders to members who haven't responded
- `/dd-standup-history` - View own standup submission history

**Implementation Details:**
- Commands use context-aware team resolution via `teamHelper.js`
- Admins can run commands in team channel without team name
- Owners must specify team name when running from any location
- Date parsing supports optional YYYY-MM-DD format for historical standups
- All commands integrated with existing `schedulerService` and `standupService` logic

### Block Kit UI Development
When creating or modifying Slack UI components:
- **ALWAYS** write reusable block functions in `src/utils/blockHelper.js` - never inline blocks
- **ALWAYS** follow formatting guidelines from `docs/slack-markdown-guidelines.md`
- Use consistent emoji prefixes for message types (see blockHelper.js for conventions)
- Prefer rich_text_input for multi-line text fields in modals
- Use context blocks for supplementary information
- Test blocks in Slack to ensure proper rendering

### Documentation Requirements
When adding/updating features:
1. **README.md**: Document all user-facing commands and features
2. **Slack Manifest**: Update `scripts/updateSlackManifest.js` if adding new commands or permissions
3. **Web Docs**: Update documentation pages in `web/src/` if feature has web UI
4. **Agent Assistance**: Call readme-updater agent after feature additions
5. **Block Kit**: Ensure UI follows `docs/slack-markdown-guidelines.md`

### Testing Approach
No automated tests currently configured - manual testing via Slack interactions and script execution.
- Test slash commands in Slack workspace
- Verify scheduler jobs with `npm run debug:scheduler`
- Check team member eligibility with `npm run team:members`
- Test web frontend locally with `cd web && npm run dev`
- The `test/` directory exists but is empty — no test runner is wired up.

### Deployment & Infrastructure
- **`DEPLOYMENT.md`** is authoritative for production setup (Hetzner VPS, Nginx, GitHub Actions, Supabase, Slack app config). Read it before changing infra-touching code.
- **`docker-compose.yml`** — local containerized stack.
- **`ecosystem.config.js`** — PM2 process config used in production.
- **`slack-app-manifest.json`** — committed Slack app manifest; managed via `npm run manifest:*` scripts.
- **Cloudflare**: keep Slack-facing DNS records DNS-only (orange cloud OFF). Proxy buffering breaks the 3-second ack window — recurring source of `/dd-*` timeouts.

### Repository Layout Notes
- **`admin/`** — empty placeholder directory.
- **`CONTRIBUTING.md`** — contributor workflow and conventions.
- **`docs/`** — design plans, user stories, and the canonical `slack-markdown-guidelines.md`.

## Project-Specific Conventions

These are non-obvious rules specific to this codebase. Generic engineering practices are intentionally omitted.

- **Notification flag semantics**: `TeamMember.receiveNotifications` controls *all* notifications for a user (reminder DMs *and* admin submission notifications). `TeamMember.hideFromNotResponded` hides a user from the "not responded" list in posted summaries. Toggle via `/dd-standup-reminder notify=on/off`. Admins are additionally filtered out of standup reminders by role in `schedulerService`.
- **Permission checks**: always go through `permissionHelper.isTeamAdmin()` / `isOrgOwner()`. Admins resolve team from current channel; owners must pass team name explicitly.
- **Block Kit**: every block must live in `src/utils/blockHelper.js` — never inline blocks at call sites. Follow `docs/slack-markdown-guidelines.md` for formatting (mentions, links, rich_text).
- **Bulk Slack operations**: process teams sequentially, not in parallel — Slack rate-limits at ~1 req/sec/channel.
- **Date handling**: use dayjs with team timezone; check `dateHelper.isWorkDay()` and the `Holiday` table before sending reminders.
- **Rich text from modals**: use `messageHelper.extractPlainText()` or `convertRichTextToSlack()` — don't read modal values directly.
- **Two changelogs, two audiences**: `CHANGELOG.md` is the technical audit trail (always updated); `web/src/data/changelog.json` is user-facing (only user-visible changes, plain language).

- Ask for confirmation before risky operations