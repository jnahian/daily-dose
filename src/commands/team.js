const teamService = require("../services/teamService");
const userService = require("../services/userService");
const schedulerService = require("../services/schedulerService");
const notificationService = require("../services/notificationService");
const { ackWithProcessing, getChannelName } = require("../utils/commandHelper");
const { getDisplayName } = require("../utils/userHelper");
const { formatTime12Hour } = require("../utils/dateHelper");
const {
  createSectionBlock,
  createCommandErrorBlocks,
  createTeamApprovalResultBlocks,
} = require("../utils/blockHelper");
const logger = require("../utils/logger");
const { parseTimeString } = require("../utils/timeHelper");
const { escapeSlackText } = require("../utils/messageHelper");
const { sanitizeError } = require("../utils/errorHelper");

function parseUserMention(token) {
  if (!token) return null;
  const match = token.match(/<@([A-Z0-9]+)(\|[^>]+)?>/);
  return match ? match[1] : null;
}

// Resolve a slash-command target token to a Slack user ID. Tries, in order:
//   1. Slack mention token `<@U123|name>` (active users autocompleted in chat)
//   2. Raw Slack user ID `U0123ABCD` / `W0123ABCD` (globally unique)
//   3. `@username` or `username` looked up against our DB, scoped to the
//      admin's organization
// (2) and (3) exist so admins can target users who've already been
// deactivated in Slack and can no longer be @-mentioned.
async function resolveTargetSlackUserId(token, organizationId) {
  if (!token) return null;

  const mentionId = parseUserMention(token);
  if (mentionId) return mentionId;

  if (/^[UW][A-Z0-9]{6,}$/i.test(token)) {
    return token.toUpperCase();
  }

  if (!organizationId) return null;
  const username = token.replace(/^@/, "").trim();
  if (!username) return null;

  const user = await userService.findUserByUsernameInOrg(
    username,
    organizationId
  );
  return user ? user.slackUserId : null;
}

async function createTeam({ command, ack, respond, client }) {
  const updateResponse = await ackWithProcessing(
    ack,
    respond,
    "Creating team...",
    command
  );

  try {
    // Parse command text: /dd-team-create [TeamName] HH:MM HH:MM
    const args = command.text.split(" ");
    let name, standupTime, postingTime;

    // Check if we have 2 or 3 arguments to determine if team name was provided
    if (args.length === 2) {
      // No team name provided, use channel name as default
      [standupTime, postingTime] = args;

      // Get channel name as team name
      try {
        name = await getChannelName(client, command.channel_id);
      } catch (error) {
        await updateResponse({
          text: error.message,
        });
        return;
      }
    } else if (args.length === 3) {
      // Team name provided
      [name, standupTime, postingTime] = args;
    } else {
      await updateResponse({
        blocks: createCommandErrorBlocks(
          "Usage: `/dd-team-create [TeamName] HH:MM HH:MM`",
          [
            "`/dd-team-create 09:30 10:00` (uses channel name)",
            "`/dd-team-create Engineering 09:30 10:00`",
          ]
        ),
      });
      return;
    }

    if (!standupTime || !postingTime) {
      await updateResponse({
        blocks: createCommandErrorBlocks(
          "Usage: `/dd-team-create [TeamName] HH:MM HH:MM`",
          [
            "`/dd-team-create 09:30 10:00` (uses channel name)",
            "`/dd-team-create Engineering 09:30 10:00`",
          ]
        ),
      });
      return;
    }

    let parsedStandup, parsedPosting;
    try {
      parsedStandup = parseTimeString(standupTime);
      parsedPosting = parseTimeString(postingTime);
    } catch (err) {
      await updateResponse({
        blocks: createCommandErrorBlocks(sanitizeError(err)),
      });
      return;
    }

    const { team, status, organization } = await teamService.createTeam(
      command.user_id,
      command.channel_id,
      {
        name,
        standupTime: parsedStandup.normalized,
        postingTime: parsedPosting.normalized,
      },
      command.team_id,
      client
    );

    if (status === "PENDING") {
      // Non-admin proposal: leave it unscheduled and ask org admins to approve.
      await notificationService.notifyOrgAdminsOfPendingTeam({
        team,
        organization,
        creatorSlackUserId: command.user_id,
        client,
      });

      await updateResponse({
        text: `⏳ Team "${escapeSlackText(name)}" has been submitted for approval.\n- Standup reminder: ${formatTime12Hour(
          parsedStandup.normalized
        )}\n- Posting time: ${formatTime12Hour(parsedPosting.normalized)}\n- Timezone: ${
          team.timezone
        }\nAn organization admin will review it shortly — standups start once it's approved.`,
      });
      return;
    }

    // Refresh the scheduler to include the new team
    await schedulerService.refreshTeamSchedule(team.id);

    await updateResponse({
      text: `✅ Team "${escapeSlackText(name)}" created successfully!\n- Standup reminder: ${formatTime12Hour(
        parsedStandup.normalized
      )}\n- Posting time: ${formatTime12Hour(parsedPosting.normalized)}\n- Timezone: ${
        team.timezone
      }\n- Cron jobs scheduled ✓`,
    });
  } catch (error) {
    await updateResponse({
      blocks: createCommandErrorBlocks(sanitizeError(error)),
    });
  }
}

