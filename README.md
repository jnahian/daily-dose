<p align="center">
  <img src="public/logo.png" alt="Daily Dose Logo" width="128" height="128">
</p>

<h1 align="center">Daily Dose Slack Bot - User Guide</h1>

<p align="center">
Daily Dose is a Slack bot that automates daily standup meetings for teams. It sends reminders, collects responses, and posts formatted standup summaries to team channels.
</p>

## ✨ Features

- **Automated Standup Reminders**: Sends DM reminders at configured times
- **Team Management**: Create and join teams with custom schedules
- **Leave Management**: Set vacation/leave dates to skip standup reminders
- **Work Day Configuration**: Customize your working days
- **Multi-Organization Support**: Supports multiple organizations and workspaces
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
/dd-team-list                    # See available teams
/dd-team-join Engineering        # Join an existing team
/dd-team-leave Engineering       # Leave a team
/dd-team-members Engineering     # View team members
/dd-team-create MyTeam 09:30 10:00  # Create new team ⚠️ (admin only)
/dd-team-update Engineering standup=09:00  # Update team settings ⚠️ (admin only)
```

### 3. Submit Your Daily Standup

The bot will send you a DM reminder at your team's configured time. Click the "Submit Standup" button or use:

```
/dd-standup MyTeam              # Manual standup submission
/dd-standup-update MyTeam       # Update today's standup for MyTeam
/dd-standup-update MyTeam 2024-12-20  # Update standup for specific date
```

## ⚡ Slash Commands

### 📝 Standup Submission

- `/dd-standup [team-name]` - Submit standup manually outside scheduled time
- `/dd-standup-update <team-name> [YYYY-MM-DD]` - Update standup for any day (defaults to today)
- The bot also sends automatic DM reminders with interactive buttons

### 👥 Team Management

- `/dd-team-list` - List all teams in your organization
- `/dd-team-join <team-name>` - Join an existing team
- `/dd-team-leave <team-name>` - Leave a team you're currently a member of
- `/dd-team-members <team-name>` - View all members of a specific team
- `/dd-team-create <name> <standup-time> <posting-time>` - Create a new team ⚠️ **(admin only)**
  - Example: `/dd-team-create Engineering 09:30 10:00`
  - Requires admin permissions
- `/dd-team-update <team-name> [parameters]` - Update team settings ⚠️ **(admin only)**
  - Example: `/dd-team-update Engineering standup=09:00 posting=10:30 notifications=false`
  - Parameters: `name=NewName`, `standup=HH:MM`, `posting=HH:MM`, `notifications=true/false`
  - The `notifications` parameter controls whether team admins receive standup submission notifications (default: true)

### 🌴 Leave Management

- `/dd-leave-list` - View your upcoming leaves
- `/dd-leave-set <start-date> [end-date] [reason]` - Set leave dates
  - Single day: `/dd-leave-set 2024-12-25 Holiday`
  - Date range: `/dd-leave-set 2024-12-25 2024-12-26 Holiday break`
- `/dd-leave-cancel <leave-id>` - Cancel a leave (use ID from list command)

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

- **Yesterday's Tasks**: What you worked on yesterday
- **Today's Tasks**: What you plan to work on today
- **Blockers**: Any obstacles or help needed

### Team Summary

The bot posts a formatted summary showing:

- All submitted standups with responses
- List of team members who haven't submitted
- Members on leave (automatically excluded)

## 👥 Team Setup (Admin Guide)

### Creating a Team

1. Use `/dd-team-create <name> <standup-time> <posting-time>` in the channel where you want standups posted
2. Set appropriate times:
   - **Standup Time**: When reminders are sent (e.g., 09:30)
   - **Posting Time**: When summary is posted (e.g., 10:00)
3. Team members can join using `/dd-team-join <team-name>`

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
/dd-team-create Engineering 09:30 10:00

# Team members join
/dd-team-join Engineering

# Optionally disable admin notifications for this team
/dd-team-update Engineering notifications=false
```

## 📝 Standup Updates

You can update your standup for any day using the update command:

```bash
# Update today's standup for specific team
/dd-standup-update Engineering

# Update standup for specific date and team
/dd-standup-update Engineering 2024-12-20
```

### Update Behavior

- **Pre-filled Form**: If you already submitted a standup for that date, the form opens with your existing data
- **New Submission**: If no standup exists for that date, it opens a fresh form
- **Thread Updates**: When updating today's standup after the posting time, your update will automatically be posted to the team channel thread
- **Historical Updates**: You can update standups for past or future dates without thread posting

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

### For Team Admins

- **Choose Appropriate Times**: Consider team schedules and timezones
- **Set Clear Expectations**: Communicate standup format and timing
- **Monitor Participation**: Follow up with team members who miss standups regularly
- **Adjust as Needed**: Update times or format based on team feedback

### Standup Writing Tips

- **Yesterday**: Focus on completed work and outcomes
- **Today**: Be specific about planned tasks and goals
- **Blockers**: Clearly state what you need help with and from whom

## 🔧 Troubleshooting

### Common Issues

**Not receiving reminders?**

- Check if you're a team member: `/dd-team-list`
- Verify your work days: `/dd-workdays-show`
- Check if you have active leave: `/dd-leave-list`

**Can't create a team?**

- You need admin permissions in your organization
- Contact your organization admin

**Standup not posting to channel?**

- Ensure the bot has permissions to post in the channel
- Check if the team was created in the correct channel

**Wrong timezone?**

- Team timezones are set during team creation
- Contact your team admin to update timezone settings

### Getting Help

- Use `/dd-team-list` to see your teams and their settings
- Check the bot's response messages for specific error details
- Contact your organization admin for permission issues

## ⚙️ Technical Details

### Web Interface

Daily Dose includes a comprehensive web interface:

- **Landing Page**: Professional marketing page at the base URL (`/`)
- **Health Check**: System status endpoint at `/health`
- **Static Assets**: Logo, CSS, and JavaScript served from `/public`
- **Express Integration**: Built on Express.js with Slack Bolt framework
- **Responsive Design**: Mobile-first approach using Tailwind CSS

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

### Server Requirements

- **Node.js**: Version 14 or higher
- **Database**: PostgreSQL (via Supabase)
- **Web Server**: Express.js with static file serving
- **Environment**: Requires proper environment variables for Slack integration

---

For technical setup and administration, see the [Complete Implementation Guide](docs/daily-dose-complete-guide.md).
