const { z } = require("zod");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const customParseFormat = require("dayjs/plugin/customParseFormat");
const prisma = require("../config/prisma");
const { resolveTeam } = require("./teamResolver");
const { canManageTeam } = require("../utils/permissionHelper");
const { resolveMember } = require("./memberResolver");
const standupService = require("../services/standupService");
const teamService = require("../services/teamService");
const schedulerService = require("../services/schedulerService");

// Extend the plugins this module relies on directly — do not depend on another
// module's import side-effects (which won't run when that module is mocked).
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertValidDate(date) {
  if (!DATE_RE.test(date) || !dayjs(date, "YYYY-MM-DD", true).isValid()) {
    throw new Error(`Invalid date "${date}". Use YYYY-MM-DD format.`);
  }
}

/**
 * Plain async tool handlers bound to a specific user + Slack client.
 * Each throws Error on failure (the MCP layer converts to a tool error).
 */
function buildToolHandlers(user, slackClient) {
  async function resolveOrThrow(identifier) {
    const { team, error } = await resolveTeam(user.slackUserId, identifier);
    if (error) throw new Error(error);
    return team;
  }

  async function requireManageTeam(teamId) {
    const perm = await canManageTeam(user.id, teamId);
    if (!perm.canManage) {
      throw new Error(
        perm.reason || "You don't have permission to manage this team."
      );
    }
  }

  return {
    async list_my_teams() {
      const memberships = await prisma.teamMember.findMany({
        where: {
          isActive: true,
          team: { isActive: true },
          user: { slackUserId: user.slackUserId },
        },
        include: { team: true },
      });
      return memberships.map((m) => ({
        id: m.team.id,
        name: m.team.name,
        role: m.role,
      }));
    },

    async submit_standup({
      team,
      yesterdayTasks = "",
      todayTasks = "",
      blockers = "",
    }) {
      if (!yesterdayTasks && !todayTasks && !blockers) {
        throw new Error(
          "Provide at least one field (yesterdayTasks, todayTasks, or blockers)."
        );
      }
      const resolved = await resolveOrThrow(team);
      const full = await teamService.getTeamById(resolved.id);
      const { isLate } = await standupService.submitStandup({
        team: full,
        slackUserId: user.slackUserId,
        name: user.name || user.slackUserId,
        fields: { yesterdayTasks, todayTasks, blockers },
        standupDate: dayjs().tz(full.timezone).toDate(),
        isUpdate: false,
        slackClient,
      });
      return {
        team: resolved.name,
        date: dayjs().tz(full.timezone).format("YYYY-MM-DD"),
        isLate,
      };
    },

    async update_standup({
      team,
      date,
      yesterdayTasks = "",
      todayTasks = "",
      blockers = "",
    }) {
      assertValidDate(date);
      if (!yesterdayTasks && !todayTasks && !blockers) {
        throw new Error(
          "Provide at least one field (yesterdayTasks, todayTasks, or blockers)."
        );
      }
      const resolved = await resolveOrThrow(team);
      const full = await teamService.getTeamById(resolved.id);
      const { isLate } = await standupService.submitStandup({
        team: full,
        slackUserId: user.slackUserId,
        name: user.name || user.slackUserId,
        fields: { yesterdayTasks, todayTasks, blockers },
        standupDate: dayjs(date, "YYYY-MM-DD").toDate(),
        isUpdate: true,
        slackClient,
      });
      return { team: resolved.name, date, isLate };
    },

    async get_my_standup_history({ startDate, endDate } = {}) {
      if (startDate) assertValidDate(startDate);
      if (endDate) assertValidDate(endDate);
      const end = endDate || dayjs().format("YYYY-MM-DD");
      const start =
        startDate || dayjs(end).subtract(7, "day").format("YYYY-MM-DD");
      const rows = await standupService.getUserStandupHistory(
        user.slackUserId,
        start,
        end
      );
      return rows.map((r) => ({
        date: dayjs(r.standupDate).format("YYYY-MM-DD"),
        team: r.team?.name,
        yesterdayTasks: r.yesterdayTasks || "",
        todayTasks: r.todayTasks || "",
        blockers: r.blockers || "",
        isLate: r.isLate,
      }));
    },

    async get_team_standup({ team, date }) {
      if (date) assertValidDate(date);
      const resolved = await resolveOrThrow(team);
      await requireManageTeam(resolved.id);

      const targetDate = date
        ? dayjs(date, "YYYY-MM-DD").toDate()
        : dayjs().tz(resolved.timezone).toDate();

      // Use the same full-day overlap window that getActiveMembers uses to
      // exclude on-leave members, so this query is its exact complement.
      // (A point-in-time predicate would drop members on the last day of a
      // leave from both lists — they'd vanish from the output entirely.)
      const startOfDay = dayjs(targetDate).startOf("day").toDate();
      const endOfDay = dayjs(targetDate).endOf("day").toDate();

      const onTime = await standupService.getTeamResponses(
        resolved.id,
        targetDate
      );
      const late = await standupService.getLateResponses(
        resolved.id,
        targetDate
      );
      const activeMembers = await standupService.getActiveMembers(
        resolved.id,
        targetDate
      );
      const onLeaveMembers = await prisma.teamMember.findMany({
        where: {
          teamId: resolved.id,
          isActive: true,
          user: {
            leaves: {
              some: {
                startDate: { lte: endOfDay },
                endDate: { gte: startOfDay },
              },
            },
          },
        },
        include: { user: true },
      });

      const responses = [...onTime, ...late]
        .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt))
        .map((r) => ({
          slackUserId: r.user.slackUserId,
          name: r.user.name,
          yesterdayTasks: r.yesterdayTasks || "",
          todayTasks: r.todayTasks || "",
          blockers: r.blockers || "",
          isLate: r.isLate,
          submittedAt: dayjs(r.submittedAt).toISOString(),
        }));

      const respondedUserIds = new Set(
        [...onTime, ...late].map((r) => r.userId)
      );
      const leaveUserIds = new Set(onLeaveMembers.map((m) => m.userId));

      const notSubmitted = activeMembers
        .filter(
          (m) => !respondedUserIds.has(m.userId) && !leaveUserIds.has(m.userId)
        )
        .map((m) => ({ slackUserId: m.user.slackUserId, name: m.user.name }));

      const onLeave = onLeaveMembers.map((m) => ({
        slackUserId: m.user.slackUserId,
        name: m.user.name,
      }));

      return {
        team: resolved.name,
        date: dayjs(targetDate).format("YYYY-MM-DD"),
        responses,
        notSubmitted,
        onLeave,
      };
    },

    async get_member_standup({ team, member, date }) {
      if (date) assertValidDate(date);
      const resolved = await resolveOrThrow(team);
      await requireManageTeam(resolved.id);

      const { member: targetUser, error } = await resolveMember(
        resolved.id,
        member
      );
      if (error) throw new Error(error);

      const targetDate = date
        ? dayjs(date, "YYYY-MM-DD").toDate()
        : dayjs().tz(resolved.timezone).toDate();

      const response = await standupService.getUserResponse(
        resolved.id,
        targetUser.id,
        targetDate
      );

      return {
        team: resolved.name,
        date: dayjs(targetDate).format("YYYY-MM-DD"),
        member: { slackUserId: targetUser.slackUserId, name: targetUser.name },
        response: response
          ? {
              yesterdayTasks: response.yesterdayTasks || "",
              todayTasks: response.todayTasks || "",
              blockers: response.blockers || "",
              isLate: response.isLate,
              submittedAt: dayjs(response.submittedAt).toISOString(),
            }
          : null,
      };
    },

    async post_team_standup({ team, date }) {
      if (date) assertValidDate(date);
      const resolved = await resolveOrThrow(team);
      await requireManageTeam(resolved.id);

      const targetDate = date
        ? dayjs(date, "YYYY-MM-DD").toDate()
        : dayjs().tz(resolved.timezone).toDate();
      const dateLabel = dayjs(targetDate).format("YYYY-MM-DD");

      // Guard: never post an empty summary to a channel (mirrors /dd-standup-post).
      const onTime = await standupService.getTeamResponses(
        resolved.id,
        targetDate
      );
      const late = await standupService.getLateResponses(
        resolved.id,
        targetDate
      );
      if (onTime.length === 0 && late.length === 0) {
        throw new Error(
          `No standup responses for ${dateLabel} — nothing to post.`
        );
      }

      const result = await standupService.postTeamStandup(
        resolved,
        targetDate,
        {
          client: slackClient,
        }
      );

      if (result?.skipped) {
        return {
          team: resolved.name,
          date: dateLabel,
          posted: false,
          skipped: true,
          messageTs: result.post?.slackMessageTs,
        };
      }
      if (!result) {
        throw new Error(
          `${dateLabel} is not a working day for this organization.`
        );
      }
      return {
        team: resolved.name,
        date: dateLabel,
        posted: true,
        messageTs: result.ts,
      };
    },

    async post_member_standup({ team, member, date }) {
      if (date) assertValidDate(date);
      const resolved = await resolveOrThrow(team);
      await requireManageTeam(resolved.id);

      const { member: targetUser, error } = await resolveMember(
        resolved.id,
        member
      );
      if (error) throw new Error(error);

      const targetDate = date
        ? dayjs(date, "YYYY-MM-DD").toDate()
        : dayjs().tz(resolved.timezone).toDate();
      const dateLabel = dayjs(targetDate).format("YYYY-MM-DD");

      const response = await standupService.getUserResponse(
        resolved.id,
        targetUser.id,
        targetDate
      );
      if (!response) {
        throw new Error(
          `${targetUser.name || targetUser.slackUserId} has no standup for ${dateLabel}.`
        );
      }

      const result = await standupService.postIndividualResponse(
        resolved,
        targetDate,
        response,
        { client: slackClient }
      );

      return {
        team: resolved.name,
        date: dateLabel,
        member: { slackUserId: targetUser.slackUserId, name: targetUser.name },
        posted: true,
        messageTs: result.ts,
        channel: result.channel,
      };
    },

    async send_standup_reminders({ team }) {
      const resolved = await resolveOrThrow(team);
      await requireManageTeam(resolved.id);
      await schedulerService.sendStandupReminders(resolved);
      return { team: resolved.name, status: "Standup reminders sent." };
    },

    async send_followup_reminders({ team }) {
      const resolved = await resolveOrThrow(team);
      await requireManageTeam(resolved.id);
      await schedulerService.sendFollowupReminders(resolved);
      return { team: resolved.name, status: "Followup reminders sent." };
    },
  };
}

