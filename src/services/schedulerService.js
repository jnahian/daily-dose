const cron = require("node-cron");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const { getUserLogIdentifier } = require("../utils/userHelper");

dayjs.extend(utc);
dayjs.extend(timezone);
const teamService = require("./teamService");
const standupService = require("./standupService");
const { formatTime12Hour } = require("../utils/dateHelper");
const {
  getRandomStandupMessage,
  getRandomFollowupMessage,
} = require("../utils/messageHelper");
const {
  createSectionBlock,
  createButton,
  createActionsBlock,
  createContextBlock,
} = require("../utils/blockHelper");
const { parseTimeString } = require("../utils/timeHelper");

const logger = require("../utils/logger");

function runScheduledJob(name, fn) {
  return async () => {
    const startedAt = Date.now();
    logger.info(`cron:${name} fired`);
    try {
      await fn();
      logger.info(`cron:${name} ok (${Date.now() - startedAt}ms)`);
    } catch (err) {
      // logger.error forwards to Sentry when initialized
      logger.error(`cron:${name} failed`, err);
    }
  };
}

class SchedulerService {
  constructor() {
    this.scheduledJobs = new Map();
    this.app = null;
  }

  async initialize(app) {
    this.app = app;
    await this.scheduleAllTeams();

    // Safety-net refresh. Team create/update already calls
    // refreshTeamSchedule() directly, so this only exists to recover from
    // drift (direct DB edits, a failed schedule, a missed refresh call).
    // Hourly instead of daily-at-UTC-midnight so recovery doesn't lag up to
    // a full day for teams in non-UTC timezones. scheduleTeam() is
    // idempotent: it stops and replaces a team's existing jobs.
    cron.schedule(
      "0 * * * *",
      runScheduledJob("schedule-refresh", () => this.scheduleAllTeams())
    );
  }

  async scheduleAllTeams() {
    logger.info("📅 Scheduling standup reminders for all teams...");

    const teams = await teamService.getActiveTeamsForScheduling();

    for (const team of teams) {
      await this.scheduleTeam(team);
    }
  }

