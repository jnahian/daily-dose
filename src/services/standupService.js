const prisma = require("../config/prisma");
const logger = require("../utils/logger");
const userService = require("./userService");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const advancedFormat = require("dayjs/plugin/advancedFormat");
const {
  isWorkingDay,
  isWorkingDayPure,
  getHolidayDateSet,
  getOrgDefaultWorkDays,
} = require("../utils/dateHelper");
const { getUserMention, getDisplayName } = require("../utils/userHelper");
const { formatTasks } = require("../utils/messageHelper");
const {
  createSectionBlock,
  createTaskFieldBlocks,
  createBlockerContextBlock,
  createDividerBlock,
  createLateResponseBlocks,
  createUserResponseBlocks,
  createNotRespondedBlocks,
  createOnLeaveBlocks,
} = require("../utils/blockHelper");

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
          include: { organization: true },
        },
      },
    });

    if (members.length === 0) return [];

    // All members on the same team => same organization. Fetch org-default
    // workDays and holidays once.
    const organization = members[0].team.organization;
    const orgDefaultWorkDays = getOrgDefaultWorkDays(organization.settings);
    const holidayDateSet = await getHolidayDateSet(
      organization.id,
      startOfDay,
      endOfDay
    );

    return members.filter((member) => {
      const workDays = member.user.workDays?.length
        ? member.user.workDays
        : orgDefaultWorkDays;
      return isWorkingDayPure({ date, workDays, holidayDateSet });
    });
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
        submittedAt: dayjs().toDate(),
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

  async getUserResponse(teamId, userId, date) {
    const startOfDay = dayjs(date).startOf("day").toDate();
    const endOfDay = dayjs(date).endOf("day").toDate();

    return await prisma.standupResponse.findFirst({
      where: {
        teamId,
        userId,
        standupDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        user: true,
      },
      // Most recent submission wins if the user re-submitted
      orderBy: {
        submittedAt: "desc",
      },
    });
  }

  async saveStandupPost(teamId, date, messageTs, channelId) {
    const standupDate = dayjs(date).toDate();

    logger.info(
      `💾 Saving standup post for team ID ${teamId} on ${standupDate}...`
    );

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
        postedAt: dayjs().toDate(),
      },
      create: {
        teamId,
        standupDate,
        slackMessageTs: messageTs,
        channelId,
        postedAt: dayjs().toDate(),
      },
    });
  }

  async getStandupPost(teamId, date) {
    const standupDate = dayjs(date).toDate();

    return await prisma.standupPost.findUnique({
      where: {
        teamId_standupDate: {
          teamId,
          standupDate,
        },
      },
    });
  }

  async getLastStandupResponse(teamId, slackUserId) {
    try {
      // Get user data first
      const userData = await userService.fetchSlackUserData(slackUserId);
      const user = await userService.findOrCreateUser(slackUserId, userData);

      // Find the most recent standup response for this user and team
      return await prisma.standupResponse.findFirst({
        where: {
          teamId,
          userId: user.id,
        },
        orderBy: {
          standupDate: "desc",
        },
      });
    } catch (error) {
      logger.error("Error getting last standup response:", error);
      return null;
    }
  }

  async getUserStandupHistory(slackUserId, startDate, endDate) {
    const user = await prisma.user.findUnique({
      where: { slackUserId },
    });

    if (!user) return [];

    const start = dayjs(startDate).startOf("day").toDate();
    const end = dayjs(endDate).endOf("day").toDate();

    return await prisma.standupResponse.findMany({
      where: {
        userId: user.id,
        standupDate: {
          gte: start,
          lte: end,
        },
      },
      include: {
        team: true,
      },
      orderBy: [{ standupDate: "desc" }, { submittedAt: "asc" }],
    });
  }

  async getUserLastSubmissionDate(slackUserId) {
    const user = await prisma.user.findUnique({
      where: { slackUserId },
    });

    if (!user) return null;

    const last = await prisma.standupResponse.findFirst({
      where: { userId: user.id },
      orderBy: { standupDate: "desc" },
      select: { standupDate: true },
    });

    return last?.standupDate || null;
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
      const responseData = {
        userMention: getUserMention(response.user),
        yesterdayTasks: formatTasks(response.yesterdayTasks),
        todayTasks: formatTasks(response.todayTasks),
        blockers: response.blockers,
      };

      // Use modified version of createUserResponseBlocks to match existing format
      blocks.push(createSectionBlock(`*👤 ${responseData.userMention}*`));

      blocks.push(
        ...createTaskFieldBlocks(
          responseData.yesterdayTasks,
          responseData.todayTasks
        )
      );

      // Blockers section (using existing context format)
      if (responseData.blockers && responseData.blockers.trim()) {
        blocks.push(createBlockerContextBlock(responseData.blockers));
      }

      blocks.push(createDividerBlock());
    }

    // Add not responded and on leave sections
    const notResponded = notSubmitted.filter((m) => !m.onLeave);
    blocks.push(...createNotRespondedBlocks(notResponded));

    const onLeaveMembers = notSubmitted
      .filter((m) => m.onLeave)
      .concat(onLeave);
    blocks.push(...createOnLeaveBlocks(onLeaveMembers));

    return {
      text: `Daily Standup — ${date}`,
      blocks,
    };
  }

  async formatLateResponseMessage(response) {
    const responseData = {
      userMention: getUserMention(response.user),
      yesterdayTasks: formatTasks(response.yesterdayTasks),
      todayTasks: formatTasks(response.todayTasks),
      blockers: response.blockers,
    };

    const blocks = createLateResponseBlocks(responseData);

    return {
      text: `Late Submission from ${getDisplayName(response.user)}`,
      blocks,
    };
  }

  async formatIndividualResponseMessage(response) {
    const responseData = {
      userMention: getUserMention(response.user),
      yesterdayTasks: formatTasks(response.yesterdayTasks),
      todayTasks: formatTasks(response.todayTasks),
      blockers: response.blockers,
    };

    return {
      text: `Standup from ${getDisplayName(response.user)}`,
      blocks: createUserResponseBlocks(responseData),
    };
  }

  async postTeamStandup(team, date, slackApp) {
    const existingPost = await this.getStandupPost(team.id, date);
    if (existingPost && existingPost.slackMessageTs) {
      logger.info(
        `postTeamStandup skipped — already posted for team=${team.id} date=${dayjs(date).format("YYYY-MM-DD")} ts=${existingPost.slackMessageTs}`
      );
      return { skipped: true, post: existingPost };
    }

    const targetDate = dayjs(date).tz(team.timezone);

    // Check if it's a working day for the organization (general check)
    const isOrgWorkingDay = await isWorkingDay(
      targetDate.toDate(),
      team.organizationId
    );
    if (!isOrgWorkingDay) return;

    // Get all responses (filtered by individual work days)
    const responses = await this.getTeamResponses(team.id, targetDate.toDate());
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

    // Check if all active members have disabled reminders and no standups submitted
    const respondedUserIds = new Set(responses.map((r) => r.userId));
    const leaveUserIds = new Set(membersOnLeave.map((m) => m.userId));

    // Get members who are active, not on leave, and not admins
    const eligibleMembers = allMembers.filter(
      (m) => !leaveUserIds.has(m.userId) && m.role !== "ADMIN"
    );

    // Get members who would be shown in the standup (not hidden from mentions)
    const visibleMembers = eligibleMembers.filter(
      (m) => !m.hideFromNotResponded
    );

    // Skip posting when nobody submitted and every eligible member is hidden
    // from the "not responded" list (hideFromNotResponded) — the post would
    // contain nothing. Note: a second check here previously tested
    // `eligibleMembers.every((m) => m.hideFromNotResponded)` under a comment
    // about "disabled reminders"; that condition is equivalent to
    // `visibleMembers.length === 0` and was unreachable dead code.
    if (visibleMembers.length === 0 && responses.length === 0) {
      logger.info(
        `⏭️ Skipping standup post for team ${team.name} - no visible members and no standup submissions`
      );
      return;
    }

    // Calculate not submitted (exclude admins and those who opted out)
    const notSubmitted = allMembers
      .filter(
        (m) =>
          !respondedUserIds.has(m.userId) &&
          !leaveUserIds.has(m.userId) &&
          m.role !== "ADMIN" &&
          !m.hideFromNotResponded
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
      logger.info(`📤 Posting standup message for team ${team.name}...`);
      const result = await slackApp.client.chat.postMessage({
        channel: team.slackChannelId,
        ...message,
      });

      logger.info(
        `✅ Message posted successfully with timestamp: ${result.ts}`
      );
      logger.info(`💾 Saving standup post to database...`);

      // Save message timestamp for threading late responses
      try {
        const savedPost = await this.saveStandupPost(
          team.id,
          targetDate.toDate(),
          result.ts,
          team.slackChannelId
        );
        logger.info(
          `✅ Standup post saved successfully with ID: ${savedPost.id}`
        );
      } catch (saveError) {
        logger.error(
          `❌ Failed to save standup post for team ${team.name}:`,
          saveError
        );
        // Don't throw here - we still want to try posting late responses
      }

      // Post any existing late responses as threaded replies
      logger.info(`📝 Checking for late responses...`);
      try {
        await this.postLateResponses(team, targetDate.toDate(), slackApp);
      } catch (lateResponseError) {
        logger.error(
          `❌ Failed to post late responses for team ${team.name}:`,
          lateResponseError
        );
        // Don't throw here either - the main post was successful
      }

      return result;
    } catch (error) {
      logger.error(
        `❌ Failed to post standup for team ${team.name}:`,
        error,
        team
      );
      throw error;
    }
  }

  async postStandupOnDemand(team, date, slackApp) {
    try {
      const targetDate = dayjs(date).tz(team.timezone);

      // Get all responses for this date (both late and on-time)
      const allResponses = await prisma.standupResponse.findMany({
        where: {
          teamId: team.id,
          standupDate: {
            gte: targetDate.startOf("day").toDate(),
            lte: targetDate.endOf("day").toDate(),
          },
        },
        include: {
          user: true,
        },
        orderBy: {
          submittedAt: "asc",
        },
      });

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

      const respondedUserIds = new Set(allResponses.map((r) => r.userId));
      const leaveUserIds = new Set(membersOnLeave.map((m) => m.userId));

      // Calculate not submitted (exclude admins and those who opted out)
      const notSubmitted = allMembers
        .filter(
          (m) =>
            !respondedUserIds.has(m.userId) &&
            !leaveUserIds.has(m.userId) &&
            m.role !== "ADMIN" &&
            !m.hideFromNotResponded
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
        allResponses,
        notSubmitted,
        onLeave,
        targetDate
      );

      logger.info(
        `📤 Posting on-demand standup message for team ${team.name}...`
      );
      const result = await slackApp.client.chat.postMessage({
        channel: team.slackChannelId,
        ...message,
      });

      logger.info(
        `✅ Message posted successfully with timestamp: ${result.ts}`
      );

      // Save message timestamp for threading future late responses
      await this.saveStandupPost(
        team.id,
        targetDate.toDate(),
        result.ts,
        team.slackChannelId
      );

      return result;
    } catch (error) {
      logger.error(
        `❌ Failed to post on-demand standup for team ${team.name}:`,
        error
      );
      throw error;
    }
  }

  async postLateResponses(team, date, slackApp) {
    try {
      // Get the standup post for threading
      const standupPost = await this.getStandupPost(team.id, date);
      if (!standupPost || !standupPost.slackMessageTs) {
        logger.info(
          `No standup post found for team ${team.name} on ${dayjs(date).format(
            "YYYY-MM-DD"
          )}`
        );
        return;
      }

      // Get late responses
      const lateResponses = await this.getLateResponses(team.id, date);

      for (const response of lateResponses) {
        const message = await this.formatLateResponseMessage(response);

        await slackApp.client.chat.postMessage({
          channel: standupPost.channelId,
          thread_ts: standupPost.slackMessageTs,
          reply_broadcast: true, // Send to channel flag - makes the threaded reply visible in the channel
          ...message,
        });
      }

      if (lateResponses.length > 0) {
        logger.info(
          `✅ Posted ${lateResponses.length} late responses for team ${team.name}`
        );
      }
    } catch (error) {
      logger.error(
        `Failed to post late responses for team ${team.name}:`,
        error
      );
      throw error;
    }
  }

  async postIndividualResponse(team, date, response, slackApp) {
    try {
      // Ensure a team standup thread exists; auto-create it if missing.
      let standupPost = await this.getStandupPost(team.id, date);
      if (!standupPost || !standupPost.slackMessageTs) {
        await this.postTeamStandup(team, date, slackApp);
        standupPost = await this.getStandupPost(team.id, date);
      }

      if (!standupPost || !standupPost.slackMessageTs) {
        throw new Error(
          "Could not find or create a standup thread to post into"
        );
      }

      const message = await this.formatIndividualResponseMessage(response);

      const result = await slackApp.client.chat.postMessage({
        channel: standupPost.channelId,
        thread_ts: standupPost.slackMessageTs,
        reply_broadcast: true,
        ...message,
      });

      logger.info(
        `✅ Posted individual standup for ${getDisplayName(
          response.user
        )} in team ${team.name}`
      );

      return { ts: result.ts, channel: standupPost.channelId };
    } catch (error) {
      logger.error(
        `Failed to post individual standup for team ${team.name}:`,
        error
      );
      throw error;
    }
  }
}

module.exports = new StandupService();