const TEAM_FIELD = z
  .string()
  .describe("Team name (case-insensitive) or team id");

/**
 * Register Phase 1 tools onto an McpServer. Each tool returns its data as a
 * JSON string in a text content block.
 */
function registerTools(server, user, slackClient) {
  const handlers = buildToolHandlers(user, slackClient);
  const json = (data) => ({
    content: [{ type: "text", text: JSON.stringify(data) }],
  });
  const fail = (err) => ({
    content: [{ type: "text", text: `Error: ${err.message}` }],
    isError: true,
  });

  server.registerTool(
    "list_my_teams",
    {
      title: "List my teams",
      description: "List the teams you belong to, with your role.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        return json(await handlers.list_my_teams({}));
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "submit_standup",
    {
      title: "Submit standup",
      description:
        "Submit today's standup for a team. At least one field is required.",
      inputSchema: z.object({
        team: TEAM_FIELD,
        yesterdayTasks: z.string().optional(),
        todayTasks: z.string().optional(),
        blockers: z.string().optional(),
      }),
    },
    async (args) => {
      try {
        return json(await handlers.submit_standup(args));
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "update_standup",
    {
      title: "Update standup",
      description:
        "Submit or update a standup for a specific date (YYYY-MM-DD).",
      inputSchema: z.object({
        team: TEAM_FIELD,
        date: z.string().describe("YYYY-MM-DD"),
        yesterdayTasks: z.string().optional(),
        todayTasks: z.string().optional(),
        blockers: z.string().optional(),
      }),
    },
    async (args) => {
      try {
        return json(await handlers.update_standup(args));
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "get_my_standup_history",
    {
      title: "Get my standup history",
      description:
        "Return your standup submissions. Defaults to the last 7 days.",
      inputSchema: z.object({
        startDate: z.string().optional().describe("YYYY-MM-DD"),
        endDate: z.string().optional().describe("YYYY-MM-DD"),
      }),
    },
    async (args) => {
      try {
        return json(await handlers.get_my_standup_history(args));
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "get_team_standup",
    {
      title: "Get team standup",
      description:
        "View a team's standup for a date: all responses (on-time and late), who hasn't submitted, and who's on leave. Requires team admin or owner.",
      inputSchema: z.object({
        team: TEAM_FIELD,
        date: z.string().optional().describe("YYYY-MM-DD; defaults to today"),
      }),
    },
    async (args) => {
      try {
        return json(await handlers.get_team_standup(args));
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "get_member_standup",
    {
      title: "Get member standup",
      description:
        "View one member's standup submission for a date. Identify the member by Slack id, name, or username. Requires team admin or owner.",
      inputSchema: z.object({
        team: TEAM_FIELD,
        member: z
          .string()
          .describe("Member's Slack user id, display name, or username"),
        date: z.string().optional().describe("YYYY-MM-DD; defaults to today"),
      }),
    },
    async (args) => {
      try {
        return json(await handlers.get_member_standup(args));
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "post_team_standup",
    {
      title: "Post team standup",
      description:
        "Post a team's standup summary for a date to its channel (includes late responses). Refuses if there are no responses. Requires team admin or owner.",
      inputSchema: z.object({
        team: TEAM_FIELD,
        date: z.string().optional().describe("YYYY-MM-DD; defaults to today"),
      }),
    },
    async (args) => {
      try {
        return json(await handlers.post_team_standup(args));
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "post_member_standup",
    {
      title: "Post member standup",
      description:
        "Post one member's standup submission as a threaded reply (creates the team thread if needed). Identify the member by Slack id, name, or username. Requires team admin or owner.",
      inputSchema: z.object({
        team: TEAM_FIELD,
        member: z
          .string()
          .describe("Member's Slack user id, display name, or username"),
        date: z.string().optional().describe("YYYY-MM-DD; defaults to today"),
      }),
    },
    async (args) => {
      try {
        return json(await handlers.post_member_standup(args));
      } catch (e) {
        return fail(e);
      }
    }
  );
  server.registerTool(
    "send_standup_reminders",
    {
      title: "Send standup reminders",
      description:
        "DM today's standup reminder to active team members who haven't opted out. Requires team admin or owner.",
      inputSchema: z.object({ team: TEAM_FIELD }),
    },
    async (args) => {
      try {
        return json(await handlers.send_standup_reminders(args));
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "send_followup_reminders",
    {
      title: "Send followup reminders",
      description:
        "DM a followup reminder to active team members who haven't submitted yet. Requires team admin or owner.",
      inputSchema: z.object({ team: TEAM_FIELD }),
    },
    async (args) => {
      try {
        return json(await handlers.send_followup_reminders(args));
      } catch (e) {
        return fail(e);
      }
    }
  );
}

module.exports = { buildToolHandlers, registerTools };
