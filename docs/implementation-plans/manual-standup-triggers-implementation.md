# Implementation Plan: Manual Standup Trigger Slash Commands

## Overview
Implement slash commands for admins and owners to manually trigger standup operations (reminders, posts, previews, followups).

**Approach**: Option A - Context-aware single command
- Admins in team channel: `/dd-standup-remind` (auto-detects team from channel)
- Owners anywhere: `/dd-standup-remind Engineering Team` (must specify team name)

## Step-by-Step Implementation

### Phase 1: Core Infrastructure Setup

#### 1. Create Permission Helper Utility
- [ ] Create `src/utils/permissionHelper.js`
- [ ] Implement `isOrganizationOwner(userId, organizationId)` function
  - Query User table to check if user created the organization
  - Return boolean
- [ ] Implement `isTeamAdmin(userId, teamId)` function
  - Query TeamMember table to check if user has ADMIN role
  - Return boolean
- [ ] Implement `canManageTeam(userId, teamId)` function
  - Check if user is owner OR admin of the team
  - Return boolean with role information
- [ ] Add comprehensive JSDoc documentation

#### 2. Create Team Resolution Helper
- [ ] Add function `resolveTeamFromContext(channelId, teamName, userId)` to `src/utils/teamHelper.js` (or create if doesn't exist)
  - If teamName provided, find team by name (case-insensitive)
  - If no teamName, find team by channelId
  - Validate team exists and is active
  - Return team object or null
- [ ] Add function `getTeamsByOrganization(organizationId)` for owner operations
- [ ] Add error message helpers for team not found scenarios

#### 3. Create Command Response Helpers
- [ ] Add functions to `src/utils/blockHelper.js`:
  - `createCommandSuccessBlocks(message, details)` - Success response with optional details
  - `createCommandErrorBlocks(message, suggestions)` - Error response with suggestions
  - `createPermissionDeniedBlocks(requiredRole)` - Permission error message
  - `createStandupPreviewBlocks(standupData)` - Preview format for ephemeral messages
- [ ] Follow guidelines from `docs/slack-markdown-guidelines.md`

### Phase 2: Standup Reminder Command

#### 4. Create `/dd-standup-remind` Command Handler
- [ ] Create `src/commands/standup/remindCommand.js`
- [ ] Import required services and utilities
- [ ] Implement main command handler function:
  - [ ] Parse command text to extract optional team name
  - [ ] Get user from database using `command.user_id`
  - [ ] Resolve team using `resolveTeamFromContext(command.channel_id, teamName, user.id)`
  - [ ] Check permissions using `canManageTeam(user.id, team.id)`
  - [ ] If not authorized, send permission denied message
- [ ] Call reminder logic:
  - [ ] Import `schedulerService.sendStandupReminders(team)`
  - [ ] Initialize schedulerService with app instance
  - [ ] Execute reminder sending
  - [ ] Capture count of reminders sent
- [ ] Send response:
  - [ ] Success: Show count of reminders sent
  - [ ] Error: Show error message with troubleshooting steps
- [ ] Add error handling for all scenarios

#### 5. Register Reminder Command
- [ ] Add command registration in `src/app.js` or command index
- [ ] Map `/dd-standup-remind` to handler
- [ ] Test command in Slack (manual testing)

### Phase 3: Standup Post Command

#### 6. Create `/dd-standup-post` Command Handler
- [ ] Create `src/commands/standup/postCommand.js`
- [ ] Implement main command handler function:
  - [ ] Parse command text to extract optional date and team name
  - [ ] Validate date format if provided (YYYY-MM-DD)
  - [ ] Get user from database
  - [ ] Resolve team using context
  - [ ] Check permissions using `canManageTeam(user.id, team.id)`
- [ ] Call posting logic:
  - [ ] Determine target date (provided or today in team timezone)
  - [ ] Import `standupService.postTeamStandup(team, date, app)`
  - [ ] Execute standup posting
  - [ ] Capture message timestamp
- [ ] Handle no data scenario:
  - [ ] Check if responses exist before posting
  - [ ] Show informative message if no data
- [ ] Send response:
  - [ ] Success: Show confirmation with message timestamp
  - [ ] Error: Show error with context
- [ ] Add comprehensive error handling

#### 7. Register Post Command
- [ ] Add command registration in `src/app.js`
- [ ] Map `/dd-standup-post` to handler
- [ ] Test command in Slack

### Phase 4: Standup Preview Command

#### 8. Create `/dd-standup-preview` Command Handler
- [ ] Create `src/commands/standup/previewCommand.js`
- [ ] Implement main command handler function:
  - [ ] Parse command text for optional date and team name
  - [ ] Validate date format if provided
  - [ ] Get user from database
  - [ ] Resolve team using context
  - [ ] Check permissions using `canManageTeam(user.id, team.id)`
- [ ] Generate preview:
  - [ ] Determine target date
  - [ ] Get responses using `standupService.getTeamResponses(teamId, date)`
  - [ ] Get late responses using `standupService.getLateResponses(teamId, date)`
  - [ ] Get active members using `standupService.getActiveMembers(teamId, date)`
  - [ ] Get members on leave from database
  - [ ] Calculate not submitted list
  - [ ] Format using `standupService.formatStandupMessage()`
- [ ] Send ephemeral response:
  - [ ] Use `respond()` with `response_type: "ephemeral"`
  - [ ] Include preview header
  - [ ] Show formatted standup data
  - [ ] Add note about using `/dd-standup-post` to publish
- [ ] Handle no data scenario

#### 9. Register Preview Command
- [ ] Add command registration in `src/app.js`
- [ ] Map `/dd-standup-preview` to handler
- [ ] Test command in Slack

### Phase 5: Standup Followup Command

#### 10. Create `/dd-standup-followup` Command Handler
- [ ] Create `src/commands/standup/followupCommand.js`
- [ ] Implement main command handler function:
  - [ ] Parse command text for optional team name
  - [ ] Get user from database
  - [ ] Resolve team using context
  - [ ] Check permissions using `canManageTeam(user.id, team.id)`
- [ ] Call followup logic:
  - [ ] Import `schedulerService.sendFollowupReminders(team)`
  - [ ] Initialize schedulerService with app instance
  - [ ] Execute followup reminder sending
  - [ ] Capture count of reminders sent
- [ ] Send response:
  - [ ] Success: Show count of followup reminders sent
  - [ ] Error: Show error message
- [ ] Add error handling

#### 11. Register Followup Command
- [ ] Add command registration in `src/app.js`
- [ ] Map `/dd-standup-followup` to handler
- [ ] Test command in Slack

### Phase 6: Slack Manifest Updates

#### 12. Update Slack App Manifest
- [ ] Open `slack-manifest.json` or equivalent
- [ ] Add new slash commands to manifest:
  ```json
  {
    "command": "/dd-standup-remind",
    "url": "https://your-app-url.com/slack/commands",
    "description": "Send standup reminders to team members",
    "usage_hint": "[team-name] (team name required for owners)"
  }
  ```
- [ ] Add `/dd-standup-post` with description and usage hint
- [ ] Add `/dd-standup-preview` with description and usage hint
- [ ] Add `/dd-standup-followup` with description and usage hint
- [ ] Update bot scopes if needed (should already have required scopes)

#### 13. Deploy Manifest Changes
- [ ] Run `npm run manifest:dry-run` to preview changes
- [ ] Review changes carefully
- [ ] Run `npm run manifest:update` to deploy
- [ ] Verify commands appear in Slack workspace

### Phase 7: Documentation

#### 14. Update README.md
- [ ] Add new commands section under "Slash Commands"
- [ ] Document each command with:
  - Command syntax
  - Description
  - Required permissions
  - Examples for admins and owners
  - Error scenarios
- [ ] Add troubleshooting section for common issues

#### 15. Update CLAUDE.md
- [ ] Add commands to "Development Commands" section
- [ ] Document manual trigger workflow
- [ ] Add notes about permission system
- [ ] Update architecture notes if needed

#### 16. Create Usage Documentation
- [ ] Create `docs/commands/manual-standup-triggers.md`
- [ ] Provide detailed examples for each command
- [ ] Include screenshots or example outputs
- [ ] Document permission matrix
- [ ] Add FAQ section

### Phase 8: Testing & Validation

#### 17. Unit Testing Preparation
- [ ] Identify testable functions in helpers
- [ ] Create test data fixtures for teams, users, responses
- [ ] Set up test database or mocks

#### 18. Manual Testing - Admin Scenarios
- [ ] Test `/dd-standup-remind` in team channel as admin
- [ ] Test `/dd-standup-post` in team channel as admin
- [ ] Test `/dd-standup-post 2025-01-15` with past date
- [ ] Test `/dd-standup-preview` in team channel
- [ ] Test `/dd-standup-followup` in team channel
- [ ] Verify permission denied for non-admin users
- [ ] Test with team that has no responses
- [ ] Test with team that has members on leave

#### 19. Manual Testing - Owner Scenarios
- [ ] Test `/dd-standup-remind Engineering Team` as owner
- [ ] Test `/dd-standup-post Marketing Team` as owner
- [ ] Test `/dd-standup-post Product Team 2025-01-15` as owner
- [ ] Test `/dd-standup-preview Sales Team` as owner
- [ ] Test `/dd-standup-followup Support Team` as owner
- [ ] Test with non-existent team name
- [ ] Test with team names containing spaces

#### 20. Error Scenario Testing
- [ ] Test with invalid date format
- [ ] Test with channel not associated with any team
- [ ] Test with user not in database (shouldn't happen but handle gracefully)
- [ ] Test with team that has no active members
- [ ] Test with database connection errors
- [ ] Test with Slack API errors

#### 21. Edge Case Testing
- [ ] Test command during actual automated standup time
- [ ] Test posting multiple times for same date
- [ ] Test with team in different timezone
- [ ] Test with very long team names
- [ ] Test with special characters in team names
- [ ] Test rapid consecutive command execution

### Phase 9: Monitoring & Rollout

#### 22. Add Logging
- [ ] Add structured logging for all command executions
- [ ] Log permission checks and results
- [ ] Log team resolution attempts
- [ ] Log API calls to Slack
- [ ] Add success/failure metrics

#### 23. Error Monitoring Setup
- [ ] Ensure Sentry or error tracking captures command errors
- [ ] Add custom error tags for manual triggers
- [ ] Set up alerts for permission errors
- [ ] Monitor API rate limits

#### 24. Rollout Plan
- [ ] Deploy to staging/test workspace first
- [ ] Test with small group of beta users
- [ ] Gather feedback on UX and error messages
- [ ] Make adjustments based on feedback
- [ ] Deploy to production
- [ ] Announce new commands to users
- [ ] Monitor usage and errors for first week

### Phase 10: Cleanup & Optimization

#### 25. Code Review & Refactoring
- [ ] Review all new code for consistency
- [ ] Ensure error messages are user-friendly
- [ ] Check for code duplication
- [ ] Optimize database queries
- [ ] Add missing JSDoc comments

#### 26. Performance Optimization
- [ ] Profile command response times
- [ ] Add caching for permission checks if needed
- [ ] Optimize team resolution queries
- [ ] Add rate limiting if necessary

#### 27. Future Enhancements Preparation
- [ ] Document potential improvements
- [ ] Create issues for future features:
  - Bulk operations for owners
  - Scheduled manual posts
  - Analytics dashboard
  - Webhook notifications
- [ ] Gather user feedback for prioritization

## Success Criteria

- ✅ All four commands are functional and registered in Slack
- ✅ Permission system correctly differentiates admins and owners
- ✅ Context-aware team resolution works reliably
- ✅ Error messages are clear and actionable
- ✅ Documentation is complete and accurate
- ✅ Manual testing covers all scenarios
- ✅ No regressions in existing standup functionality
- ✅ Commands work across multiple teams and timezones

## Estimated Effort

- **Phase 1-2**: 4-6 hours (infrastructure and first command)
- **Phase 3-5**: 6-8 hours (remaining commands)
- **Phase 6-7**: 2-3 hours (manifest and docs)
- **Phase 8**: 4-6 hours (comprehensive testing)
- **Phase 9-10**: 2-4 hours (monitoring and cleanup)

**Total**: 18-27 hours

## Dependencies

- Existing services: `schedulerService`, `standupService`, `teamService`
- Database: Prisma schema (User, Team, TeamMember, StandupResponse)
- Slack API: Bolt framework, slash command endpoints
- Scripts: Logic from `sendManualStandup.js` and `triggerStandup.js`

## Risk Mitigation

- **Permission bypass**: Thorough testing of permission checks
- **Data inconsistency**: Validate all inputs before processing
- **API rate limits**: Implement rate limiting and backoff
- **User confusion**: Clear error messages and comprehensive docs
- **Channel access**: Reuse troubleshooting logic from existing scripts

---

**Status**: Ready for Implementation
**Created**: 2025-01-09
**Approach**: Option A - Context-aware single command
**Author**: Generated with Claude Code