  async scheduleTeam(team) {
    const { standupTime, postingTime, timezone } = team;

    let standupParsed, postingParsed;
    try {
      standupParsed = parseTimeString(standupTime);
      postingParsed = parseTimeString(postingTime);
    } catch (err) {
      logger.error(
        `❌ Skipping schedule for team "${team.name}" (id=${team.id}): invalid time data in DB`,
        err
      );
      // Stop and remove any stale cron jobs for this team so old jobs don't keep firing
      const staleStandupJobId = `standup-${team.id}`;
      const staleFollowupJobId = `followup-${team.id}`;
      const stalePostingJobId = `posting-${team.id}`;
      if (this.scheduledJobs.has(staleStandupJobId)) {
        this.scheduledJobs.get(staleStandupJobId).stop();
        this.scheduledJobs.delete(staleStandupJobId);
      }
      if (this.scheduledJobs.has(staleFollowupJobId)) {
        this.scheduledJobs.get(staleFollowupJobId).stop();
        this.scheduledJobs.delete(staleFollowupJobId);
      }
      if (this.scheduledJobs.has(stalePostingJobId)) {
        this.scheduledJobs.get(stalePostingJobId).stop();
        this.scheduledJobs.delete(stalePostingJobId);
      }
      return;
    }
    const standupHour = standupParsed.hour;
    const standupMinute = standupParsed.minute;
    const postingHour = postingParsed.hour;
    const postingMinute = postingParsed.minute;

    // Schedule standup reminder
    const standupCron = `${standupMinute} ${standupHour} * * 0-6`; // All days (0=Sunday, 6=Saturday), we'll filter by user work days
    const standupJobId = `standup-${team.id}`;

    // Cancel existing job if any
    if (this.scheduledJobs.has(standupJobId)) {
      this.scheduledJobs.get(standupJobId).stop();
    }

    const standupJob = cron.schedule(
      standupCron,
      runScheduledJob(`standup:${team.name}`, () =>
        this.sendStandupReminders(team)
      ),
      { timezone, scheduled: true, name: standupJobId }
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
      runScheduledJob(`followup:${team.name}`, () =>
        this.sendFollowupReminders(team)
      ),
      { timezone, scheduled: true, name: followupJobId }
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
      runScheduledJob(`posting:${team.name}`, () => {
        const now = dayjs().tz(team.timezone);
        return standupService.postTeamStandup(team, now.toDate(), this.app);
      }),
      { timezone, scheduled: true, name: postingJobId }
    );

    this.scheduledJobs.set(postingJobId, postingJob);

    logger.info(
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

    // Filter out team owners/admins and members who opted out of
    // notifications (/dd-standup-reminder notify=off)
    const members = allMembers.filter(
      (member) => member.role !== "ADMIN" && member.receiveNotifications
    );

    for (const member of members) {
      try {
        const randomMessage = getRandomStandupMessage(
          member.user.slackUserId,
          member.user.timezone
        );

        await this.app.client.chat.postMessage({
          channel: member.user.slackUserId,
          text: randomMessage,
          blocks: [
            createSectionBlock(randomMessage),
            createSectionBlock(`*Team:* ${team.name}`),
            createActionsBlock([
              createButton(
                "📝 Submit Standup",
                `open_standup_${team.id}`,
                team.id.toString(),
                "primary"
              ),
            ]),
            createContextBlock(
              `⏰ Deadline: ${formatTime12Hour(team.postingTime)}`
            ),
          ],
        });
      } catch (error) {
        logger.error(
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
      (m) =>
        !respondedUserIds.has(m.userId) &&
        m.role !== "ADMIN" &&
        m.receiveNotifications
    );

    for (const member of pendingMembers) {
      try {
        const randomFollowupMessage = getRandomFollowupMessage(
          member.user.slackUserId,
          member.user.timezone
        );

        await this.app.client.chat.postMessage({
          channel: member.user.slackUserId,
          text: randomFollowupMessage,
          blocks: [
            createSectionBlock(randomFollowupMessage),
            createSectionBlock(`*Team:* ${team.name}`),
            createActionsBlock([
              createButton(
                "📝 Submit Standup",
                `open_standup_${team.id}`,
                team.id.toString(),
                "primary"
              ),
            ]),
            createContextBlock(
              `⏰ Deadline: ${formatTime12Hour(team.postingTime)}`
            ),
          ],
        });
      } catch (error) {
        logger.error(
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
      logger.error(`Failed to handle late response for team ${teamId}:`, error);
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
        logger.info(
          `No standup post found for team ${team.name} on ${dayjs(
            responseDate
          ).format("YYYY-MM-DD")}`
        );
        return;
      }

      const message =
        await standupService.formatLateResponseMessage(lateResponse);

      await this.app.client.chat.postMessage({
        channel: standupPost.channelId,
        thread_ts: standupPost.slackMessageTs,
        reply_broadcast: true, // Send to channel flag - makes the threaded reply visible in the channel
        ...message,
      });

      logger.info(
        `✅ Posted late response for ${getUserLogIdentifier(
          lateResponse.user
        )} in team ${team.name}`
      );
    } catch (error) {
      logger.error("Failed to post single late response:", error);
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
        logger.error(`Team with ID ${teamId} not found for schedule refresh`);
        return;
      }

      logger.info(`🔄 Refreshing schedule for team: ${team.name}`);
      await this.scheduleTeam(team);
    } catch (error) {
      logger.error(`Failed to refresh schedule for team ${teamId}:`, error);
    }
  }

  /**
   * Stop and remove all cron jobs for a team (used when a team is disabled or
   * deleted). The hourly safety-net refresh only (re)schedules active teams, so
   * a disabled/deleted team's jobs must be torn down explicitly here.
   * @param {string} teamId - Team ID whose jobs should be stopped
   */
  stopTeamSchedule(teamId) {
    for (const jobId of [
      `standup-${teamId}`,
      `followup-${teamId}`,
      `posting-${teamId}`,
    ]) {
      this.stopJob(jobId);
    }
  }

  /**
   * Refresh all team schedules (useful for batch updates or after major changes)
   */
  async refreshAllSchedules() {
    try {
      logger.info("🔄 Refreshing all team schedules...");
      await this.scheduleAllTeams();
    } catch (error) {
      logger.error("Failed to refresh all schedules:", error);
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
        scheduled: job.scheduled || false,
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
      logger.info(`🛑 Stopped job: ${jobId}`);
    }
  }

  /**
   * Stop all scheduled jobs (useful for cleanup)
   */
  stopAllJobs() {
    for (const job of this.scheduledJobs.values()) {
      job.stop();
    }
    this.scheduledJobs.clear();
    logger.info("🛑 Stopped all scheduled jobs");
  }
}

module.exports = new SchedulerService();
