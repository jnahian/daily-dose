const userService = require("../services/userService");
const prisma = require("../config/prisma");
const dayjs = require("dayjs");

async function setLeave({ command, ack, respond }) {
  await ack();

  try {
    // Parse command text: /dd-leave-set 2024-12-25 2024-12-26 Holiday break
    const parts = command.text.split(" ");

    if (parts.length < 2) {
      await respond({
        text: "❌ Usage: `/dd-leave-set YYYY-MM-DD YYYY-MM-DD [reason]`\nExample: `/dd-leave-set 2024-12-25 2024-12-26 Holiday break`",
      });
      return;
    }

    const startDate = dayjs(parts[0]);
    const endDate = dayjs(parts[1]);
    const reason = parts.slice(2).join(" ") || "Personal leave";

    if (!startDate.isValid() || !endDate.isValid()) {
      await respond({
        text: "❌ Invalid date format. Use YYYY-MM-DD",
      });
      return;
    }

    if (startDate > endDate) {
      await respond({
        text: "❌ Start date must be before or equal to end date",
      });
      return;
    }

    await userService.setLeave(
      command.user_id,
      startDate.toJSDate(),
      endDate.toJSDate(),
      reason
    );

    await respond({
      text: `✅ Leave set from ${startDate.format(
        "MMM dd, yyyy"
      )} to ${endDate.format("MMM dd, yyyy")}\nReason: ${reason}`,
    });
  } catch (error) {
    await respond({
      text: `❌ Error: ${error.message}`,
    });
  }
}

async function cancelLeave({ command, ack, respond }) {
  await ack();

  try {
    const leaveId = command.text.trim();

    if (!leaveId) {
      await respond({
        text: "❌ Usage: `/dd-leave-cancel [leave-id]`\nUse `/dd-leave-list` to see your leaves",
      });
      return;
    }

    await userService.cancelLeave(command.user_id, leaveId);

    await respond({
      text: "✅ Leave cancelled successfully",
    });
  } catch (error) {
    await respond({
      text: `❌ Error: ${error.message}`,
    });
  }
}

async function listLeaves({ command, ack, respond }) {
  await ack();

  try {
    const user = await userService.findOrCreateUser(command.user_id);

    const leaves = await prisma.leave.findMany({
      where: {
        userId: user.id,
        endDate: { gte: new Date() }, // Only show current and future leaves
      },
      orderBy: {
        startDate: "asc",
      },
    });

    if (leaves.length === 0) {
      await respond({
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
        return `• ${dateRange}: ${
          leave.reason || "No reason"
        } (ID: ${leave.id.slice(0, 8)})`;
      })
      .join("\n");

    await respond({
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*📅 Your Upcoming Leaves:*\n${leaveList}`,
          },
        },
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
    await respond({
      text: `❌ Error: ${error.message}`,
    });
  }
}

async function setWorkDays({ command, ack, respond }) {
  await ack();

  try {
    // Parse command text: /dd-workdays-set 1,2,3,4,5 (Mon-Fri)
    const workDaysText = command.text.trim();

    if (!workDaysText) {
      await respond({
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

    await userService.setWorkDays(command.user_id, workDays);

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

    await respond({
      text: `✅ Your work days have been set to: ${workDayNames}`,
    });
  } catch (error) {
    await respond({
      text: `❌ Error: ${error.message}`,
    });
  }
}

async function showWorkDays({ command, ack, respond }) {
  await ack();

  try {
    const workDays = await userService.getWorkDays(command.user_id);

    if (!workDays) {
      await respond({
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

    // Check if using personal or organization default
    const user = await userService.findOrCreateUser(command.user_id);
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { workDays: true },
    });

    const isPersonal = userData?.workDays !== null;

    await respond({
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*📅 Your Work Days:* ${workDayNames}`,
          },
        },
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
    await respond({
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
