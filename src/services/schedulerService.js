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
const {
  createStandupReminderBlocks,
  createSectionBlock,
  createButton,
  createActionsBlock,
} = require("../utils/blockHelper");

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
    const standupCron = `${standupMinute} ${standupHour} * * 0-6`; // All days (0=Sunday, 6=Saturday), we'll filter by user work days
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
        name: standupJobId,
      }
    );

    this.scheduledJobs.set(standupJobId, standupJob);

    // Schedule follow-up reminder (15 minutes later)
    const followupTime = dayjs()
      .tz(timezone)
      .hour(standupHour)
      .minute(standupMinute)
      .add(15, "minute");

    const followupCron = `${followupTime.minute()} ${followupTime.hour()} * * 0-6`;
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
        name: followupJobId,
      }
    );

    this.scheduledJobs.set(followupJobId, followupJob);

    // Schedule posting time
    const postingCron = `${postingMinute} ${postingHour} * * 0-6`;
    const postingJobId = `posting-${team.id}`;

    if (this.scheduledJobs.has(postingJobId)) {
      this.scheduledJobs.get(postingJobId).stop();
    }

    const postingJob = cron.schedule(
      postingCron,
      async () => {
        try {
          const now = dayjs().tz(team.timezone);
          await standupService.postTeamStandup(team, now.toDate(), this.app);
        } catch (error) {
          console.error(`❌ Error posting standup for ${team.name}:`, error);
        }
      },
      {
        timezone,
        scheduled: true,
        name: postingJobId,
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
    const allMembers = await standupService.getActiveMembers(
      team.id,
      now.toDate()
    );

    // Filter out team owners/admins from receiving reminders
    const members = allMembers.filter(member => member.role !== 'ADMIN');

    for (const member of members) {
      try {
        const randomMessage = getRandomStandupMessage(member.user.slackUserId);

        await this.app.client.chat.postMessage({
          channel: member.user.slackUserId,
          blocks: [
            createSectionBlock(randomMessage),
            createSectionBlock(`*Team:* ${team.name}`),
            createActionsBlock([
              createButton("📝 Submit Standup", `open_standup_${team.id}`, team.id.toString(), "primary")
            ]),
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
      (m) => !respondedUserIds.has(m.userId) && m.role !== 'ADMIN'
    );

    for (const member of pendingMembers) {
      try {
        const randomFollowupMessage = getRandomFollowupMessage(
          member.user.slackUserId
        );

        await this.app.client.chat.postMessage({
          channel: member.user.slackUserId,
          blocks: [
            createSectionBlock(randomFollowupMessage),
            createSectionBlock(`*Team:* ${team.name}`),
            createActionsBlock([
              createButton("📝 Submit Standup", `open_standup_${team.id}`, team.id.toString(), "primary")
            ]),
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


  async handleLateResponse(teamId, responseData) {
    try {
      const team = await teamService.getTeamById(teamId);
      if (!team) {
        throw new Error("Team not found");
      }

      const responseDate = dayjs(responseData.date).startOf("day").toDate();

      // Post the late response as a threaded reply
      await standupService.postLateResponses(team, responseDate, this.app);
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

  /**
   * Refresh schedule for a specific team (useful after team creation/update)
   * @param {string} teamId - Team ID to refresh
   */
  async refreshTeamSchedule(teamId) {
    try {
      const team = await teamService.getTeamById(teamId);
      if (!team) {
        console.error(`Team with ID ${teamId} not found for schedule refresh`);
        return;
      }

      console.log(`🔄 Refreshing schedule for team: ${team.name}`);
      await this.scheduleTeam(team);
    } catch (error) {
      console.error(`Failed to refresh schedule for team ${teamId}:`, error);
    }
  }

  /**
   * Refresh all team schedules (useful for batch updates or after major changes)
   */
  async refreshAllSchedules() {
    try {
      console.log("🔄 Refreshing all team schedules...");
      await this.scheduleAllTeams();
    } catch (error) {
      console.error("Failed to refresh all schedules:", error);
    }
  }

  /**
   * Get information about currently scheduled jobs
   * @returns {Array} Array of job information
   */
  getScheduledJobs() {
    const jobs = [];
    for (const [jobId, job] of this.scheduledJobs) {
      jobs.push({
        id: jobId,
        running: job.running || false,
        scheduled: job.scheduled || false
      });
    }
    return jobs;
  }

  /**
   * Stop a specific job by ID
   * @param {string} jobId - Job ID to stop
   */
  stopJob(jobId) {
    if (this.scheduledJobs.has(jobId)) {
      this.scheduledJobs.get(jobId).stop();
      this.scheduledJobs.delete(jobId);
      console.log(`🛑 Stopped job: ${jobId}`);
    }
  }

  /**
   * Stop all scheduled jobs (useful for cleanup)
   */
  stopAllJobs() {
    for (const [jobId, job] of this.scheduledJobs) {
      job.stop();
    }
    this.scheduledJobs.clear();
    console.log("🛑 Stopped all scheduled jobs");
  }
}

module.exports = new SchedulerService();
