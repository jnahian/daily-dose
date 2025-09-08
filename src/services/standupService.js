const prisma = require("../config/prisma");
const userService = require("./userService");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const advancedFormat = require("dayjs/plugin/advancedFormat");
const { isWorkingDay } = require("../utils/dateHelper");
const { getUserMention } = require("../utils/userHelper");

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

      // Format tasks into bullet points
      const formatTasks = (tasks) => {
        if (!tasks) return "";
        return tasks
          .split("\n")
          .filter((line) => line.trim())
          .map((line) =>
            line.startsWith("-") || line.startsWith("•") ? line : `- ${line}`
          )
          .join("\n");
      };

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

    return { blocks };
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

    // Format tasks into bullet points
    const formatTasks = (tasks) => {
      if (!tasks) return "";
      return tasks
        .split("\n")
        .filter((line) => line.trim())
        .map((line) =>
          line.startsWith("-") || line.startsWith("•") ? line : `- ${line}`
        )
        .join("\n");
    };

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

    return { blocks };
  }
}

module.exports = new StandupService();
