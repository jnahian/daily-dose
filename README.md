<p align="center">
  <img src="public/logo.png" alt="Daily Dose Logo" width="128" height="128">
</p>

<h1 align="center">Daily Dose Slack Bot - User Guide</h1>

<p align="center">
Daily Dose is a Slack bot that automates daily standup meetings for teams. It sends reminders, collects responses, and posts formatted standup summaries to team channels.
</p>

<p align="center">
  <a href="https://youtu.be/bQrJqBpSlBU">
    <img src="https://img.youtube.com/vi/bQrJqBpSlBU/maxresdefault.jpg" alt="Daily Dose demo video" width="720">
  </a>
</p>

## ✨ Features

- **Automated Standup Reminders**: Sends DM reminders at configured times
- **Team Management**: Create and join teams with custom schedules
- **Leave Management**: Set vacation/leave dates to skip standup reminders
- **Work Day Configuration**: Customize your working days
- **Multi-Organization Support**: Supports multiple organizations within the bot's workspace; each org gets an auto-created `#daily-dose-bot` channel and members are auto-added when they join a team
- **Timezone Support**: Each team can have its own timezone
- **Late Submission Tracking**: Tracks and handles late standup submissions

## 🌐 Web Landing Page

Daily Dose now includes a professional landing page accessible at the base URL of your deployment. The landing page provides:

### Features

- **Professional Design**: Clean, responsive interface showcasing the bot's capabilities
- **Feature Showcase**: Detailed overview of automation features and benefits
- **How It Works**: Step-by-step guide explaining the standup automation process
- **Contact Section**: Easy way for teams to request installation and setup
- **SEO Optimized**: Proper meta tags and social media integration for discovery
- **Mobile Responsive**: Optimized for all device types and screen sizes

### Technical Implementation

- **Static File Serving**: All assets served from `/public` directory via Express
- **Tailwind CSS**: Modern utility-first CSS framework for styling
- **Interactive JavaScript**: Smooth scrolling, mobile menu, and animations
- **Accessibility**: ARIA labels and semantic HTML for screen readers

### Accessing the Landing Page

- **Local Development**: http://localhost:3000/
- **Production**: Available at your deployment's base URL
- **Assets**: Logo, CSS, and JavaScript files served from `/public` directory

## 📚 Scripts Documentation

Daily Dose includes a comprehensive administrative scripts documentation interface accessible at `/scripts-docs`. This protected route provides detailed documentation for all administrative scripts in the project.

### Features

- **Complete Script Coverage**: Documentation for all 8 administrative scripts including:
  - `seedOrg.js` - Organization seeding
  - `check-team-members.js` - Team member verification
  - `promoteTeamMember.js` - Team member promotion
  - `triggerStandup.js` - Manual standup triggering
  - `sendManualStandup.js` - Manual standup posting
  - `debugScheduler.js` - Scheduler debugging
  - `viewSlackTeamInfo.js` - Slack team information
  - `updateSlackManifest.js` - Slack manifest management
- **Usage Examples**: Detailed command syntax and examples for each script
- **Parameter Documentation**: Complete parameter descriptions and requirements
- **Security Information**: Database access and permission requirements
- **Professional Interface**: Clean, responsive design matching the landing page

### Accessing Scripts Documentation

- **URL**: `/scripts-docs` (relative to your deployment base URL)
- **Local Development**: http://localhost:3000/scripts-docs
- **Production**: Available at your deployment's base URL + `/scripts-docs`
- **Authentication**: Protected with HTTP Basic Auth
  - **Credentials**: Set via the `SCRIPTS_AUTH_USERNAME` and `SCRIPTS_AUTH_PASSWORD` environment variables (see configuration section)
  - **No defaults**: both variables are required — the app refuses to start until they are set

### Authentication Configuration

The scripts documentation route is protected with configurable HTTP Basic Authentication:

```bash
# Environment Variables for Scripts Documentation Auth (both required — no defaults)
SCRIPTS_AUTH_USERNAME=your-username
SCRIPTS_AUTH_PASSWORD=your-strong-password
```

**Security Recommendations:**

- Both variables are required — there are no default credentials, and the app will not start until they are set
- Use strong, unique passwords for the documentation interface
- Restrict access to authorized administrators only
- Consider additional network-level security for production deployments

The landing page serves as both a marketing tool and user onboarding resource, helping new teams understand the bot's value before installation.

## 🚀 Quick Start

### 0. Explore the Web Interface (Optional)

Before setting up your teams, you can explore the Daily Dose landing page to learn more about features and benefits:

- **Local Development**: Visit http://localhost:3000/
- **Production**: Access your deployment's base URL
- **Features Overview**: Learn about automation capabilities
- **Setup Guide**: Understand the standup process

### 1. Join Your Organization

When you first interact with the bot, you'll be automatically added to your organization based on your Slack workspace.

### 2. Join or Create a Team

```
/dd-team-list                         # See available teams with timing info
/dd-team-join                         # Join team in current channel
/dd-team-join Engineering             # Join specific team by name
/dd-team-leave                        # Leave team in current channel
/dd-team-leave Engineering            # Leave specific team by name
/dd-team-members                      # View members of team in current channel
/dd-team-members Engineering          # View members of specific team
/dd-team-create 09:30 10:00           # Create new team (uses channel name) — members' teams need admin approval
/dd-team-create MyTeam 09:30 10:00    # Create new team with custom name — members' teams need admin approval
/dd-team-update standup=09:00         # Update team in current channel ⚠️ (admin only)
/dd-team-update Engineering standup=09:00  # Update specific team ⚠️ (admin only)
/dd-team-suspend @user                # Suspend member from team in current channel ⚠️ (admin only)
/dd-team-suspend @user Engineering    # Suspend member from a specific team ⚠️ (admin only)
/dd-team-unsuspend @user [TeamName]   # Reactivate a suspended team member ⚠️ (admin only)
/dd-org-suspend @user                 # Suspend member from entire organization ⚠️ (org owner/admin)
/dd-org-unsuspend @user               # Reactivate suspended org member ⚠️ (org owner/admin)
/dd-org-promote @user                 # Promote to organization admin ⚠️ (org owner/admin)
/dd-org-promote @user Engineering     # Promote to team admin in a specific team ⚠️ (org owner/admin)
```

