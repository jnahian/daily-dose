const cron = require("node-cron");
const { DateTime } = require("luxon");
const prisma = require("../config/prisma");
const teamService = require("./teamService");
const standupService = require("./standupService");
const { isWorkingDay } = require("../utils/dateHelper");

class SchedulerService {
  constructor() {
    this.scheduledJobs = new Map();
    this.app = null;
  }

  async initialize(app) {
    this.app = app;
    await this.scheduleAllTeams();

    // Refresh schedules daily at midnight
    cron.schedule("0 0 * * *", async () => {
      await this.scheduleAllTeams();
    });
  }

  async scheduleAllTeams() {
    console.log("📅 Scheduling standup reminders for all teams...");

    const teams = await teamService.getActiveTeamsForScheduling();

    for (const team of teams) {
      await this.scheduleTeam(team);
    }
  }

  async scheduleTeam(team) {
    const { standupTime, postingTime, timezone } = team;

    // Parse times
    const standupHour = parseInt(standupTime.split(":")[0]);
    const standupMinute = parseInt(standupTime.split(":")[1]);
    const postingHour = parseInt(postingTime.split(":")[0]);
    const postingMinute = parseInt(postingTime.split(":")[1]);

    // Schedule standup reminder
    const standupCron = `${standupMinute} ${standupHour} * * 1-7`; // All days, we'll filter by user work days
    const standupJobId = `standup-${team.id}`;

    // Cancel existing job if any
    if (this.scheduledJobs.has(standupJobId)) {
      this.scheduledJobs.get(standupJobId).stop();
    }

    const standupJob = cron.schedule(
      standupCron,
      async () => {
        await this.sendStandupReminders(team);
      },
      {
        timezone,
        scheduled: true,
      }
    );

    this.scheduledJobs.set(standupJobId, standupJob);

    // Schedule follow-up reminder (15 minutes later)
    const followupTime = DateTime.fromObject({
      hour: standupHour,
      minute: standupMinute,
    }).plus({ minutes: 15 });

    const followupCron = `${followupTime.minute} ${followupTime.hour} * * 1-7`;
    const followupJobId = `followup-${team.id}`;

    if (this.scheduledJobs.has(followupJobId)) {
      this.scheduledJobs.get(followupJobId).stop();
    }

    const followupJob = cron.schedule(
      followupCron,
      async () => {
        await this.sendFollowupReminders(team);
      },
      {
        timezone,
        scheduled: true,
      }
    );

    this.scheduledJobs.set(followupJobId, followupJob);

    // Schedule posting time
    const postingCron = `${postingMinute} ${postingHour} * * 1-7`;
    const postingJobId = `posting-${team.id}`;

    if (this.scheduledJobs.has(postingJobId)) {
      this.scheduledJobs.get(postingJobId).stop();
    }

    const postingJob = cron.schedule(
      postingCron,
      async () => {
        await this.postTeamStandup(team);
      },
      {
        timezone,
        scheduled: true,
      }
    );

    this.scheduledJobs.set(postingJobId, postingJob);

    console.log(`✅ Scheduled team: ${team.name} (${timezone})`);
  }

  async sendStandupReminders(team) {
    const now = DateTime.now().setZone(team.timezone);

    // Get active members (this now includes work day filtering)
    const members = await standupService.getActiveMembers(
      team.id,
      now.toJSDate()
    );

    for (const member of members) {
      try {
        await this.app.client.chat.postMessage({
          channel: member.user.slackUserId,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `🌅 Good morning! Time for your daily standup for *${team.name}*`,
              },
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "📝 Submit Standup",
                  },
                  action_id: `open_standup_${team.id}`,
                  style: "primary",
                },
              ],
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `⏰ Deadline: ${team.postingTime}`,
                },
              ],
            },
          ],
        });
      } catch (error) {
        console.error(
          `Failed to send reminder to ${member.user.slackUserId}:`,
          error
        );
      }
    }
  }

  async sendFollowupReminders(team) {
    const now = DateTime.now().setZone(team.timezone);

    // Get members who haven't responded (filtered by work days)
    const members = await standupService.getActiveMembers(
      team.id,
      now.toJSDate()
    );
    const responses = await standupService.getTeamResponses(
      team.id,
      now.toJSDate()
    );

    const respondedUserIds = new Set(responses.map((r) => r.userId));
    const pendingMembers = members.filter(
      (m) => !respondedUserIds.has(m.userId)
    );

    for (const member of pendingMembers) {
      try {
        await this.app.client.chat.postMessage({
          channel: member.user.slackUserId,
          text: `⏰ Reminder: Please submit your standup for ${team.name} before ${team.postingTime}`,
        });
      } catch (error) {
        console.error(
          `Failed to send follow-up to ${member.user.slackUserId}:`,
          error
        );
      }
    }
  }

  async postTeamStandup(team) {
    const now = DateTime.now().setZone(team.timezone);

    // Check if it's a working day for the organization (general check)
    const isOrgWorkingDay = await isWorkingDay(now.toJSDate(), team.organizationId);
    if (!isOrgWorkingDay) return;

    // Get all responses (filtered by individual work days)
    const responses = await standupService.getTeamResponses(
      team.id,
      now.toJSDate()
    );
    const allMembers = await standupService.getActiveMembers(
      team.id,
      now.toJSDate()
    );

    // Get members on leave
    const membersOnLeave = await prisma.teamMember.findMany({
      where: {
        teamId: team.id,
        isActive: true,
        user: {
          leaves: {
            some: {
              startDate: { lte: now.toJSDate() },
              endDate: { gte: now.toJSDate() },
            },
          },
        },
      },
      include: {
        user: true,
      },
    });

    // Calculate not submitted
    const respondedUserIds = new Set(responses.map((r) => r.userId));
    const leaveUserIds = new Set(membersOnLeave.map((m) => m.userId));

    const notSubmitted = allMembers
      .filter((m) => !respondedUserIds.has(m.userId))
      .map((m) => ({
        slackUserId: m.user.slackUserId,
        onLeave: leaveUserIds.has(m.userId),
      }));

    // Format and post message
    const message = await standupService.formatStandupMessage(
      responses,
      notSubmitted
    );

    try {
      const result = await this.app.client.chat.postMessage({
        channel: team.slackChannelId,
        ...message,
      });

      // Save message timestamp for threading late responses
      await standupService.saveStandupPost(
        team.id,
        now.toJSDate(),
        result.ts,
        team.slackChannelId
      );
    } catch (error) {
      console.error(`Failed to post standup for team ${team.name}:`, error);
    }
  }
}

module.exports = new SchedulerService();