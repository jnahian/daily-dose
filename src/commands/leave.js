const userService = require("../services/userService");
const prisma = require("../config/prisma");
const dayjs = require("dayjs");
const { ackWithProcessing } = require("../utils/commandHelper");
const { createSectionBlock } = require("../utils/blockHelper");

async function setLeave({ command, ack, respond, client }) {
  const updateResponse = ackWithProcessing(
    ack,
    respond,
    "Setting leave...",
    command
  );

  try {
    // Parse command text: /dd-leave-set 2024-12-25 [2024-12-26] [Holiday break]
    const parts = command.text.split(" ");

    if (parts.length < 1 || !parts[0]) {
      await updateResponse({
        text: "❌ Usage: `/dd-leave-set YYYY-MM-DD [YYYY-MM-DD] [reason]`\nExamples:\n- Single day: `/dd-leave-set 2024-12-25 Holiday`\n- Date range: `/dd-leave-set 2024-12-25 2024-12-26 Holiday break`",
      });
      return;
    }

    const startDate = dayjs(parts[0]);

    if (!startDate.isValid()) {
      await updateResponse({
        text: "❌ Invalid start date format. Use YYYY-MM-DD",
      });
      return;
    }

    // Check if second parameter is a date or part of the reason
    let endDate = startDate; // Default to same day for single date
    let reasonStartIndex = 1;

    if (parts.length > 1) {
      const potentialEndDate = dayjs(parts[1]);
      if (potentialEndDate.isValid()) {
        // Second parameter is a valid date, use it as end date
        endDate = potentialEndDate;
        reasonStartIndex = 2;

        if (startDate > endDate) {
          await updateResponse({
            text: "❌ Start date must be before or equal to end date",
          });
          return;
        }
      }
      // If second parameter is not a valid date, treat it as part of reason
    }

    const reason = parts.slice(reasonStartIndex).join(" ") || "Personal leave";

    await userService.setLeave(
      command.user_id,
      startDate.toDate(),
      endDate.toDate(),
      reason,
      client
    );

    const dateText = startDate.isSame(endDate, "day")
      ? `on ${startDate.format("MMM DD, YYYY")}`
      : `from ${startDate.format("MMM DD, YYYY")} to ${endDate.format(
          "MMM DD, YYYY"
        )}`;

    await updateResponse({
      text: `✅ Leave set ${dateText}\nReason: ${reason}`,
    });
  } catch (error) {
    await updateResponse({
      text: `❌ Error: ${error.message}`,
    });
  }
}

async function cancelLeave({ command, ack, respond }) {
  const updateResponse = ackWithProcessing(
    ack,
    respond,
    "Cancelling leave...",
    command
  );

  try {
    const leaveId = command.text.trim();

    if (!leaveId) {
      await updateResponse({
        text: "❌ Usage: `/dd-leave-cancel [leave-id]`\nUse `/dd-leave-list` to see your leaves",
      });
      return;
    }

    await userService.cancelLeave(command.user_id, leaveId);

    await updateResponse({
      text: "✅ Leave cancelled successfully",
    });
  } catch (error) {
    await updateResponse({
      text: `❌ Error: ${error.message}`,
    });
  }
}