async function joinTeam({ command, ack, respond, client }) {
  const updateResponse = await ackWithProcessing(
    ack,
    respond,
    "Joining team...",
    command
  );

  try {
    const teamName = command.text.trim();
    let team;

    if (!teamName) {
      // No team name provided, try to find team in current channel
      team = await teamService.findTeamByChannel(command.channel_id);

      if (!team) {
        await updateResponse({
          blocks: createCommandErrorBlocks("No team found in this channel.", [
            "Run `/dd-team-join [TeamName]` to join a specific team",
            "Or run `/dd-team-join` inside a team channel",
          ]),
        });
        return;
      }
    } else {
      // Find team by name across all organizations
      team = await teamService.findTeamByName(teamName);

      if (!team) {
        await updateResponse({
          blocks: createCommandErrorBlocks(`Team "${teamName}" not found`),
        });
        return;
      }
    }

    await teamService.joinTeam(command.user_id, team.id, client);

    await updateResponse({
      text: `✅ You've joined team "${
        team.name
      }"!\n- Standup reminder: ${formatTime12Hour(
        team.standupTime
      )}\n- Posting time: ${formatTime12Hour(team.postingTime)}\n-Timezone: ${
        team.timezone
      }`,
    });
  } catch (error) {
    await updateResponse({
      blocks: createCommandErrorBlocks(sanitizeError(error)),
    });
  }
}

async function leaveTeam({ command, ack, respond, client }) {
  const updateResponse = await ackWithProcessing(
    ack,
    respond,
    "Leaving team...",
    command
  );

  try {
    const teamName = command.text.trim();
    let team;

    if (!teamName) {
      // No team name provided, try to find team in current channel
      team = await teamService.findTeamByChannel(command.channel_id);

      if (!team) {
        await updateResponse({
          blocks: createCommandErrorBlocks("No team found in this channel.", [
            "Run `/dd-team-leave [TeamName]` to leave a specific team",
            "Or run `/dd-team-leave` inside a team channel",
          ]),
        });
        return;
      }
    } else {
      // Find team by name across all organizations
      team = await teamService.findTeamByName(teamName);

      if (!team) {
        await updateResponse({
          blocks: createCommandErrorBlocks(`Team "${teamName}" not found`),
        });
        return;
      }
    }

    await teamService.leaveTeam(command.user_id, team.id, client);

    await updateResponse({
      text: `✅ You've left team "${team.name}"`,
    });
  } catch (error) {
    await updateResponse({
      blocks: createCommandErrorBlocks(sanitizeError(error)),
    });
  }
}

async function listTeams({ command, ack, respond }) {
  const updateResponse = await ackWithProcessing(
    ack,
    respond,
    "Loading teams...",
    command
  );

  try {
    const { teams, scope, organization } = await teamService.listTeamsForUser(
      command.user_id
    );

    if (teams.length === 0) {
      const emptyText =
        scope === "all"
          ? "📋 No teams found in your organization"
          : "📋 You are not a member of any teams in this organization";
      await updateResponse({ text: emptyText });
      return;
    }

    const teamList = teams
      .map(
        (t) =>
          `• *${t.name}* (${
            t._count.members
          } members)\n  🔔 Reminder: ${formatTime12Hour(
            t.standupTime
          )} | 📊 Posting: ${formatTime12Hour(t.postingTime)} | 🌍 ${
            t.timezone
          }`
      )
      .join("\n\n");

    const heading =
      scope === "all"
        ? `*📋 Teams in ${organization.name}:*`
        : `*📋 Your teams:*`;

    await updateResponse({
      blocks: [createSectionBlock(`${heading}\n\n${teamList}`)],
    });
  } catch (error) {
    await updateResponse({
      blocks: createCommandErrorBlocks(sanitizeError(error)),
    });
  }
}

