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
- `npm run seed` - Seed organization data (`node src/scripts/seedOrg.js`)
- `npm run standup:trigger` - Manually trigger standup reminders
- `npm run standup:post` - Send manual standup posts
- `npm run slack:info` - View Slack team information
- `npm run team:members [team-name] [date]` - Check active team members and reminder eligibility

### Slack Manifest Management
- `npm run manifest:create` - Create new Slack app manifest
- `npm run manifest:update` - Update existing Slack app manifest
- `npm run manifest:dry-run` - Preview manifest changes

## Architecture Overview

### Core Structure
- **Entry Point**: `src/app.js` - Main application file with Slack Bolt setup
- **Commands**: `src/commands/` - Slack slash command handlers (team, leave, standup)
- **Services**: `src/services/` - Business logic (scheduler, standup, team, user)
- **Utilities**: `src/utils/` - Helper functions (date, message, command, user, logger)
- **Database**: Prisma ORM with PostgreSQL via Supabase

### Key Services
- **SchedulerService**: Manages cron jobs for standup reminders and posting
- **StandupService**: Handles standup submission, formatting, and posting logic
- **TeamService**: Team creation, member management, and configuration
- **UserService**: User onboarding and organization membership

### Database Schema
Multi-tenant design with Organizations → Teams → Users hierarchy:
- Organizations contain multiple Teams
- Teams have members with roles (ADMIN/MEMBER)
- Users can be in multiple teams across organizations
- Supports leave tracking, work day configuration, and standup responses

### Slack Integration
- Socket mode disabled - uses HTTP endpoints
- Comprehensive slash commands with `/dd-` prefix
- Interactive components (buttons, modals) for standup submission
- Automated posting to team channels with formatting

### Environment Configuration
Key environment variables in `.env`:
- Slack tokens (BOT_TOKEN, SIGNING_SECRET, APP_TOKEN, USER_TOKEN)
- Database URLs (DATABASE_URL, DIRECT_URL)
- App settings (PORT, DEFAULT_TIMEZONE, APP_URL)
- Logging configuration (LOG_LEVEL, SENTRY_DSN)

## Development Notes

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
1. Users join organizations automatically via Slack workspace
2. Teams created in specific channels with configured times
3. Scheduler sends DM reminders at standup time
4. Responses collected via interactive modals
5. Summary posted to team channel at posting time
6. Late submissions added as thread replies

### Testing Approach
No automated tests currently configured - manual testing via Slack interactions and script execution.
- all commands should be documented in readme file
- while adding/updating any command check the slack manifest file for required changes
- call readme updater agent after adding/updating a feature
- always write blocks in @src/utils/blockHelper.js
- always call html document updater agent on adding/updating any feature
- always maintain blocks formatting from @docs/slack-markdown-guidelines.md