### 3. Submit Your Daily Standup

The bot will send you a DM reminder at your team's configured time. Click the "Submit Standup" button or use:

```
/dd-standup                     # Manual standup submission for team in current channel
/dd-standup MyTeam              # Manual standup submission for specific team
/dd-standup-update              # Update today's standup for team in current channel
/dd-standup-update MyTeam       # Update today's standup for specific team
/dd-standup-update 2024-12-20   # Update standup for specific date (team in current channel)
/dd-standup-update MyTeam 2024-12-20  # Update standup for specific date and team
/dd-standup-history             # View your submissions from your last submitted day
/dd-standup-history 2024-12-20  # View your submissions for a specific date
/dd-standup-history 2024-12-15 2024-12-20  # View your submissions across a date range
```

## ⚡ Slash Commands

### 📝 Standup Submission

- `/dd-standup [team-name]` - Submit standup manually outside scheduled time
  - **Channel-based**: `/dd-standup` (submits for team in current channel)
  - **Name-based**: `/dd-standup Engineering` (submits for specific team from any channel)
- `/dd-standup-update [team-name|YYYY-MM-DD] [YYYY-MM-DD]` - Update standup for any day (defaults to today)
  - **Channel-based**: `/dd-standup-update` (updates today's standup for team in current channel)
  - **Channel-based with date**: `/dd-standup-update 2024-12-20` (updates specific date for team in current channel)
  - **Name-based**: `/dd-standup-update Engineering` (updates today's standup for specific team)
  - **Name-based with date**: `/dd-standup-update Engineering 2024-12-20` (updates specific date for specific team)
- `/dd-standup-history [start-date] [end-date]` - View your own submitted standups across all your teams (ephemeral)
  - **No arguments**: shows your submissions from your last submitted day
  - **Single date**: `/dd-standup-history 2024-12-20` (shows your submissions for that date)
  - **Date range**: `/dd-standup-history 2024-12-15 2024-12-20` (inclusive range, order-independent)
  - Dates must be in `YYYY-MM-DD` format
- `/dd-standup-reminder [team-name] mention=on/off notify=on/off` - Control reminder and mention preferences
  - **Channel-based operation** (when no team name provided):
    - `/dd-standup-reminder mention=off` - Opt out of "not responded" list for team in current channel
    - `/dd-standup-reminder notify=off` - Disable ALL notifications (reminders + admin submission alerts) for team in current channel
    - `/dd-standup-reminder mention=on notify=on` - Enable both preferences for team in current channel
  - **Cross-channel operation** (when team name provided):
    - `/dd-standup-reminder Engineering mention=off` - Opt out from specific team "not responded" list
    - `/dd-standup-reminder Engineering notify=off` - Disable ALL notifications for specific team
    - `/dd-standup-reminder Engineering mention=on notify=on` - Enable both preferences for specific team
  - **Parameters**: At least one parameter required
    - `mention=on/off` - Controls visibility in "not responded" list
    - `notify=on/off` - Controls ALL notifications: standup reminders AND admin notifications about team member submissions (if you're an admin)
- The bot also sends automatic DM reminders with interactive buttons

### 🔧 Manual Standup Trigger Commands ⚠️ (Admin/Owner Only)

These commands allow team admins and organization owners to manually trigger standup operations that are normally automated by the scheduler.

**Permission Requirements:**

- **Team Admins**: Can use commands in their team's channel without specifying team name
- **Organization Admins**: Can run admin commands in any team's channel without specifying a team name (channel-based resolution, like team admins), for any team in the organization — or specify a team name explicitly to act from any channel
- **Organization Owners**: Can use commands from any channel but must specify team name

#### Command Overview

- `/dd-standup-remind [team-name]` - Send standup reminders to team members ⚠️ **(admin/owner only)**
- `/dd-standup-post [YYYY-MM-DD] [team-name] [@user]` - Post standup summary to channel, or append a single member's standup as a threaded reply when you @mention them ⚠️ **(admin/owner only)**
- `/dd-standup-preview [YYYY-MM-DD] [team-name] [@user]` - Preview the team summary, or a single member's standup when you @mention them (ephemeral) ⚠️ **(admin/owner only)**
- `/dd-standup-followup [team-name]` - Send followup reminders to non-responders ⚠️ **(admin/owner only)**

#### Context-Aware Behavior

**For Team Admins (in team channel):**

```bash
# Send reminders to all team members (uses current channel's team)
/dd-standup-remind

# Post today's standup summary (uses current channel's team)
/dd-standup-post

# Post standup summary for specific date (uses current channel's team)
/dd-standup-post 2024-12-20

# Preview today's standup (uses current channel's team)
/dd-standup-preview

# Preview standup for specific date (uses current channel's team)
/dd-standup-preview 2024-12-20

# Send followup reminders to members who haven't responded (uses current channel's team)
/dd-standup-followup
```

**For Organization Owners (from any channel):**

```bash
# Send reminders to Engineering team members
/dd-standup-remind Engineering

# Post today's standup summary for Marketing team
/dd-standup-post Marketing

# Post standup summary for specific date for DevOps team
/dd-standup-post 2024-12-20 DevOps

# Preview today's standup for QA team
/dd-standup-preview QA

# Preview standup for specific date for Engineering team
/dd-standup-preview 2024-12-20 Engineering

# Send followup reminders to Engineering team non-responders
/dd-standup-followup Engineering
```

#### Detailed Command Documentation

**Standup Remind** - `/dd-standup-remind [team-name]`

- **Purpose**: Manually send standup reminders to all eligible team members
- **Who receives reminders**: Active team members who are not on leave, not on holidays, and have notifications enabled
- **Context-aware**:
  - Admins in team channel: `/dd-standup-remind`
  - Owners from anywhere: `/dd-standup-remind Engineering`
- **Use cases**:
  - Send early reminders before the scheduled time
  - Send additional reminders if team members forgot
  - Test reminder functionality for new teams

**Standup Post** - `/dd-standup-post [YYYY-MM-DD] [team-name] [@user]`

- **Purpose**: Manually post standup summary to the team channel, or append a single member's standup as a threaded reply
- **Date format**: YYYY-MM-DD (e.g., 2024-12-20)
- **Default**: Posts today's standup if no date specified
- **Individual post**: When an @mention is provided, appends that member's standup response as a threaded reply under the day's team standup post (broadcast to channel). If no team standup thread exists yet for that date, the team summary is auto-posted first to create the thread.
- **Context-aware**:
  - Admins in team channel: `/dd-standup-post` or `/dd-standup-post 2024-12-20`
  - Owners from anywhere: `/dd-standup-post Engineering` or `/dd-standup-post 2024-12-20 Engineering`
- **Use cases**:
  - Post summary early before scheduled posting time
  - Re-post summary if original was deleted
  - Post past standup summaries that were missed
  - Share a single team member's standup into the thread on demand

**Standup Preview** - `/dd-standup-preview [YYYY-MM-DD] [team-name] [@user]`

- **Purpose**: Preview standup summary before posting to channel (ephemeral message)
- **Date format**: YYYY-MM-DD (e.g., 2024-12-20)
- **Default**: Previews today's standup if no date specified
- **Visibility**: Only visible to you (ephemeral)
- **Individual preview**: When an @mention is provided, previews only that member's standup response instead of the full team summary (still ephemeral).
- **Context-aware**:
  - Admins in team channel: `/dd-standup-preview` or `/dd-standup-preview 2024-12-20`
  - Owners from anywhere: `/dd-standup-preview Engineering` or `/dd-standup-preview 2024-12-20 Engineering`
- **Use cases**:
  - Check what the summary looks like before posting
  - Verify all expected submissions are included
  - Review standup data without posting to channel
  - Inspect a specific team member's standup privately

**Standup Followup** - `/dd-standup-followup [team-name]`

- **Purpose**: Send followup reminders to team members who haven't submitted today's standup
- **Who receives**: Active team members who haven't submitted and have notifications enabled
- **Context-aware**:
  - Admins in team channel: `/dd-standup-followup`
  - Owners from anywhere: `/dd-standup-followup Engineering`
- **Use cases**:
  - Gentle reminder for team members who missed the initial reminder
  - Follow up before posting time if participation is low
  - Encourage last-minute submissions

#### Permission Errors

```bash
# Error: Not an admin or owner
/dd-standup-remind
# Response: "❌ You must be a team admin or organization owner to trigger standup reminders"

# Error: Admin trying to use command outside team channel without team name
/dd-standup-remind
# Response: "❌ No team found in this channel. As an admin, please run this command from your team's channel, or provide the team name if you're an owner"

# Error: Team doesn't exist
/dd-standup-remind NonexistentTeam
# Response: "❌ Team 'NonexistentTeam' not found"

# Error: Invalid date format
/dd-standup-post 12-20-2024 Engineering
# Response: "❌ Invalid date format. Use YYYY-MM-DD (e.g., 2024-12-20)"
```

#### Example Workflows

**Scenario 1: Admin sending early reminder**

```bash
# Admin in #engineering channel wants to send reminder at 9:00 instead of scheduled 9:30
/dd-standup-remind
# Response: "✅ Standup reminders sent to 5 team members for Engineering team"
```

**Scenario 2: Owner posting multiple team summaries**

```bash
# Owner from #general channel posts summaries for multiple teams
/dd-standup-post Engineering
/dd-standup-post Marketing
/dd-standup-post DevOps
# Each team's summary posted to their respective channels
```

**Scenario 3: Preview before posting**

```bash
# Admin wants to check standup participation before posting
/dd-standup-preview
# Reviews the preview (only visible to admin)
# If satisfied, posts the summary
/dd-standup-post
# Response: "✅ Standup summary posted to #engineering"
```

**Scenario 4: Following up on low participation**

```bash
# Admin checks preview at 9:45 (posting time is 10:00)
/dd-standup-preview
# Sees only 2 out of 8 members responded
# Sends followup reminder
/dd-standup-followup
# Response: "✅ Followup reminders sent to 6 team members who haven't submitted"
# Waits a few minutes and checks again
/dd-standup-preview
# Now 6 out of 8 members responded, posts summary
/dd-standup-post
```

**Scenario 5: Posting historical standup**

```bash
# Owner realizes yesterday's standup wasn't posted
/dd-standup-preview 2024-12-19 Engineering
# Reviews yesterday's submissions
/dd-standup-post 2024-12-19 Engineering
# Response: "✅ Standup summary posted to #engineering for 2024-12-19"
```

### 👥 Team Management

- `/dd-team-list` - List all teams in your organization with detailed timing information
  - Shows team name and member count
  - 🔔 Reminder time (when standup reminders are sent)
  - 📊 Posting time (when standup summaries are posted)
  - 🌍 Timezone for each team
- `/dd-team-join [team-name]` - Join a team
  - **Channel-based**: `/dd-team-join` (joins the team in current channel)
  - **Name-based**: `/dd-team-join Engineering` (joins specific team by name from any channel)
- `/dd-team-leave [team-name]` - Leave a team
  - **Channel-based**: `/dd-team-leave` (leaves the team in current channel)
  - **Name-based**: `/dd-team-leave Engineering` (leaves specific team by name from any channel)
- `/dd-team-members [team-name]` - View team members
  - **Channel-based**: `/dd-team-members` (shows members of team in current channel)
  - **Name-based**: `/dd-team-members Engineering` (shows members of specific team from any channel)
- `/dd-team-create [team-name] <standup-time> <posting-time>` - Create a new team
  - **Channel-based**: `/dd-team-create 09:30 10:00` (uses channel name as team name)
  - **Custom name**: `/dd-team-create Engineering 09:30 10:00` (creates team with custom name)
  - **Anyone in the workspace can create a team.** If you're not yet in the organization, you're added automatically as a member.
  - Teams created by **org owners/admins** go live immediately. Teams created by **regular members** stay **pending** until an org admin approves them — admins receive an Approve/Reject prompt by DM, and you're notified of their decision.
- `/dd-team-update [team-name] [parameters]` - Update team settings ⚠️ **(admin only)**
  - **Channel-based**: `/dd-team-update standup=09:00 posting=10:30` (updates team in current channel)
  - **Name-based**: `/dd-team-update Engineering standup=09:00 posting=10:30 notifications=false` (updates specific team from any channel)
  - **Parameters**: `name=NewName`, `standup=HH:MM`, `posting=HH:MM`, `notifications=true/false`
  - The `notifications` parameter controls whether team admins receive standup submission notifications (default: true)
- `/dd-team-suspend @user [team-name]` - Suspend a member from a team ⚠️ **(team admin or org owner/admin)**
  - **Channel-based**: `/dd-team-suspend @john` (suspends from team in current channel)
  - **Name-based**: `/dd-team-suspend @john Engineering` (suspends from a specific team)
  - Suspended members stop receiving reminders, are excluded from standup posts, and cannot submit standups for that team
- `/dd-team-unsuspend @user [team-name]` - Reactivate a suspended team member ⚠️ **(team admin or org owner/admin)**
- `/dd-org-suspend @user` - Suspend a member across the entire organization ⚠️ **(org owner/admin only)**
  - Cascades the suspension to every team in the organization
  - Blocked if the user is the only active admin of any team in the org
- `/dd-org-unsuspend @user` - Reactivate a suspended organization member ⚠️ **(org owner/admin only)**
  - Restores org membership only; use `/dd-team-unsuspend` to re-add the user to specific teams
- `/dd-org-promote @user [team-name]` - Promote a user to admin role ⚠️ **(org owner/admin only)**
  - **Org scope**: `/dd-org-promote @john` (promotes to organization admin)
  - **Team scope**: `/dd-org-promote @john Engineering` (promotes to team admin in a specific team)
  - Target must already be an active member of the relevant scope
  - Cannot promote yourself or an existing admin/owner

### 🌴 Leave Management

**Personal Leave Management (All Users)**

- `/dd-leave-list` - View your upcoming leaves
- `/dd-leave-set <start-date> [end-date] [reason]` - Set leave dates
  - Single day: `/dd-leave-set 2024-12-25 Holiday`
  - Date range: `/dd-leave-set 2024-12-25 2024-12-26 Holiday break`
- `/dd-leave-cancel <leave-id>` - Cancel a leave (use ID from list command)

**Admin Leave Management ⚠️ (Admin Only)**

- `/dd-leave-set-member @user [team-name] <start-date> [end-date] [reason]` - Set leave for team member ⚠️ **(admin only)**
  - **With team name**: `/dd-leave-set-member @john Engineering 2024-12-25 Holiday`
  - **Single team admin**: `/dd-leave-set-member @john 2024-12-25 Holiday` (auto-detects team)
  - **Date range**: `/dd-leave-set-member @john Engineering 2024-12-25 2024-12-26 Holiday break`
  - **Note**: If admin is in multiple teams, team name is required
- `/dd-leave-cancel-member @user <leave-id> [team-name]` - Cancel team member's leave ⚠️ **(admin only)**
  - **With team name**: `/dd-leave-cancel-member @john abc123 Engineering`
  - **Single team admin**: `/dd-leave-cancel-member @john abc123` (auto-detects team)
  - **Note**: If admin is in multiple teams, team name is required
- `/dd-leave-list-member @user [team-name]` - List team member's leaves ⚠️ **(admin only)**
  - **With team name**: `/dd-leave-list-member @john Engineering`
  - **Single team admin**: `/dd-leave-list-member @john` (auto-detects team)
  - **Note**: If admin is in multiple teams, team name is required

### 📅 Work Days Configuration

- `/dd-workdays-show` - View your current work days
- `/dd-workdays-set <days>` - Set your working days
  - Example: `/dd-workdays-set 1,2,3,4,5` (Monday-Friday)
  - Numbers: 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday, 7=Sunday

### 🎉 Holiday Management

**Viewing Holidays (All Users)**

- `/dd-holiday-list` - List all upcoming holidays
- `/dd-holiday-list <year>` - List holidays for specific year (e.g., 2024)
- `/dd-holiday-list <year-month>` - List holidays for specific month (e.g., 2024-12)
- `/dd-holiday-list <start-date> <end-date>` - List holidays in date range

**Managing Holidays ⚠️ (Admin Only)**

- `/dd-holiday-set <start-date> [end-date] [name]` - Set holidays for single day or date range ⚠️ **(admin only)**
  - Single day: `/dd-holiday-set 2024-12-25 Christmas Day`
  - Date range: `/dd-holiday-set 2024-12-24 2024-12-26 Christmas Holiday`
- `/dd-holiday-update <date> <new-name>` - Update existing holiday name ⚠️ **(admin only)**
  - Example: `/dd-holiday-update 2024-12-25 Christmas Day Updated`
- `/dd-holiday-delete <start-date> [end-date]` - Delete holidays for single day or date range ⚠️ **(admin only)**
  - Single day: `/dd-holiday-delete 2024-12-25`
  - Date range: `/dd-holiday-delete 2024-12-24 2024-12-26`

## 🔄 How It Works

### Daily Flow

1. **Morning Reminder**: Bot sends DM at your team's standup time
2. **Submission Window**: You have until the posting time to submit
3. **Team Summary**: Bot posts formatted summary to team channel
4. **Late Submissions**: Added as thread replies if submitted after posting time

### Standup Format

Each standup includes:

- **Last Working Day's Tasks**: What you worked on your last working day
- **Today's Tasks**: What you plan to work on today
- **Blockers**: Any obstacles or help needed

### Team Summary

The bot posts a formatted summary showing:

- All submitted standups with responses
- List of team members who haven't submitted
- Members on leave (automatically excluded)
- Members who opted out of non-responded list (can still submit but won't be listed as not responded)

## 👥 Team Setup (Admin Guide)

### Creating a Team

1. Use `/dd-team-create [team-name] <standup-time> <posting-time>` in the channel where you want standups posted
   - **Channel-based**: `/dd-team-create 09:30 10:00` (uses channel name as team name)
   - **Custom name**: `/dd-team-create Engineering 09:30 10:00` (creates team with custom name)
2. Set appropriate times:
   - **Standup Time**: When reminders are sent (e.g., 09:30)
   - **Posting Time**: When summary is posted (e.g., 10:00)
3. Team members can join using:
   - **Channel-based**: `/dd-team-join` (joins team in current channel)
   - **Name-based**: `/dd-team-join Engineering` (joins specific team from any channel)

> **Who can create a team?** Anyone in the workspace. A non-member who creates a team is automatically added to the organization. Teams created by org owners/admins are active right away; teams created by regular members are submitted for approval and become active once an org admin clicks **Approve** on the DM they receive (they can also **Reject**, which discards the request). The creator becomes the team admin once approved.

### Time Configuration

- Times are in 24-hour format (HH:MM)
- Each team can have its own timezone
- Default timezone is America/New_York

### Admin Notification Settings

Team admins can control whether they receive notifications when team members submit their standups:

```bash
# Disable standup submission notifications for admins
/dd-team-update Engineering notifications=false

# Re-enable notifications (default behavior)
/dd-team-update Engineering notifications=true
```

**Notification Behavior:**

- **Enabled (default)**: Team admins receive a DM notification each time a team member submits their standup
- **Disabled**: Admins will not receive these submission notifications, reducing notification volume for large teams
- This setting only affects admin notifications, not team member reminders or team summary posting

### Example Team Setup

```bash
# Create a team that sends reminders at 9:30 AM and posts summary at 10:00 AM
# Channel-based (uses channel name as team name)
/dd-team-create 09:30 10:00

# Or with custom team name
/dd-team-create Engineering 09:30 10:00

# Team members join (multiple ways)
/dd-team-join              # Join the team in current channel
/dd-team-join Engineering  # Join specific team by name from any channel

# Update team settings (multiple ways)
/dd-team-update notifications=false           # Update team in current channel
/dd-team-update Engineering notifications=false  # Update specific team by name
```

## 📝 Standup Updates

You can update your standup for any day using the update command:

```bash
# Update today's standup for team in current channel
/dd-standup-update

# Update today's standup for specific team
/dd-standup-update Engineering

# Update standup for specific date (team in current channel)
/dd-standup-update 2024-12-20

# Update standup for specific date and team
/dd-standup-update Engineering 2024-12-20
```

### Update Behavior

- **Pre-filled Form**: If you already submitted a standup for that date, the form opens with your existing data
- **New Submission**: If no standup exists for that date, it opens a fresh form
- **Thread Updates**: When updating today's standup after the posting time, your update will automatically be posted to the team channel thread
- **Historical Updates**: You can update standups for past or future dates without thread posting

## 🔕 Standup Reminder Preferences

You can control both your visibility in the "Not Responded" section of team standup summaries and whether you receive reminder notifications.

### Channel-Based Operation

When used without a team name, the command operates on the team associated with the current Slack channel:

```bash
# Opt out from appearing in "Not Responded" list for current channel team
/dd-standup-reminder mention=off

# Disable ALL notifications (reminders + admin submission alerts) for current channel team
/dd-standup-reminder notify=off

# Configure both preferences for current channel team
/dd-standup-reminder mention=on notify=on
```

### Cross-Channel Operation

When a team name is provided, the command works from any channel:

```bash
# Opt out from appearing in "Not Responded" list for specific team
/dd-standup-reminder Engineering mention=off

# Disable ALL notifications for specific team
/dd-standup-reminder Engineering notify=off

# Configure both preferences for specific team
/dd-standup-reminder Engineering mention=on notify=on
```

### Parameter Requirements

The command requires at least one of the following parameters:

- **mention=on/off**: Controls whether you appear in the "Not Responded" list when you haven't submitted
- **notify=on/off**: Controls whether you receive ALL notifications:
  - Standup reminder DMs (for regular members)
  - Admin notifications when team members submit standups (for team admins)
- You can use one or both parameters in a single command
- Parameters can be combined: `/dd-standup-reminder mention=off notify=on`

### How It Works

- **Mention Setting** (`mention=on/off`):
  - **mention=on (Default)**: You appear in the "Not Responded" list if you don't submit a standup
  - **mention=off**: You won't appear in the "Not Responded" list, but can still submit standups normally
- **Notify Setting** (`notify=on/off`):
  - **notify=on (Default)**: You receive:
    - DM reminders at the team's standup time (for regular members)
    - Admin notifications when team members submit standups (for team admins)
  - **notify=off**: You won't receive:
    - DM standup reminders (you can still submit standups manually)
    - Admin notifications about team member submissions (for team admins)
- **Independent Controls**: Both settings work independently - you can disable mentions but keep notifications, or vice versa
- **Per-Team Setting**: These preferences are set individually for each team you're part of
- **Team Membership Required**: You must be a member of the team to modify your preferences
- **Real-time Updates**: Changes take effect immediately for future standup summaries and reminders

**💡 For Team Admins:** If you want to stop receiving notifications every time a team member submits their standup, use `/dd-standup-reminder notify=off`. This is especially useful for large teams with high submission volumes.

### Use Cases

This feature is useful for:

- **Team admins** who want to reduce notification noise from team member submissions (use `notify=off`)
- **Part-time team members** who don't submit daily but contribute occasionally
- **Consultants or contractors** with irregular schedules
- **Team leads or managers** who participate optionally in standups
- **Cross-functional members** who only contribute when relevant
- **Team members with varying availability** who want to reduce notification pressure
- **Members transitioning between teams** who need flexible participation levels
- **Admins of large teams** who receive too many submission notifications throughout the day

### Common Error Scenarios

```bash
# Error: No team in current channel
/dd-standup-reminder mention=off
# Response: "❌ No team found in this channel. Please provide team name: /dd-standup-reminder TeamName mention=on/off notify=on/off"

# Error: Team doesn't exist
/dd-standup-reminder NonexistentTeam mention=off
# Response: "❌ Team 'NonexistentTeam' not found"

# Error: Not a team member
/dd-standup-reminder Engineering mention=off
# Response: "❌ You are not a member of team 'Engineering'"

# Error: No parameters provided
/dd-standup-reminder Engineering
# Response: "❌ You must specify at least one parameter: mention=on/off or notify=on/off"

# Error: Invalid parameter format
/dd-standup-reminder Engineering maybe=off
# Response: "❌ Invalid parameter 'maybe=off'. Use mention=on/off or notify=on/off"
```

### Example Workflows

**Scenario 1: Team admin wants to stop submission notifications**

```bash
# You're a team admin receiving too many notifications about member submissions
/dd-standup-reminder notify=off              # Disable ALL notifications (reminders + submissions)
# Now you won't receive notifications when team members submit standups
# You can still manually check standup summaries in the team channel
```

**Scenario 2: Working from team channel**

```bash
# You're in the #engineering channel where the Engineering team is configured
/dd-standup-reminder mention=off            # Opt out of "not responded" list for Engineering team
/dd-standup-reminder notify=off             # Disable ALL notifications for Engineering team
/dd-standup-reminder mention=on notify=on   # Re-enable both preferences for Engineering team
```

**Scenario 3: Working from different channel**

```bash
# You're in #general but want to manage Marketing team preferences
/dd-standup-reminder Marketing mention=off  # Opt out of Marketing team "not responded" list
/dd-standup-reminder Marketing notify=off   # Disable ALL notifications for Marketing team
```

**Scenario 4: Managing multiple teams with different needs**

```bash
# Modify preferences for different teams
/dd-standup-reminder Marketing mention=off          # Opt out of Marketing mentions but keep notifications
/dd-standup-reminder DevOps notify=off              # Disable DevOps notifications but stay in mention list
/dd-standup-reminder QA mention=off notify=off      # Completely opt out of QA team reminders and mentions
```

**Scenario 5: Part-time team member setup**

```bash
# Configure for part-time participation - no reminders but can submit when needed
/dd-standup-reminder Engineering mention=off notify=off  # Remove from mentions and disable reminders
# You can still manually submit with /dd-standup Engineering when participating
```

## 🎉 Holiday Management ⚠️ (Admin Only)

Admins can manage organization-wide holidays that affect standup schedules:

### Setting Holidays ⚠️ (Admin Only)

```bash
# Single day holiday
/dd-holiday-set 2024-12-25 Christmas Day

# Multi-day holiday range
/dd-holiday-set 2024-12-24 2024-12-26 Christmas Holiday

# Holiday without custom name (will use default)
/dd-holiday-set 2024-07-04
```

### Managing Holidays ⚠️ (Admin Only)

```bash
# Update holiday name
/dd-holiday-update 2024-12-25 Christmas Day Updated

# Delete single day holiday
/dd-holiday-delete 2024-12-25

# Delete holiday range
/dd-holiday-delete 2024-12-24 2024-12-26
```

### Holiday Effects

When holidays are set:

- No standup reminders are sent on holiday dates
- Team members are automatically excluded from standup expectations
- Holiday status is reflected in team summaries

## 🌴 Leave Management

### Setting Leave

```bash
# Single day
/dd-leave-set 2024-12-25 Christmas Day

# Multiple days
/dd-leave-set 2024-12-23 2024-12-27 Holiday break
```

### Managing Leaves

```bash
# View upcoming leaves
/dd-leave-list

# Cancel a leave (use ID from list)
/dd-leave-cancel abc12345
```

When you're on leave:

- No standup reminders are sent
- You're marked as "On leave" in team summaries
- Automatic exclusion from standup expectations

### Admin Leave Management ⚠️ (Admin Only)

Team admins can manage leave for any member in their teams. This is useful for:

- **Emergency situations** when team members are suddenly unavailable
- **Planned absences** where the admin wants to set up leaves in advance
- **Bulk leave management** for team events or company-wide holidays
- **Vacation coordination** to ensure proper coverage

#### Setting Member Leave ⚠️ (Admin Only)

```bash
# Single day leave (admin in only one team)
/dd-leave-set-member @john 2024-12-25 Holiday

# Single day leave with team name
/dd-leave-set-member @john Engineering 2024-12-25 Holiday

# Date range with team name
/dd-leave-set-member @john Engineering 2024-12-25 2024-12-26 Holiday break

# Multiple team members (requires multiple commands)
/dd-leave-set-member @john Engineering 2024-12-25 Team event
/dd-leave-set-member @jane Engineering 2024-12-25 Team event
```

#### Canceling Member Leave ⚠️ (Admin Only)

```bash
# Cancel leave (admin in only one team)
/dd-leave-cancel-member @john abc123

# Cancel leave with team name
/dd-leave-cancel-member @john abc123 Engineering

# Note: Leave ID can be obtained from list command
```

#### Viewing Member Leaves ⚠️ (Admin Only)

```bash
# View member leaves (admin in only one team)
/dd-leave-list-member @john

# View member leaves with team name
/dd-leave-list-member @john Engineering

# Use this to get leave IDs for cancellation
```

#### Admin Requirements

- **ADMIN role required**: Only team admins can use these commands
- **Team membership**: Mentioned user must be a member of the specified team
- **Team specification**: If admin is in multiple teams, team name is required
- **User mentions**: Commands support @mentions for easy user selection

#### Common Error Scenarios

```bash
# Error: Not an admin
/dd-leave-set-member @john 2024-12-25 Holiday
# Response: "❌ You must be an admin to manage member leaves"

# Error: Admin in multiple teams without team name
/dd-leave-set-member @john 2024-12-25 Holiday
# Response: "❌ You are an admin in multiple teams. Please specify team name: /dd-leave-set-member @user [team-name] ..."

# Error: User not in team
/dd-leave-set-member @external Engineering 2024-12-25 Holiday
# Response: "❌ User is not a member of team 'Engineering'"

# Error: Team doesn't exist
/dd-leave-set-member @john NonexistentTeam 2024-12-25 Holiday
# Response: "❌ Team 'NonexistentTeam' not found"
```

#### Example Workflows

**Scenario 1: Emergency leave setup**

```bash
# Team member calls in sick, admin sets leave immediately
/dd-leave-set-member @john Engineering 2024-11-02 Sick leave
# Response: "✅ Leave set for @john from 2024-11-02 to 2024-11-02"
```

**Scenario 2: Planned vacation coordination**

```bash
# View member's existing leaves first
/dd-leave-list-member @jane Engineering

# Set new vacation period
/dd-leave-set-member @jane Engineering 2024-12-20 2024-12-31 Year-end vacation
# Response: "✅ Leave set for @jane from 2024-12-20 to 2024-12-31"
```

**Scenario 3: Cancel incorrect leave**

```bash
# View leaves to get ID
/dd-leave-list-member @john Engineering
# Shows: ID: abc123, Dates: 2024-12-25 to 2024-12-26

# Cancel the leave
/dd-leave-cancel-member @john abc123 Engineering
# Response: "✅ Leave cancelled successfully for @john"
```

**Scenario 4: Team-wide event**

```bash
# Set leave for all team members attending offsite
/dd-leave-set-member @john Engineering 2024-11-15 Team offsite
/dd-leave-set-member @jane Engineering 2024-11-15 Team offsite
/dd-leave-set-member @mike Engineering 2024-11-15 Team offsite
# Each member automatically excluded from standup on that day
```

## 📅 Work Days Configuration

### Default Work Days

- Organization default is typically Monday-Friday (1,2,3,4,5)
- You can set personal work days that override the default

### Setting Personal Work Days

```bash
# Standard Monday-Friday
/dd-workdays-set 1,2,3,4,5

# Monday-Thursday + Sunday (4-day week with Sunday)
/dd-workdays-set 1,2,3,4,7

# Tuesday-Saturday
/dd-workdays-set 2,3,4,5,6
```

### Viewing Work Days

```bash
/dd-workdays-show
```

## 💡 Tips and Best Practices

### For Team Members

- **Be Consistent**: Submit standups regularly to help team coordination
- **Be Specific**: Provide clear, actionable updates
- **Mention Blockers**: Don't hesitate to ask for help
- **Set Leave Early**: Update your leave dates in advance
- **Configure Reminder Preferences**: Use `/dd-standup-reminder` to manage your mention and notification settings
  - **Channel-based**: Run `/dd-standup-reminder mention=off notify=off` from your team's channel for quick access
  - **Cross-channel**: Use `/dd-standup-reminder TeamName mention=off notify=off` from anywhere when managing multiple teams
  - **Flexible control**: Set mention and notify preferences independently based on your participation level
  - **Admin notifications**: Team admins can use `notify=off` to stop receiving notifications about team member submissions

### For Team Admins

- **Choose Appropriate Times**: Consider team schedules and timezones
- **Set Clear Expectations**: Communicate standup format and timing
- **Monitor Participation**: Follow up with team members who miss standups regularly
- **Adjust as Needed**: Update times or format based on team feedback

### Standup Writing Tips

- **Last working day**: Focus on completed work and outcomes
- **Today**: Be specific about planned tasks and goals
- **Blockers**: Clearly state what you need help with and from whom

## 🔧 Troubleshooting

### Common Issues

**Not receiving reminders?**

- Check if you're a team member: `/dd-team-list`
- Verify your work days: `/dd-workdays-show`
- Check if you have active leave: `/dd-leave-list`

**Can't create a team?**

- Anyone in the workspace can run `/dd-team-create` — if you're not in the organization yet, you're added automatically.
- If you're a regular member, your team is submitted for approval; an org admin must Approve it before standups begin. Check with your org admin if it's still pending.
- If you see "this Slack workspace isn't set up with Daily Dose yet," ask an org admin to set up the organization first.
- A channel can only have one team — if the channel already has one (including a pending request), creation is blocked.

**Standup not posting to channel?**

- Ensure the bot has permissions to post in the channel
- Check if the team was created in the correct channel

**Wrong timezone?**

- Team timezones are set during team creation
- Contact your team admin to update timezone settings

### Getting Help

- Use `/dd-team-list` to see your teams with detailed timing and timezone information
- Check the bot's response messages for specific error details
- Contact your organization admin for permission issues

## ⚙️ Technical Details

### Web Interface

Daily Dose includes a comprehensive web interface:

- **Landing Page**: Professional marketing page at the base URL (`/`)
- **Scripts Documentation**: Administrative scripts documentation at `/scripts-docs` (password protected)
- **Health Check**: System status endpoint at `/health`
- **Static Assets**: Logo, CSS, and JavaScript served from `/public`
- **Express Integration**: Built on Express.js with Slack Bolt framework
- **Responsive Design**: Mobile-first approach using Tailwind CSS
- **Authentication**: HTTP Basic Auth protection for administrative interfaces

### Supported Timezones

The bot supports all standard timezone identifiers (e.g., "America/New_York", "Europe/London", "Asia/Tokyo").

### Data Privacy

- Only standup responses and basic user info are stored
- Leave reasons are optional and can be generic
- All data is associated with your Slack user ID

### Permissions Required

The bot needs these Slack permissions:

- Send direct messages
- Post in channels where teams are created
- Read user information
- Access slash commands
- **`channels:manage`** — create the per-org `#daily-dose-bot` channel and invite members automatically

> **Re-install required:** If you update the Slack app manifest to add `channels:manage`, you must re-install the app to the workspace for the new scope to take effect.

### Org Channel Auto-Provisioning

When an organization is created, the bot automatically creates a public `#daily-dose-bot` Slack channel for that org (falling back to `#daily-dose-bot-2`, etc. on name conflicts) and stores its ID on the organization record. Whenever a member joins a team — via `/dd-team-join`, team creation, or admin add-member — they are automatically invited to this channel. The invite is best-effort: Slack failures are logged but never block the join operation.

For existing organizations, run the backfill script to create the channel and invite current members:

```bash
npm run channels:backfill             # create channels + invite members
npm run channels:backfill -- --dry-run  # preview only, no changes
```

### Environment Configuration

Daily Dose requires several environment variables for proper operation:

**Core Application Settings:**

```bash
PORT=3000                                 # Server port (default: 3000)
APP_URL=https://your-domain.com           # Your application's base URL
DEFAULT_TIMEZONE=America/New_York         # Default timezone for teams
LOG_LEVEL=info                           # Logging level (debug, info, warn, error)
CHANGELOG_BROADCAST=                      # Optional — on-deploy changelog announcement to each org's #daily-dose-bot channel: "off" disables, "dry" logs targets without posting, unset/anything else = live
```

On every deploy, Daily Dose posts the latest user-facing changelog entry to each
organization's `daily-dose-bot` channel exactly once (tracked per org via
`Organization.lastBroadcastVersion`). Restarts never re-post, and existing orgs
are seeded silently the first time the feature ships. Use `CHANGELOG_BROADCAST`
above to disable or preview it.

**Slack Integration:**

```bash
SLACK_BOT_TOKEN=xoxb-your-bot-token      # Slack Bot User OAuth Token
SLACK_SIGNING_SECRET=your-signing-secret  # Slack App Signing Secret
SLACK_APP_TOKEN=xapp-your-app-token      # Slack App Token (for Socket Mode)
SLACK_USER_TOKEN=xoxp-your-user-token    # Slack User OAuth Token (for manifest updates)
```

**Database Configuration:**

```bash
DATABASE_URL=postgresql://user:pass@host:port/db     # Primary database connection
DIRECT_URL=postgresql://user:pass@host:port/db       # Direct database connection
```

**Scripts Documentation Authentication:**

```bash
SCRIPTS_AUTH_USERNAME=your-username           # Required — no default; app will not start if unset
SCRIPTS_AUTH_PASSWORD=your-strong-password    # Required — no default; app will not start if unset
```

**Contact Form (optional):**

```bash
CONTACT_SLACK_CHANNEL=C0123456789              # Slack channel or user ID that receives contact-form messages
```

**MCP Server:**

The two Slack OAuth callback URLs are derived from `APP_URL` — there is no env var to set. Register **both** in the Slack app's OAuth redirect URLs:

```
<APP_URL>/api/mcp/auth/callback          # manual token web flow (/mcp-tokens sign-in)
<APP_URL>/api/mcp/oauth/slack/callback   # OAuth 2.1 authorization-server (automatic client sign-in)
```

**Optional Monitoring:**

```bash
SENTRY_DSN=https://your-sentry-dsn       # Sentry error tracking (optional)
```

## 🤖 MCP Server

Daily Dose exposes an MCP (Model Context Protocol) server so you can operate standups directly from any AI agent — Claude Desktop, Cursor, or any MCP-compatible tool — without leaving your workflow.

### Connecting your AI agent (recommended)

The primary way to connect is automatic sign-in. Clients that support remote-MCP OAuth (e.g. Claude Desktop, Cursor, VS Code) connect by just pointing at the server URL — the client registers itself, opens a browser for you to sign in with Slack, and receives and refreshes its token automatically. There is no token to generate, copy, or paste.

```
URL: https://<your-host>/mcp
```

For automatic sign-in to work, operators must register the `<APP_URL>/api/mcp/oauth/slack/callback` URL in the Slack app's OAuth redirect URLs.

### Advanced — connecting with a manual token

Only needed for clients that don't support OAuth sign-in. Generate a personal token and send it in an `Authorization` header.

1. Visit `https://<your-host>/mcp-tokens`
2. Sign in with Slack
3. Click **Generate Token**
4. Copy the token — it is shown **only once** (it starts with `ddm_`, expires after 90 days, and is revocable from the same page)

Then configure your MCP client with the server URL plus the token header:

```
URL: https://<your-host>/mcp
Authorization: Bearer ddm_<your-token>
```

For example, in Claude Desktop's `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "daily-dose": {
      "url": "https://<your-host>/mcp",
      "headers": {
        "Authorization": "Bearer ddm_<your-token>"
      }
    }
  }
}
```

### Available Tools

| Tool                      | What it does                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `list_my_teams`           | List the teams you belong to                                                                                   |
| `submit_standup`          | Submit today's standup for a team                                                                              |
| `update_standup`          | Submit or update a standup for a specific date                                                                 |
| `get_my_standup_history`  | View your recent standup submissions                                                                           |
| `get_team_standup`        | View a team's standup for a date — responses, who hasn't submitted, who's on leave (requires team admin/owner) |
| `get_member_standup`      | View one member's standup submission for a date (requires team admin/owner)                                    |
| `post_team_standup`       | Post a team's standup summary for a date to its channel (requires team admin/owner)                            |
| `post_member_standup`     | Post one member's standup as a threaded reply (requires team admin/owner)                                      |
| `send_standup_reminders`  | DM today's standup reminder to active team members (requires team admin/owner)                                 |
| `send_followup_reminders` | DM a followup reminder to members who haven't submitted (requires team admin/owner)                            |

### Server Requirements

- **Node.js**: Version 14 or higher
- **Database**: PostgreSQL (via Supabase)
- **Web Server**: Express.js with static file serving and authentication
- **Environment**: Requires proper environment variables for Slack integration and authentication

## 🔖 Versioning and Releases

Daily Dose follows [Semantic Versioning (SemVer)](https://semver.org/) with automated deployments on version tag pushes.

### Version Format

```
v1.2.3
│ │ │
│ │ └─ PATCH: Bug fixes, minor improvements
│ └─── MINOR: New features, backwards-compatible changes
└───── MAJOR: Breaking changes, incompatible API changes
```

### Creating a Release

For maintainers, create a new release using npm scripts:

```bash
# For bug fixes (1.0.0 → 1.0.1)
npm run version:patch