async function listMembers({ command, ack, respond }) {
  const updateResponse = await ackWithProcessing(
    ack,
    respond,
    "Loading team members...",
    command
  );

  try {
    const teamName = command.text.trim();
    let team;

    if (!teamName) {
      // No team name provided, try to find team in current channel
      team = await teamService.findTeamByChannel(command.channel_id);

      if (!team) {
        await updateResponse({
          blocks: createCommandErrorBlocks("No team found in this channel.", [
            "Run `/dd-team-members [TeamName]` to view a specific team",
            "Or run `/dd-team-members` inside a team channel",
          ]),
        });
        return;
      }
    } else {
      // Find team by name across all organizations
      team = await teamService.findTeamByName(teamName);

      if (!team) {
        await updateResponse({
          blocks: createCommandErrorBlocks(`Team "${teamName}" not found`),
        });
        return;
      }
    }

    // Get team members
    const members = await teamService.getTeamMembers(team.id);

    if (members.length === 0) {
      await updateResponse({
        text: `📋 No members found in team "${team.name}"`,
      });
      return;
    }

    const memberList = members
      .map((member) => {
        const roleIcon = member.role === "ADMIN" ? "👑" : "👤";
        const displayName = getDisplayName(member.user);
        return `${roleIcon} <@${
          member.user.slackUserId
        }> (${displayName}) - ${member.role.toLowerCase()}`;
      })
      .join("\n");

    await updateResponse({
      blocks: [
        createSectionBlock(
          `*👥 Members of team "${team.name}":*\n${memberList}`
        ),
      ],
    });
  } catch (error) {
    await updateResponse({
      blocks: createCommandErrorBlocks(sanitizeError(error)),
    });
  }
}

