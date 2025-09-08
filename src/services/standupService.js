const prisma = require("../config/prisma");
const userService = require("./userService");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const { isWorkingDay } = require("../utils/dateHelper");

dayjs.extend(utc);
dayjs.extend(timezone);

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

  async formatStandupMessage(responses, notSubmitted) {
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `📊 Daily Standup - ${dayjs().format("MMM DD, YYYY")}`,
        },
      },
      {
        type: "divider",
      },
    ];

    // Add responses
    if (responses.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*✅ Submitted (${responses.length}):*`,
        },
      });

      for (const response of responses) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*👤 ${response.user.name || response.user.slackUserId}*`,
          },
        });

        let responseText = "";

        if (response.yesterdayTasks) {
          responseText += `*Yesterday:*\n${response.yesterdayTasks}\n\n`;
        }

        if (response.todayTasks) {
          responseText += `*Today:*\n${response.todayTasks}\n\n`;
        }

        if (response.blockers) {
          responseText += `*Blockers:* ${response.blockers}`;
        } else {
          responseText += `*Blockers:* None`;
        }

        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: responseText,
          },
        });

        blocks.push({
          type: "divider",
        });
      }
    }

    // Add not submitted section
    if (notSubmitted.length > 0) {
      const notSubmittedText = notSubmitted
        .map((m) => {
          if (m.onLeave) {
            return `• <@${m.slackUserId}> (On leave)`;
          }
          return `• <@${m.slackUserId}> (No response)`;
        })
        .join("\n");

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*📝 Not Submitted:*\n${notSubmittedText}`,
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
          text: `🕐 *Late Submission from ${
            response.user.name || response.user.slackUserId
          }*`,
        },
      },
    ];

    let responseText = "";

    if (response.yesterdayTasks) {
      responseText += `*Yesterday:*\n${response.yesterdayTasks}\n\n`;
    }

    if (response.todayTasks) {
      responseText += `*Today:*\n${response.todayTasks}\n\n`;
    }

    if (response.blockers) {
      responseText += `*Blockers:* ${response.blockers}`;
    } else {
      responseText += `*Blockers:* None`;
    }

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: responseText,
      },
    });

    return { blocks };
  }
}

module.exports = new StandupService();
