# NotificationService Usage Examples

The `NotificationService` provides reusable methods for notifying team admins about various events. Here are examples of how to use it:

## 1. Standup Submissions (Already Implemented)

```javascript
const notificationService = require("../services/notificationService");

// For regular standup submission
await notificationService.notifyAdminsOfStandupSubmission({
  teamId,
  user: body.user,
  team,
  client,
  options: { isLate: false }
});

// For standup update
await notificationService.notifyAdminsOfStandupSubmission({
  teamId,
  user: body.user,
  team,
  client,
  options: { 
    isUpdate: true, 
    isLate: true, 
    date: "Dec 10, 2024" 
  }
});
```

## 2. Team Member Events (Future Use Cases)

```javascript
// When a new member joins a team
await notificationService.notifyTeamAdmins({
  teamId: team.id,
  excludeUserId: newMember.slackUserId,
  client,
  message: `👋 ${newMember.name} joined the ${team.name} team`,
  blocks: [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `👋 *${newMember.name}* joined the *${team.name}* team`
      }
    },
    {
      type: "context",
      elements: [{
        type: "mrkdwn",
        text: `Team: *${team.name}* | Channel: <#${team.slackChannelId}>`
      }]
    }
  ]
});

// When a member leaves a team
await notificationService.notifyTeamAdmins({
  teamId: team.id,
  excludeUserId: null, // Don't exclude anyone
  client,
  message: `👋 ${leavingMember.name} left the ${team.name} team`
});

// When team settings are changed
await notificationService.notifyTeamAdmins({
  teamId: team.id,
  excludeUserId: admin.slackUserId, // Exclude the admin who made the change
  client,
  message: `⚙️ ${admin.name} updated ${team.name} settings: ${changeDescription}`
});
```

## 3. Leave/Absence Notifications

```javascript
// When someone submits a leave request
await notificationService.notifyTeamAdmins({
  teamId: team.id,
  excludeUserId: user.slackUserId,
  client,
  message: `🏖️ ${user.name} submitted a leave request for ${dateRange}`,
  blocks: [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🏖️ *${user.name}* submitted a leave request`
      }
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Dates:* ${dateRange}\n*Reason:* ${reason}`
      }
    }
  ]
});
```

## 4. Standup Reminders for Admins

```javascript
// When someone misses standup deadline
await notificationService.notifyTeamAdmins({
  teamId: team.id,
  excludeUserId: null,
  client,
  message: `⏰ ${missedUsers.length} team members haven't submitted standups yet`,
  blocks: [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `⏰ *${missedUsers.length}* team members haven't submitted standups yet`
      }
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Missing: ${missedUsers.map(u => u.name).join(", ")}`
      }
    }
  ]
});
```

## Benefits

- **Consistent formatting**: All admin notifications follow the same structure
- **Error handling**: Built-in error handling that doesn't break main flows
- **Flexibility**: Support for both simple messages and rich Slack blocks
- **Exclusion logic**: Easy to exclude specific users from notifications
- **Reusability**: One service for all admin notification needs