async function updateTeam({ command, ack, respond, client }) {
  const updateResponse = await ackWithProcessing(
    ack,
    respond,
    "Updating team...",
    command
  );

  try {
    // Parse command text: /dd-team-update [TeamName] [name=NewName] [standup=09:30] [posting=10:00]
    const args = command.text.split(" ");
    let team, startIndex;

    if (args.length === 0 || args[0] === "") {
      // No arguments provided, try to find team in current channel
      team = await teamService.findTeamByChannel(command.channel_id);
      startIndex = 0;

      if (!team) {
        await updateResponse({
          blocks: createCommandErrorBlocks("No team found in this channel.", [
            "Usage: `/dd-team-update [TeamName] [parameters]`",
            "Parameters: `name=NewName`, `standup=HH:MM`, `posting=HH:MM`, `notifications=true/false`",
            "Example: `/dd-team-update Engineering standup=09:00`",
          ]),
        });
        return;
      }
    } else {
      // Check if first argument contains = (it's a parameter, not team name)
      if (args[0].includes("=")) {
        // First argument is a parameter, try to find team in current channel
        team = await teamService.findTeamByChannel(command.channel_id);
        startIndex = 0;

        if (!team) {
          await updateResponse({
            blocks: createCommandErrorBlocks("No team found in this channel.", [
              "Provide team name: `/dd-team-update [TeamName] [parameters]`",
            ]),
          });
          return;
        }
      } else {
        // First argument is team name
        const teamName = args[0];
        team = await teamService.findTeamByName(teamName);
        startIndex = 1;

        if (!team) {
          await updateResponse({
            blocks: createCommandErrorBlocks(`Team "${teamName}" not found`),
          });
          return;
        }

        if (args.length < 2) {
          await updateResponse({
            blocks: createCommandErrorBlocks(
              "Usage: `/dd-team-update [TeamName] [parameters]`",
              [
                "Parameters: `name=NewName`, `standup=HH:MM`, `posting=HH:MM`, `notifications=true/false`",
                "Example: `/dd-team-update Engineering standup=09:00 posting=10:30 notifications=false`",
              ]
            ),
          });
          return;
        }
      }
    }

    // Parse update parameters
    const updateData = {};
    const updates = [];

    for (let i = startIndex; i < args.length; i++) {
      const [key, value] = args[i].split("=");
      if (!key || !value) {
        await updateResponse({
          blocks: createCommandErrorBlocks(
            `Invalid parameter format: ${args[i]}. Use key=value format.`
          ),
        });
        return;
      }

      switch (key.toLowerCase()) {
        case "name":
          updateData.name = value;
          updates.push(`Name: ${value}`);
          break;
        case "standup":
          try {
            updateData.standupTime = parseTimeString(value).normalized;
          } catch (err) {
            await updateResponse({
              blocks: createCommandErrorBlocks(sanitizeError(err)),
            });
            return;
          }
          updates.push(
            `Standup time: ${formatTime12Hour(updateData.standupTime)}`
          );
          break;
        case "posting":
          try {
            updateData.postingTime = parseTimeString(value).normalized;
          } catch (err) {
            await updateResponse({
              blocks: createCommandErrorBlocks(sanitizeError(err)),
            });
            return;
          }
          updates.push(
            `Posting time: ${formatTime12Hour(updateData.postingTime)}`
          );
          break;
        case "notifications":
          if (value !== "true" && value !== "false") {
            await updateResponse({
              blocks: createCommandErrorBlocks(
                `Invalid value for notifications: ${value}. Use true or false`
              ),
            });
            return;
          }
          updateData.receiveNotifications = value === "true";
          updates.push(
            `Admin notifications: ${value === "true" ? "enabled" : "disabled"}`
          );
          break;
        default:
          await updateResponse({
            blocks: createCommandErrorBlocks(
              `Unknown parameter: ${key}. Valid parameters: name, standup, posting, notifications`
            ),
          });
          return;
      }
    }

    if (Object.keys(updateData).length === 0) {
      await updateResponse({
        blocks: createCommandErrorBlocks("No valid updates provided"),
      });
      return;
    }

    await teamService.updateTeam(command.user_id, team.id, updateData, client);

    // If schedule-related updates were made, refresh the scheduler
    if (updateData.standupTime || updateData.postingTime) {
      await schedulerService.refreshTeamSchedule(team.id);
      updates.push("Cron jobs updated ✓");
    }

    await updateResponse({
      text: `✅ Team "${team.name}" updated successfully!\n- ${updates.join(
        "\n- "
      )}`,
    });
  } catch (error) {
    await updateResponse({
      blocks: createCommandErrorBlocks(sanitizeError(error)),
    });
  }
}

async function suspendTeamMember({ command, ack, respond, client }) {
  return handleTeamSuspension({ command, ack, respond, client, suspend: true });
}

async function unsuspendTeamMember({ command, ack, respond, client }) {
  return handleTeamSuspension({
    command,
    ack,
    respond,
    client,
    suspend: false,
  });
}

async function handleTeamSuspension({
  command,
  ack,
  respond,
  client,
  suspend,
}) {
  const action = suspend ? "Suspending" : "Reactivating";
  const verb = suspend ? "suspended" : "reactivated";
  const cmdName = suspend ? "/dd-team-suspend" : "/dd-team-unsuspend";

  const updateResponse = await ackWithProcessing(
    ack,
    respond,
    `${action} team member...`,
    command
  );

  try {
    const parts = command.text.trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
      await updateResponse({
        blocks: createCommandErrorBlocks(
          `Usage: \`${cmdName} @user [TeamName]\``,
          [
            `\`${cmdName} @john\` (uses current channel's team)`,
            `\`${cmdName} @john Engineering\``,
          ]
        ),
      });
      return;
    }

    const teamName = parts.slice(1).join(" ").trim();
    let team;
    if (teamName) {
      team = await teamService.findTeamByName(teamName);
      if (!team) {
        await updateResponse({
          blocks: createCommandErrorBlocks(`Team "${teamName}" not found`),
        });
        return;
      }
    } else {
      team = await teamService.findTeamByChannel(command.channel_id);
      if (!team) {
        await updateResponse({
          blocks: createCommandErrorBlocks("No team found in this channel.", [
            `Run \`${cmdName} @user [TeamName]\` to target a specific team`,
            `Or run \`${cmdName} @user\` inside a team channel`,
          ]),
        });
        return;
      }
    }

    const targetSlackUserId = await resolveTargetSlackUserId(
      parts[0],
      team.organizationId
    );
    if (!targetSlackUserId) {
      await updateResponse({
        blocks: createCommandErrorBlocks("Could not resolve target user.", [
          "Use `@user` mention (e.g., `@john`)",
          "Or pass the Slack user ID directly (e.g., `U0123ABCD`)",
          "Or pass the username for already-deactivated users (e.g., `@john` or `john`)",
        ]),
      });
      return;
    }

    await teamService.setTeamMemberActive(
      command.user_id,
      targetSlackUserId,
      team.id,
      !suspend,
      client
    );

    await updateResponse({
      text: `✅ <@${targetSlackUserId}> has been ${verb} ${
        suspend ? "from" : "in"
      } team "${team.name}".`,
    });
  } catch (error) {
    await updateResponse({
      blocks: createCommandErrorBlocks(sanitizeError(error)),
    });
  }
}