# For new features (1.0.0 → 1.1.0)
npm run version:minor

# For breaking changes (1.0.0 → 2.0.0)
npm run version:major
```

### What Happens Automatically

1. ✅ **Pre-version checks**: Validates git state and branch
2. 📝 **Updates version**: Bumps version in package.json
3. 🏷️ **Creates tag**: Tags commit with version (e.g., v1.2.3)
4. 🚀 **Pushes changes**: Pushes commit and tag to remote
5. ⚡ **Triggers deployment**: GitHub Actions deploys to production
6. 📋 **Creates release**: Generates GitHub release with notes

### Deployment Workflow

When a version tag is pushed (e.g., `v1.2.3`):

1. **Validation**: Verifies SemVer format and version match
2. **Deploy**: Deploys to production VPS via SSH
3. **Health Check**: Verifies application is running
4. **Release Notes**: Creates GitHub release with changelog
5. **Notification**: Provides deployment summary

### Version Management Commands

```bash
# Check version and git status
npm run version:check

# View current version
node -p "require('./package.json').version"

# View version history
git tag --list
```

### Documentation

- **Changelog**: See [CHANGELOG.md](CHANGELOG.md) for version history
- **Versioning Guide**: See [docs/VERSIONING.md](docs/VERSIONING.md) for detailed process
- **Releases**: View on [GitHub Releases](https://github.com/jnahian/daily-dose/releases)

---

For deployment and infrastructure, see [DEPLOYMENT.md](DEPLOYMENT.md). For architecture and development guidance, see [CLAUDE.md](CLAUDE.md).
