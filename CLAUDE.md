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
Four new slash commands allow manual control of automated standup operations:
- `/dd-standup-remind [team-name]` - Manually send standup reminders to all active team members
- `/dd-standup-post [date] [team-name]` - Post standup summary for any date (includes late responses)
- `/dd-standup-preview [date] [team-name]` - Preview standup summary as ephemeral message before posting
- `/dd-standup-followup [team-name]` - Send followup reminders to members who haven't responded

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

## Software Development Best Practices

### Code Quality Principles

**KISS (Keep It Simple, Stupid)**
- Write simple, straightforward code that's easy to understand
- Avoid unnecessary complexity and over-engineering
- Three similar lines of code is better than a premature abstraction
- Don't add features, refactoring, or "improvements" beyond what was asked

**DRY (Don't Repeat Yourself)**
- Extract repeated logic into reusable functions or utilities
- Keep utility functions in appropriate helper files (`src/utils/`)
- Use shared constants instead of magic numbers/strings

**YAGNI (You Aren't Gonna Need It)**
- Don't design for hypothetical future requirements
- Only build what's needed for current requirements
- Don't add configuration options or flexibility that aren't requested
- No feature flags or backwards-compatibility shims unless absolutely necessary

**Single Responsibility Principle**
- Each function should do one thing well
- Each service should handle one domain area
- Separate business logic from presentation logic

### Naming Conventions

**Files and Directories**
- Use camelCase for JavaScript files: `userHelper.js`, `standupService.js`
- Use PascalCase for React components: `VersionCard.tsx`, `Changelog.tsx`
- Use kebab-case for scripts: `check-team-members.js`, `trigger-standup.js`
- Group related files in directories by feature/domain

**Variables and Functions**
- Use camelCase for variables and functions: `teamName`, `getUserData()`
- Use descriptive names that explain purpose: `isWorkingDay()` not `check()`
- Boolean variables should start with `is`, `has`, `can`, `should`: `isActive`, `hasPermission`
- Use verb prefixes for functions: `get`, `set`, `create`, `update`, `delete`, `fetch`, `send`

**Constants**
- Use UPPER_SNAKE_CASE for true constants: `DEFAULT_TIMEZONE`, `MAX_RETRIES`
- Use descriptive names over abbreviations: `ORGANIZATION_ROLE` not `ORG_R`

**Database Models**
- Use PascalCase for Prisma models: `Organization`, `TeamMember`, `StandupResponse`
- Use camelCase for fields: `slackUserId`, `createdAt`, `isActive`

### Error Handling Patterns

**Always Handle Errors Gracefully**
```javascript
// Good: Specific error handling with user-friendly messages
try {
  const result = await someOperation();
  return result;
} catch (error) {
  console.error("Failed to perform operation:", error.message);
  throw new Error("Unable to complete the request. Please try again.");
}

// Bad: Silent failures or generic errors
try {
  const result = await someOperation();
  return result;
} catch (error) {
  // Silent failure - user never knows what happened
}
```

**Fail Fast**
- Validate inputs at the beginning of functions
- Return early for error conditions
- Don't nest error handling deeply

**Log Meaningful Context**
```javascript
// Good: Contextual logging
console.error(`Failed to send reminder to user ${userId} in team ${teamName}:`, error.message);

// Bad: Generic logging
console.error("Error:", error);
```

### Security Best Practices

**Input Validation**
- Always validate user inputs (Slack user IDs, team names, dates)
- Use Prisma's type safety to prevent SQL injection
- Sanitize text content before displaying in Slack messages

**Prevent Command Injection**
- Never use `eval()` or `Function()` constructor
- Don't execute shell commands with user input without validation
- Use parameterized queries (Prisma handles this automatically)

**Authentication & Authorization**
- Always check permissions before admin operations
- Use `permissionHelper` for consistent permission checks
- Never trust client-side data for authorization decisions

**Secrets Management**
- Keep all secrets in `.env` file (never commit)
- Never log sensitive data (tokens, passwords, API keys)
- Use environment variables for configuration

**Common Vulnerabilities to Avoid**
- XSS: Escape user input in Slack messages
- SQL Injection: Use Prisma ORM (parameterized queries)
- Command Injection: Validate inputs, avoid shell execution with user data
- Rate Limiting: Respect Slack API rate limits, use sequential processing for bulk operations

### Performance Considerations

**Database Queries**
- Use Prisma `select` to fetch only needed fields
- Use `include` judiciously (avoid N+1 queries)
- Add indexes for frequently queried fields
- Use pagination for large result sets

**Slack API Usage**
- Respect rate limits (1 request per second per channel)
- Use bulk operations when available
- Process teams sequentially for bulk operations to avoid rate limits
- Cache Slack API responses when appropriate

**Async/Await Best Practices**
- Always await async operations
- Use `Promise.all()` for independent parallel operations
- Use sequential processing when operations depend on each other
- Handle errors properly in async functions

### Code Organization

**Service Layer Pattern**
```javascript
// Services contain business logic
// src/services/standupService.js
async function getActiveMembers(teamId, date) {
  // Business logic here
}

// Commands handle user interaction
// src/commands/standup.js
async function standupCommand({ command, ack, respond }) {
  // Parse input, call service, format response
}
```

**Separation of Concerns**
- Commands: Parse input, validate, call services, format response
- Services: Business logic, data operations
- Utils: Reusable helper functions
- Workflows: Handle interactive components (buttons, modals)

**File Organization**
- Keep files focused (< 500 lines ideally)
- Group related functionality in directories
- Use index.js for clean exports when appropriate

### Git Commit Best Practices

**Commit Message Format**
```
type(scope): brief description

Detailed explanation if needed

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `style`: Formatting changes
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(standup): add bulk operations for all teams
fix(holiday): resolve database schema mismatch error
docs(readme): update command documentation
refactor(utils): extract date formatting to helper
```

**Commit Guidelines**
- Write clear, descriptive commit messages
- Focus on "why" rather than "what"
- Keep commits atomic (one logical change per commit)
- Don't commit broken code
- Don't commit sensitive data or credentials

### API Design Patterns

**Function Signatures**
```javascript
// Good: Clear parameters, return values
async function sendStandupReminders(team, date = new Date()) {
  // Implementation
  return { successCount, failureCount };
}

// Bad: Unclear parameters, no return value documentation
async function send(t, d) {
  // Implementation
}
```

**Error Handling**
```javascript
// Good: Specific error types
if (!team) {
  throw new Error(`Team "${teamName}" not found`);
}

// Bad: Generic errors
if (!team) {
  throw new Error("Error");
}
```

### Documentation Standards

**Function Documentation**
```javascript
/**
 * Sends standup reminders to active team members
 * @param {Object} team - Team object with id, name, and timezone
 * @param {Date} date - Date to check for eligibility (default: today)
 * @returns {Promise<{successCount: number, failureCount: number}>}
 */
async function sendStandupReminders(team, date = new Date()) {
  // Implementation
}
```

**Code Comments**
- Explain "why" not "what" (code should be self-documenting)
- Document complex algorithms or business rules
- Add TODO/FIXME comments for known issues
- Keep comments up-to-date with code changes

**README Updates**
- Document all user-facing features
- Provide usage examples
- Keep command reference current
- Document environment variables

### React/Frontend Best Practices

**Component Structure**
- One component per file
- Keep components focused and reusable
- Use TypeScript for type safety
- Extract complex logic to custom hooks

**State Management**
- Use React Context for theme, auth
- Keep state close to where it's used
- Avoid prop drilling (use context when needed)

**Performance**
- Use React.memo() for expensive components
- Lazy load routes with React.lazy()
- Optimize images and assets

### Avoid Common Pitfalls

**Don't:**
- Add error handling for impossible scenarios
- Create helpers for one-time operations
- Add comments to unchanged code
- Add docstrings/type annotations to code you didn't write
- Use backwards-compatibility hacks for unused code
- Make changes beyond what was requested
- Over-engineer simple solutions

**Do:**
- Keep solutions minimal and focused
- Remove unused code completely (don't comment it out)
- Trust internal code and framework guarantees
- Only validate at system boundaries (user input, external APIs)
- Make reversible changes when possible
- Ask for confirmation before risky operations