async function suspendOrgMember({ command, ack, respond, client }) {
  return handleOrgSuspension({ command, ack, respond, client, suspend: true });
}

async function unsuspendOrgMember({ command, ack, respond, client }) {
  return handleOrgSuspension({ command, ack, respond, client, suspend: false });
}

async function handleOrgSuspension({ command, ack, respond, client, suspend }) {
  const action = suspend ? "Suspending" : "Reactivating";
  const verb = suspend ? "suspended" : "reactivated";
  const cmdName = suspend ? "/dd-org-suspend" : "/dd-org-unsuspend";

  const updateResponse = await ackWithProcessing(
    ack,
    respond,
    `${action} organization member...`,
    command
  );

  try {
    const parts = command.text.trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
      await updateResponse({
        blocks: createCommandErrorBlocks(`Usage: \`${cmdName} @user\``, [
          `\`${cmdName} @john\``,
        ]),
      });
      return;
    }

    const adminOrg = await userService.getUserOrganization(command.user_id);
    const targetSlackUserId = await resolveTargetSlackUserId(
      parts[0],
      adminOrg ? adminOrg.id : null
    );
    if (!targetSlackUserId) {
      await updateResponse({
        blocks: createCommandErrorBlocks("Could not resolve target user.", [
          "Use `@user` mention (e.g., `@john`)",
          "Or pass the Slack user ID directly (e.g., `U0123ABCD`)",
          "Or pass the username for already-deactivated users (e.g., `@john` or `john`)",
        ]),
      });
      return;
    }

    const result = await userService.setOrganizationMemberActive(
      command.user_id,
      targetSlackUserId,
      !suspend,
      client
    );

    const detail = suspend
      ? `${result.teamMembershipsUpdated} active team membership(s) suspended.`
      : `Use \`/dd-team-unsuspend @user [TeamName]\` to restore team memberships.`;

    await updateResponse({
      text: `✅ <@${targetSlackUserId}> has been ${verb} ${
        suspend ? "from" : "in"
      } organization "${result.organization.name}". ${detail}`,
    });
  } catch (error) {
    await updateResponse({
      blocks: createCommandErrorBlocks(sanitizeError(error)),
    });
  }
}

async function promoteOrgMember({ command, ack, respond, client }) {
  const updateResponse = await ackWithProcessing(
    ack,
    respond,
    "Promoting member...",
    command
  );

  try {
    const parts = command.text.trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
      await updateResponse({
        blocks: createCommandErrorBlocks(
          "Usage: `/dd-org-promote @user [TeamName]`",
          [
            "`/dd-org-promote @john` — promote to organization admin",
            "`/dd-org-promote @john Engineering` — promote to team admin in Engineering",
          ]
        ),
      });
      return;
    }

    const teamName = parts.slice(1).join(" ").trim();
    const adminOrg = await userService.getUserOrganization(command.user_id);

    if (teamName && !adminOrg) {
      await updateResponse({
        blocks: createCommandErrorBlocks(
          "You must belong to an organization to promote a team member."
        ),
      });
      return;
    }

    const targetSlackUserId = await resolveTargetSlackUserId(
      parts[0],
      adminOrg ? adminOrg.id : null
    );
    if (!targetSlackUserId) {
      await updateResponse({
        blocks: createCommandErrorBlocks("Could not resolve target user.", [
          "Use `@user` mention (e.g., `@john`)",
          "Or pass the Slack user ID directly (e.g., `U0123ABCD`)",
          "Or pass the username (e.g., `@john` or `john`)",
        ]),
      });
      return;
    }

    if (teamName) {
      const team = await teamService.findTeamByName(teamName, adminOrg.id);
      if (!team) {
        await updateResponse({
          blocks: createCommandErrorBlocks(
            `Team "${teamName}" not found in your organization`
          ),
        });
        return;
      }

      const result = await teamService.promoteTeamMember(
        command.user_id,
        targetSlackUserId,
        team.id,
        client
      );

      await updateResponse({
        text: `✅ <@${targetSlackUserId}> has been promoted to team admin in "${result.team.name}".`,
      });
      return;
    }

    const result = await userService.promoteOrganizationMember(
      command.user_id,
      targetSlackUserId,
      client
    );

    await updateResponse({
      text: `✅ <@${targetSlackUserId}> has been promoted to organization admin in "${result.organization.name}".`,
    });
  } catch (error) {
    await updateResponse({
      blocks: createCommandErrorBlocks(sanitizeError(error)),
    });
  }
}

