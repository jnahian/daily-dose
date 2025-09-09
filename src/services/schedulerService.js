const cron = require("node-cron");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const prisma = require("../config/prisma");
const { getUserLogIdentifier } = require("../utils/userHelper");

dayjs.extend(utc);
dayjs.extend(timezone);
const teamService = require("./teamService");
const standupService = require("./standupService");
const { isWorkingDay, formatTime12Hour } = require("../utils/dateHelper");
const {
  getRandomStandupMessage,
  getRandomFollowupMessage,
} = require("../utils/messageHelper");

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
    const standupJobId = `dd-${team.name.toLowerCase().replace(/\s+/g, "-")}`;

    // Cancel existing job if any
    if (this.scheduledJobs.has(standupJobId)) {
      this.scheduledJobs.get(standupJobId).stop();
    }

    const standupJob = cron.schedule(
      standupCron,
      async () => {
        console.log(
          `🚀 CRON JOB FIRED: Standup reminder for ${team.name} at ${dayjs()
            .tz(timezone)
            .format()}`
        );
        try {
          await this.sendStandupReminders(team);
        } catch (error) {
          console.error(
            `❌ Error in standup reminder for ${team.name}:`,
            error
          );
        }
      },
      {
        timezone,
        scheduled: true,
      }
    );

    this.scheduledJobs.set(standupJobId, standupJob);

    // Schedule follow-up reminder (15 minutes later)
    const followupTime = dayjs()
      .hour(standupHour)
      .minute(standupMinute)
      .add(15, "minute");

    const followupCron = `${followupTime.minute()} ${followupTime.hour()} * * 1-7`;
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

    console.log(
      `✅ Scheduled team: ${team.name} (${timezone}), Standup: ${standupTime}, Posting: ${postingTime}`
    );
  }

  async sendStandupReminders(team) {
    const now = dayjs().tz(team.timezone);

    // Get active members (this now includes work day filtering)
    const members = await standupService.getActiveMembers(
      team.id,
      now.toDate()
    );

    for (const member of members) {
      try {
        const randomMessage = getRandomStandupMessage(member.user.slackUserId);

        await this.app.client.chat.postMessage({
          channel: member.user.slackUserId,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: randomMessage,
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Team:* ${team.name}`,
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
                  text: `⏰ Deadline: ${formatTime12Hour(team.postingTime)}`,
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
    const now = dayjs().tz(team.timezone);

    // Get members who haven't responded (filtered by work days)
    const members = await standupService.getActiveMembers(
      team.id,
      now.toDate()
    );
    const responses = await standupService.getTeamResponses(
      team.id,
      now.toDate()
    );

    const respondedUserIds = new Set(responses.map((r) => r.userId));
    const pendingMembers = members.filter(
      (m) => !respondedUserIds.has(m.userId)
    );

    for (const member of pendingMembers) {
      try {
        const randomFollowupMessage = getRandomFollowupMessage(
          member.user.slackUserId
        );

        await this.app.client.chat.postMessage({
          channel: member.user.slackUserId,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: randomFollowupMessage,
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Team:* ${team.name}`,
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
                  text: `⏰ Deadline: ${formatTime12Hour(team.postingTime)}`,
                },
              ],
            },
          ],
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
    const now = dayjs().tz(team.timezone);

    // Check if it's a working day for the organization (general check)
    const isOrgWorkingDay = await isWorkingDay(
      now.toDate(),
      team.organizationId
    );
    if (!isOrgWorkingDay) return;

    // Get all responses (filtered by individual work days)
    const responses = await standupService.getTeamResponses(
      team.id,
      now.toDate()
    );
    const allMembers = await standupService.getActiveMembers(
      team.id,
      now.toDate()
    );

    // Get members on leave
    const membersOnLeave = await prisma.teamMember.findMany({
      where: {
        teamId: team.id,
        isActive: true,
        user: {
          leaves: {
            some: {
              startDate: { lte: now.toDate() },
              endDate: { gte: now.toDate() },
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
      .filter(
        (m) => !respondedUserIds.has(m.userId) && !leaveUserIds.has(m.userId)
      )
      .map((m) => ({
        slackUserId: m.user.slackUserId,
        user: m.user,
        onLeave: false,
      }));

    // Format on-leave members
    const onLeave = membersOnLeave.map((m) => ({
      slackUserId: m.user.slackUserId,
      user: m.user,
      onLeave: true,
    }));

    // Format and post message
    const message = await standupService.formatStandupMessage(
      responses,
      notSubmitted,
      onLeave
    );

    try {
      const result = await this.app.client.chat.postMessage({
        channel: team.slackChannelId,
        ...message,
      });

      // Save message timestamp for threading late responses
      await standupService.saveStandupPost(
        team.id,
        now.toDate(),
        result.ts,
        team.slackChannelId
      );

      // Post any existing late responses as threaded replies
      await this.postLateResponses(team, now.toDate());
    } catch (error) {
      console.error(`Failed to post standup for team ${team.name}:`, error);
    }
  }

  async postLateResponses(team, date) {
    try {
      // Get the standup post for threading
      const standupPost = await standupService.getStandupPost(team.id, date);
      if (!standupPost || !standupPost.slackMessageTs) {
        console.log(
          `No standup post found for team ${team.name} on ${dayjs(date).format(
            "YYYY-MM-DD"
          )}`
        );
        return;
      }

      // Get late responses
      const lateResponses = await standupService.getLateResponses(
        team.id,
        date
      );

      for (const response of lateResponses) {
        const message = await standupService.formatLateResponseMessage(
          response
        );

        await this.app.client.chat.postMessage({
          channel: standupPost.channelId,
          thread_ts: standupPost.slackMessageTs,
          reply_broadcast: true, // Send to channel flag - makes the threaded reply visible in the channel
          ...message,
        });
      }

      if (lateResponses.length > 0) {
        console.log(
          `✅ Posted ${lateResponses.length} late responses for team ${team.name}`
        );
      }
    } catch (error) {
      console.error(
        `Failed to post late responses for team ${team.name}:`,
        error
      );
    }
  }

  async handleLateResponse(teamId, responseData) {
    try {
      const team = await teamService.getTeamById(teamId);
      if (!team) {
        throw new Error("Team not found");
      }

      const responseDate = dayjs(responseData.date).startOf("day").toDate();

      // Post the late response as a threaded reply
      await this.postLateResponses(team, responseDate);
    } catch (error) {
      console.error(
        `Failed to handle late response for team ${teamId}:`,
        error
      );
    }
  }

  async postSingleLateResponse(teamId, lateResponse) {
    try {
      const team = await teamService.getTeamById(teamId);
      if (!team) {
        throw new Error("Team not found");
      }

      const responseDate = dayjs(lateResponse.standupDate)
        .startOf("day")
        .toDate();
      const standupPost = await standupService.getStandupPost(
        teamId,
        responseDate
      );

      if (!standupPost || !standupPost.slackMessageTs) {
        console.log(
          `No standup post found for team ${team.name} on ${dayjs(
            responseDate
          ).format("YYYY-MM-DD")}`
        );
        return;
      }

      const message = await standupService.formatLateResponseMessage(
        lateResponse
      );

      await this.app.client.chat.postMessage({
        channel: standupPost.channelId,
        thread_ts: standupPost.slackMessageTs,
        reply_broadcast: true, // Send to channel flag - makes the threaded reply visible in the channel
        ...message,
      });

      console.log(
        `✅ Posted late response for ${getUserLogIdentifier(
          lateResponse.user
        )} in team ${team.name}`
      );
    } catch (error) {
      console.error("Failed to post single late response:", error);
    }
  }
}

module.exports = new SchedulerService();
