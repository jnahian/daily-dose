const prisma = require("../config/prisma");
const userService = require("./userService");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const advancedFormat = require("dayjs/plugin/advancedFormat");
const { isWorkingDay } = require("../utils/dateHelper");
const { getUserMention, getDisplayName } = require("../utils/userHelper");
const { formatTasks } = require("../utils/messageHelper");

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(advancedFormat);

class StandupService {
  async getActiveMembers(teamId, date) {
    const startOfDay = dayjs(date).startOf("day").toDate();
    const endOfDay = dayjs(date).endOf("day").toDate();

    const members = await prisma.teamMember.findMany({
      where: {
        teamId,
        isActive: true,
        user: {
          leaves: {
            none: {
              AND: [
                { startDate: { lte: endOfDay } },
                { endDate: { gte: startOfDay } },
              ],
            },
          },
        },
      },
      include: {
        user: true,
        team: {
          include: {
            organization: true,
          },
        },
      },
    });

    // Filter by user's work days
    const activeMembers = [];
    for (const member of members) {
      const isWorking = await isWorkingDay(
        date,
        member.team.organizationId,
        member.userId
      );
      if (isWorking) {
        activeMembers.push(member);
      }
    }

    return activeMembers;
  }

  async saveResponse(
    teamId,
    slackUserId,
    responseData,
    isLate = false,
    slackClient = null
  ) {
    const userData = await userService.fetchSlackUserData(
      slackUserId,
      slackClient
    );
    const user = await userService.findOrCreateUser(slackUserId, userData);

    const standupDate = dayjs(responseData.date).startOf("day").toDate();

    return await prisma.standupResponse.upsert({
      where: {
        teamId_userId_standupDate: {
          teamId,
          userId: user.id,
          standupDate,
        },
      },
      update: {
        yesterdayTasks: responseData.yesterdayTasks,
        todayTasks: responseData.todayTasks,
        blockers: responseData.blockers,
        hasBlockers: !!responseData.blockers,
        isLate,
        submittedAt: new Date(),
      },
      create: {
        teamId,
        userId: user.id,
        standupDate,
        yesterdayTasks: responseData.yesterdayTasks,
        todayTasks: responseData.todayTasks,
        blockers: responseData.blockers,
        hasBlockers: !!responseData.blockers,
        isLate,
      },
    });
  }

  async getTeamResponses(teamId, date) {
    const startOfDay = dayjs(date).startOf("day").toDate();
    const endOfDay = dayjs(date).endOf("day").toDate();

    return await prisma.standupResponse.findMany({
      where: {
        teamId,
        standupDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        isLate: false,
      },
      include: {
        user: true,
      },
      orderBy: {
        submittedAt: "asc",
      },
    });
  }

  async getLateResponses(teamId, date) {
    const startOfDay = dayjs(date).startOf("day").toDate();
    const endOfDay = dayjs(date).endOf("day").toDate();

    return await prisma.standupResponse.findMany({
      where: {
        teamId,
        standupDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        isLate: true,
      },
      include: {
        user: true,
      },
      orderBy: {
        submittedAt: "asc",
      },
    });
  }

  async saveStandupPost(teamId, date, messageTs, channelId) {
    const standupDate = dayjs(date).startOf("day").toDate();

    return await prisma.standupPost.upsert({
      where: {
        teamId_standupDate: {
          teamId,
          standupDate,
        },
      },
      update: {
        slackMessageTs: messageTs,
        channelId,
        postedAt: new Date(),
      },
      create: {
        teamId,
        standupDate,
        slackMessageTs: messageTs,
        channelId,
        postedAt: new Date(),
      },
    });
  }

  async getStandupPost(teamId, date) {
    const standupDate = dayjs(date).startOf("day").toDate();

    return await prisma.standupPost.findUnique({
      where: {
        teamId_standupDate: {
          teamId,
          standupDate,
        },
      },
    });
  }