// Org admin clicks "Approve" on a pending-team request DM. Activates the team,
// schedules it, notifies the proposer, and replaces the request buttons.
async function approveTeam({ body, ack, client, respond }) {
  await ack();

  const teamId = body.actions[0].value;

  // Phase 1: the state change. Failures here mean nothing was mutated, so we
  // surface them to the admin.
  let team, creatorSlackUserId;
  try {
    ({ team, creatorSlackUserId } = await teamService.approveTeam(
      body.user.id,
      teamId,
      client
    ));
  } catch (error) {
    logger.error("Error approving team:", error);
    await respond({
      response_type: "ephemeral",
      replace_original: false,
      text: `⚠️ ${sanitizeError(error)}`,
    });
    return;
  }

  // Phase 2: best-effort Slack side effects. The approval already succeeded, so
  // log failures here instead of reporting the whole action as failed.
  try {
    await schedulerService.refreshTeamSchedule(team.id);

    if (creatorSlackUserId) {
      await client.chat.postMessage({
        channel: creatorSlackUserId,
        text: `✅ Your team "${escapeSlackText(team.name)}" was approved by <@${body.user.id}> and standups are now scheduled.`,
      });
    }

    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: `Approved team "${escapeSlackText(team.name)}"`,
      blocks: createTeamApprovalResultBlocks({
        teamName: team.name,
        channelId: team.slackChannelId,
        decidedBySlackUserId: body.user.id,
        approved: true,
      }),
    });
  } catch (error) {
    logger.error("Team approved but a follow-up Slack action failed:", error);
  }
}

// Org admin clicks "Reject" on a pending-team request DM. Deletes the proposed
// team, notifies the proposer, and replaces the request buttons.
async function rejectTeam({ body, ack, client, respond }) {
  await ack();

  const teamId = body.actions[0].value;

  // Phase 1: the state change. Failures here mean nothing was deleted, so we
  // surface them to the admin.
  let team, creatorSlackUserId;
  try {
    ({ team, creatorSlackUserId } = await teamService.rejectTeam(
      body.user.id,
      teamId,
      client
    ));
  } catch (error) {
    logger.error("Error rejecting team:", error);
    await respond({
      response_type: "ephemeral",
      replace_original: false,
      text: `⚠️ ${sanitizeError(error)}`,
    });
    return;
  }

  // Phase 2: best-effort Slack side effects. The rejection already succeeded, so
  // log failures here instead of reporting the whole action as failed.
  try {
    if (creatorSlackUserId) {
      await client.chat.postMessage({
        channel: creatorSlackUserId,
        text: `❌ Your team "${escapeSlackText(team.name)}" request was declined by <@${body.user.id}>. Reach out to an organization admin if you have questions.`,
      });
    }

    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: `Rejected team "${escapeSlackText(team.name)}"`,
      blocks: createTeamApprovalResultBlocks({
        teamName: team.name,
        channelId: team.slackChannelId,
        decidedBySlackUserId: body.user.id,
        approved: false,
      }),
    });
  } catch (error) {
    logger.error("Team rejected but a follow-up Slack action failed:", error);
  }
}

module.exports = {
  createTeam,
  approveTeam,
  rejectTeam,
  joinTeam,
  leaveTeam,
  listTeams,
  listMembers,
  updateTeam,
  suspendTeamMember,
  unsuspendTeamMember,
  suspendOrgMember,
  unsuspendOrgMember,
  promoteOrgMember,
};
