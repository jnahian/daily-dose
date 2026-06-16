const { z } = require("zod");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const customParseFormat = require("dayjs/plugin/customParseFormat");
const prisma = require("../config/prisma");
const { resolveTeam } = require("./teamResolver");
const standupService = require("../services/standupService");
const teamService = require("../services/teamService");

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
}

module.exports = { buildToolHandlers, registerTools };