  async formatStandupMessage(
    responses,
    notSubmitted,
    onLeave = [],
    targetDate = null
  ) {
    const date = dayjs(targetDate).format("Do MMM (ddd), YYYY");

    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `💬 Daily Standup — ${date}`,
          emoji: true,
        },
      },
    ];

    // Add each response
    for (const response of responses) {
      // User name section with proper fallback chain
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*👤 ${getUserMention(response.user)}*`,
        },
      });

      const yesterdayFormatted = formatTasks(response.yesterdayTasks);
      const todayFormatted = formatTasks(response.todayTasks);

      // Tasks section with two columns
      const fields = [];

      if (yesterdayFormatted) {
        fields.push({
          type: "mrkdwn",
          text: `*📄 Yesterday*\n${yesterdayFormatted}`,
        });
      }

      if (todayFormatted) {
        fields.push({
          type: "mrkdwn",
          text: `*🎯 Today*\n${todayFormatted}`,
        });
      }

      if (fields.length > 0) {
        blocks.push({
          type: "section",
          fields,
        });
      }

      // Blockers section
      if (response.blockers && response.blockers.trim()) {
        blocks.push({
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `⚠️ *Blocker:* _${response.blockers}_`,
            },
          ],
        });
      }

      // Add divider after each person
      blocks.push({
        type: "divider",
      });
    }

    // Not responded section
    const notResponded = notSubmitted.filter((m) => !m.onLeave);
    if (notResponded.length > 0) {
      const notRespondedText = notResponded
        .map((m) => `- <@${m.slackUserId}>`)
        .join("\n");

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*📝 Not Responded*\n${notRespondedText}`,
        },
      });
    }

    // On leave section
    const onLeaveMembers = notSubmitted
      .filter((m) => m.onLeave)
      .concat(onLeave);
    if (onLeaveMembers.length > 0) {
      const onLeaveText = onLeaveMembers
        .map((m) => `- <@${m.slackUserId}>`)
        .join("\n");

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🌴 On Leave*\n${onLeaveText}`,
        },
      });
    }

    return {
      text: `Daily Standup — ${date}`,
      blocks,
    };
  }

  async formatLateResponseMessage(response) {
    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🕐 *Late Submission*`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*👤 ${getUserMention(response.user)}*`,
        },
      },
    ];

    const yesterdayFormatted = formatTasks(response.yesterdayTasks);
    const todayFormatted = formatTasks(response.todayTasks);

    // Tasks section with two columns
    const fields = [];

    if (yesterdayFormatted) {
      fields.push({
        type: "mrkdwn",
        text: `*📄 Yesterday*\n${yesterdayFormatted}`,
      });
    }

    if (todayFormatted) {
      fields.push({
        type: "mrkdwn",
        text: `*🎯 Today*\n${todayFormatted}`,
      });
    }

    if (fields.length > 0) {
      blocks.push({
        type: "section",
        fields,
      });
    }

    // Blockers section
    if (response.blockers && response.blockers.trim()) {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `⚠️ *Blocker:* _${response.blockers}_`,
          },
        ],
      });
    }

    return {
      text: `Late Submission from ${getDisplayName(response.user)}`,
      blocks,
    };
  }

  async postTeamStandup(team, date, slackApp) {
    const targetDate = dayjs(date).tz(team.timezone);

    // Check if it's a working day for the organization (general check)
    const isOrgWorkingDay = await isWorkingDay(
      targetDate.toDate(),
      team.organizationId
    );
    if (!isOrgWorkingDay) return;

    // Get all responses (filtered by individual work days)
    const responses = await this.getTeamResponses(
      team.id,
      targetDate.toDate()
    );
    const allMembers = await this.getActiveMembers(
      team.id,
      targetDate.toDate()
    );

    // Get members on leave
    const membersOnLeave = await prisma.teamMember.findMany({
      where: {
        teamId: team.id,
        isActive: true,
        user: {
          leaves: {
            some: {
              startDate: { lte: targetDate.toDate() },
              endDate: { gte: targetDate.toDate() },
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
    const message = await this.formatStandupMessage(
      responses,
      notSubmitted,
      onLeave,
      targetDate
    );

    try {
      console.log(`📤 Posting standup message for team ${team.name}...`);
      const result = await slackApp.client.chat.postMessage({
        channel: team.slackChannelId,
        ...message,
      });

      console.log(`✅ Message posted successfully with timestamp: ${result.ts}`);
      console.log(`💾 Saving standup post to database...`);

      // Save message timestamp for threading late responses
      try {
        const savedPost = await this.saveStandupPost(
          team.id,
          targetDate.toDate(),
          result.ts,
          team.slackChannelId
        );
        console.log(`✅ Standup post saved successfully with ID: ${savedPost.id}`);
      } catch (saveError) {
        console.error(`❌ Failed to save standup post for team ${team.name}:`, saveError);
        // Don't throw here - we still want to try posting late responses
      }

      // Post any existing late responses as threaded replies
      console.log(`📝 Checking for late responses...`);
      try {
        await this.postLateResponses(team, targetDate.toDate(), slackApp);
      } catch (lateResponseError) {
        console.error(`❌ Failed to post late responses for team ${team.name}:`, lateResponseError);
        // Don't throw here either - the main post was successful
      }

      return result;
    } catch (error) {
      console.error(`❌ Failed to post standup for team ${team.name}:`, error);
      throw error;
    }
  }

  async postLateResponses(team, date, slackApp) {
    try {
      // Get the standup post for threading
      const standupPost = await this.getStandupPost(team.id, date);
      if (!standupPost || !standupPost.slackMessageTs) {
        console.log(
          `No standup post found for team ${team.name} on ${dayjs(date).format(
            "YYYY-MM-DD"
          )}`
        );
        return;
      }

      // Get late responses
      const lateResponses = await this.getLateResponses(
        team.id,
        date
      );

      for (const response of lateResponses) {
        const message = await this.formatLateResponseMessage(
          response
        );

        await slackApp.client.chat.postMessage({
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
      throw error;
    }
  }
}

module.exports = new StandupService();