async function listLeaves({ command, ack, respond, client }) {
  const updateResponse = ackWithProcessing(
    ack,
    respond,
    "Loading leaves...",
    command
  );

  try {
    const userData = await userService.fetchSlackUserData(
      command.user_id,
      client
    );
    const user = await userService.findOrCreateUser(command.user_id, userData);

    const leaves = await prisma.leave.findMany({
      where: {
        userId: user.id,
        endDate: { gte: dayjs().toDate() }, // Only show current and future leaves
      },
      orderBy: {
        startDate: "asc",
      },
    });

    if (leaves.length === 0) {
      await updateResponse({
        text: "📅 You have no upcoming leaves scheduled",
      });
      return;
    }

    const leaveList = leaves
      .map((leave) => {
        const startDate = dayjs(leave.startDate).format("MMM DD, YYYY");
        const endDate = dayjs(leave.endDate).format("MMM DD, YYYY");
        const dateRange =
          startDate === endDate ? startDate : `${startDate} - ${endDate}`;
        return `- ${dateRange}: ${
          leave.reason || "No reason"
        } (ID: ${leave.id.slice(0, 8)})`;
      })
      .join("\n");

    await updateResponse({
      blocks: [
        createSectionBlock(`*📅 Your Upcoming Leaves:*\n${leaveList}`),
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "To cancel a leave, use: `/dd-leave-cancel [leave-id]`",
            },
          ],
        },
      ],
    });
  } catch (error) {
    await updateResponse({
      text: `❌ Error: ${error.message}`,
    });
  }
}

async function setWorkDays({ command, ack, respond, client }) {
  const updateResponse = ackWithProcessing(
    ack,
    respond,
    "Setting work days...",
    command
  );

  try {
    // Parse command text: /dd-workdays-set 1,2,3,4,5 (Mon-Fri)
    const workDaysText = command.text.trim();

    if (!workDaysText) {
      await updateResponse({
        text: "❌ Usage: `/dd-workdays-set 1,2,3,4,7`\nNumbers: 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday, 7=Sunday\nExample: `/dd-workdays-set 1,2,3,4,7` for Monday-Thursday, Sunday",
      });
      return;
    }

    // Parse work days
    const workDays = workDaysText.split(",").map((day) => {
      const num = parseInt(day.trim());
      if (isNaN(num) || num < 1 || num > 7) {
        throw new Error(`Invalid day: ${day}. Use numbers 1-7`);
      }
      return num;
    });

    if (workDays.length === 0) {
      throw new Error("At least one work day must be specified");
    }

    await userService.setWorkDays(command.user_id, workDays, client);

    const dayNames = {
      1: "Monday",
      2: "Tuesday",
      3: "Wednesday",
      4: "Thursday",
      5: "Friday",
      6: "Saturday",
      7: "Sunday",
    };

    const workDayNames = workDays.map((day) => dayNames[day]).join(", ");

    await updateResponse({
      text: `✅ Your work days have been set to: ${workDayNames}`,
    });
  } catch (error) {
    await updateResponse({
      text: `❌ Error: ${error.message}`,
    });
  }
}

async function showWorkDays({ command, ack, respond, client }) {
  const updateResponse = ackWithProcessing(
    ack,
    respond,
    "Loading work days...",
    command
  );

  try {
    const workDays = await userService.getWorkDays(command.user_id);

    if (!workDays) {
      await updateResponse({
        text: "❌ Unable to retrieve work days",
      });
      return;
    }

    const dayNames = {
      1: "Monday",
      2: "Tuesday",
      3: "Wednesday",
      4: "Thursday",
      5: "Friday",
      6: "Saturday",
      7: "Sunday",
    };

    const workDayNames = workDays.map((day) => dayNames[day]).join(", ");

    const userData = await userService.fetchSlackUserData(
      command.user_id,
      client
    );

    // Check if using personal or organization default
    const user = await userService.findOrCreateUser(command.user_id, userData);
    const userWorkDays = await prisma.user.findUnique({
      where: { id: user.id },
      select: { workDays: true },
    });

    const isPersonal = userWorkDays?.workDays !== null;

    await updateResponse({
      blocks: [
        createSectionBlock(`*📅 Your Work Days:* ${workDayNames}`),
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: isPersonal
                ? "Using personal settings"
                : "Using organization default",
            },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "To change your work days, use: `/dd-workdays-set 1,2,3,4,7`",
          },
        },
      ],
    });
  } catch (error) {
    await updateResponse({
      text: `❌ Error: ${error.message}`,
    });
  }
}

module.exports = {
  setLeave,
  cancelLeave,
  listLeaves,
  setWorkDays,
  showWorkDays,
};
