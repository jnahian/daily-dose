# User Story: Manual Standup Trigger Slash Commands

## Overview
Enable team admins and organization owners to manually trigger standup operations (reminders and posts) through Slack slash commands, providing flexibility in standup management beyond automated scheduling.

## User Roles
- **Team Admin**: Member with ADMIN role in a specific team
- **Organization Owner**: User who created the organization (has owner privileges across all teams)

## Current State
Manual standup operations are currently available through Node.js scripts:
- `scripts/sendManualStandup.js` - Post standup summaries, send reminders, troubleshoot
- `scripts/triggerStandup.js` - Trigger standup and followup reminders

## User Stories

### Story 1: Admin Triggers Standup Reminder for Own Team
**As a** team admin
**I want to** manually trigger standup reminders for my team
**So that** I can prompt team members to submit their standups when needed (e.g., after technical issues, schedule changes)

**Acceptance Criteria:**
- Admin can use `/dd-standup-remind` command in their team's channel
- System sends DM reminders to all active team members who haven't submitted standup for today
- System respects leave status and work days configuration
- Admin receives confirmation message with number of reminders sent
- Command only works if user is an admin of the team associated with the channel

**Example Usage:**
```
/dd-standup-remind
```
**Response:**
```
✅ Sent standup reminders to 5 team members
```

### Story 2: Admin Triggers Standup Post for Own Team
**As a** team admin
**I want to** manually post the standup summary for my team
**So that** I can share standup updates at any time (e.g., before scheduled time, after collecting late submissions)

**Acceptance Criteria:**
- Admin can use `/dd-standup-post` command in their team's channel
- System collects all standup responses submitted for today
- System posts formatted standup summary to the channel
- Late submissions are posted as thread replies
- If no responses exist, system notifies admin
- Command only works if user is an admin of the team associated with the channel

**Example Usage:**
```
/dd-standup-post
```
**Response:**
```
✅ Standup posted successfully
📝 Message timestamp: 1234567890.123456
```

### Story 3: Admin Posts Standup for Specific Date
**As a** team admin
**I want to** post standup summary for a specific past date
**So that** I can share missed or delayed standup reports

**Acceptance Criteria:**
- Admin can use `/dd-standup-post [YYYY-MM-DD]` with optional date parameter
- System retrieves responses for the specified date
- System posts formatted summary with date in header
- If no responses exist for that date, system notifies admin
- Date validation ensures format is correct

**Example Usage:**
```
/dd-standup-post 2025-01-15
```
**Response:**
```
✅ Standup posted successfully for 2025-01-15
📝 Message timestamp: 1234567890.123456
```

### Story 4: Admin Previews Standup Before Posting
**As a** team admin
**I want to** preview the standup summary before posting it publicly
**So that** I can verify the content and decide whether to post

**Acceptance Criteria:**
- Admin can use `/dd-standup-preview` command in their team's channel
- System shows formatted standup summary as ephemeral message (only visible to admin)
- Preview includes all sections: responses, late submissions, not responded, on leave
- Admin can then use `/dd-standup-post` to actually post if satisfied
- Preview includes timestamp and date information

**Example Usage:**
```
/dd-standup-preview
```
**Response (ephemeral):**
```
🔍 Standup Preview for Today

📊 Daily Standup — Engineering Team
📅 Jan 15, 2025
👥 8/10 members responded

[... full standup preview ...]
```

### Story 5: Owner Triggers Operations for Any Team
**As an** organization owner
**I want to** manually trigger standup operations for any team in my organization
**So that** I can help teams with standup management across the organization

**Acceptance Criteria:**
- Owner can use `/dd-standup-remind [team-name]` to send reminders to any team
- Owner can use `/dd-standup-post [team-name]` to post standup for any team
- Owner can use `/dd-standup-preview [team-name]` to preview standup for any team
- System validates team name and shows error if team not found
- If team name contains spaces, it should be quoted or handled properly
- Owner receives confirmation messages similar to admin commands

**Example Usage:**
```
/dd-standup-remind Engineering Team
/dd-standup-post Marketing Team 2025-01-15
/dd-standup-preview Product Team
```

### Story 6: Admin Triggers Followup Reminders
**As a** team admin
**I want to** send followup reminders to members who haven't submitted standup
**So that** I can ensure maximum participation as the deadline approaches

**Acceptance Criteria:**
- Admin can use `/dd-standup-followup` command in their team's channel
- System identifies members who haven't submitted standup for today
- System sends DM reminders only to non-responding members
- System respects leave status and work days
- Admin receives confirmation with count of followup reminders sent

**Example Usage:**
```
/dd-standup-followup
```
**Response:**
```
✅ Sent followup reminders to 3 team members
```

## Permission Matrix

| Command | Admin (Own Team) | Owner (Any Team) | Regular Member |
|---------|------------------|------------------|----------------|
| `/dd-standup-remind` | ✅ | ✅ (with team name) | ❌ |
| `/dd-standup-post` | ✅ | ✅ (with team name) | ❌ |
| `/dd-standup-preview` | ✅ | ✅ (with team name) | ❌ |
| `/dd-standup-followup` | ✅ | ✅ (with team name) | ❌ |

## Technical Considerations

### Command Structure
```
/dd-standup-remind [team-name]       # Team name required for owners, optional for admins in team channel
/dd-standup-post [date] [team-name]  # Date optional (YYYY-MM-DD), team name for owners
/dd-standup-preview [date] [team-name]
/dd-standup-followup [team-name]
```

### Permission Checks
1. Verify user is authenticated (exists in User table)
2. Check if user is organization owner (User.organizationId matches team's organizationId)
3. If not owner, check if user is admin of the team (TeamMember.role === 'ADMIN')
4. For channel-based commands, verify team is associated with the channel

### Error Scenarios
- User lacks permissions → Show error message
- Team not found → Show error with team name
- Channel not associated with team → Guide user to provide team name
- No responses for date → Inform user no data available
- API failures → Show troubleshooting guidance

### Integration with Existing Scripts
Reuse logic from:
- `scripts/sendManualStandup.js` → Post and preview functionality
- `scripts/triggerStandup.js` → Reminder functionality
- `src/services/schedulerService.js` → Reminder and followup logic
- `src/services/standupService.js` → Formatting and posting logic

## Success Metrics
- Admins can trigger operations without technical knowledge
- Reduced dependency on manual script execution
- Improved standup participation through timely reminders
- Better visibility of standup data through preview feature

## Future Enhancements
- Bulk operations for owners (remind all teams, post all teams)
- Scheduled manual posts (post at specific time)
- Analytics on manual trigger usage
- Webhook notifications for manual triggers
- Integration with troubleshooting command for channel access issues

---

**Status**: Draft
**Created**: 2025-01-09
**Author**: Generated with Claude Code
