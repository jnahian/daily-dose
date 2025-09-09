const prisma = require("../config/prisma");
const userService = require("../services/userService");
const { ackWithProcessing } = require("../utils/commandHelper");
const dayjs = require("dayjs");

async function setHoliday({ command, ack, respond, client }) {
  const updateResponse = ackWithProcessing(
    ack,
    respond,
    "Setting holiday...",
    command
  );

  try {
    // Check admin permissions
    const userData = await userService.fetchSlackUserData(command.user_id, client);
    const user = await userService.findOrCreateUser(command.user_id, userData);
    const org = await userService.getUserOrganization(command.user_id);

    if (!org) {
      await updateResponse({
        text: "❌ You must belong to an organization to manage holidays",
      });
      return;
    }

    const canManage = await userService.canCreateTeam(user.id, org.id);
    if (!canManage) {
      await updateResponse({
        text: "❌ You need admin permissions to manage holidays",
      });
      return;
    }

    // Parse command: /dd-holiday-set YYYY-MM-DD [YYYY-MM-DD] [name]
    // Examples:
    // /dd-holiday-set 2024-12-25 Christmas Day
    // /dd-holiday-set 2024-12-24 2024-12-26 Christmas Holiday
    const args = command.text.trim().split(" ");
    
    if (args.length < 1 || !args[0]) {
      await updateResponse({
        text: "❌ Usage: `/dd-holiday-set YYYY-MM-DD [YYYY-MM-DD] [name]`\nExamples:\n- `/dd-holiday-set 2024-12-25 Christmas Day`\n- `/dd-holiday-set 2024-12-24 2024-12-26 Christmas Holiday`",
      });
      return;
    }

    const startDateStr = args[0];
    let endDateStr = null;
    let holidayName = "";

    // Check if second argument is a date (for date range) or part of name
    if (args.length > 1) {
      const secondArg = args[1];
      const isDate = /^\d{4}-\d{2}-\d{2}$/.test(secondArg);
      
      if (isDate) {
        endDateStr = secondArg;
        holidayName = args.slice(2).join(" ");
      } else {
        holidayName = args.slice(1).join(" ");
      }
    }

    // Validate start date
    const startDate = dayjs(startDateStr, "YYYY-MM-DD", true);
    if (!startDate.isValid()) {
      await updateResponse({
        text: `❌ Invalid start date format: ${startDateStr}. Use YYYY-MM-DD format.`,
      });
      return;
    }

    let endDate = startDate;
    if (endDateStr) {
      endDate = dayjs(endDateStr, "YYYY-MM-DD", true);
      if (!endDate.isValid()) {
        await updateResponse({
          text: `❌ Invalid end date format: ${endDateStr}. Use YYYY-MM-DD format.`,
        });
        return;
      }
      
      if (endDate.isBefore(startDate)) {
        await updateResponse({
          text: "❌ End date cannot be before start date",
        });
        return;
      }
    }

    // Create holiday records for each day in the range
    const holidayRecords = [];
    let currentDate = startDate;
    
    while (currentDate.isSameOrBefore(endDate)) {
      try {
        const holiday = await prisma.holiday.upsert({
          where: {
            date_country: {
              date: currentDate.toDate(),
              country: "US",
            },
          },
          update: {
            name: holidayName || `Holiday ${currentDate.format("YYYY-MM-DD")}`,
          },
          create: {
            date: currentDate.toDate(),
            name: holidayName || `Holiday ${currentDate.format("YYYY-MM-DD")}`,
            country: "US",
          },
        });
        holidayRecords.push(holiday);
      } catch (error) {
        console.error(`Error creating holiday for ${currentDate.format("YYYY-MM-DD")}:`, error);
      }
      
      currentDate = currentDate.add(1, "day");
    }

    if (holidayRecords.length === 0) {
      await updateResponse({
        text: "❌ Failed to create any holiday records",
      });
      return;
    }

    const dateRange = endDateStr 
      ? `${startDateStr} to ${endDateStr}` 
      : startDateStr;
    
    const displayName = holidayName || "Holiday";

    await updateResponse({
      text: `✅ Holiday "${displayName}" set for ${dateRange} (${holidayRecords.length} day${holidayRecords.length > 1 ? 's' : ''})`,
    });

  } catch (error) {
    console.error("Error setting holiday:", error);
    await updateResponse({
      text: `❌ Error: ${error.message}`,
    });
  }
}

async function updateHoliday({ command, ack, respond, client }) {
  const updateResponse = ackWithProcessing(
    ack,
    respond,
    "Updating holiday...",
    command
  );

  try {
    // Check admin permissions
    const userData = await userService.fetchSlackUserData(command.user_id, client);
    const user = await userService.findOrCreateUser(command.user_id, userData);
    const org = await userService.getUserOrganization(command.user_id);

    if (!org) {
      await updateResponse({
        text: "❌ You must belong to an organization to manage holidays",
      });
      return;
    }

    const canManage = await userService.canCreateTeam(user.id, org.id);
    if (!canManage) {
      await updateResponse({
        text: "❌ You need admin permissions to manage holidays",
      });
      return;
    }

    // Parse command: /dd-holiday-update YYYY-MM-DD new name
    const args = command.text.trim().split(" ");
    
    if (args.length < 2 || !args[0] || !args[1]) {
      await updateResponse({
        text: "❌ Usage: `/dd-holiday-update YYYY-MM-DD new name`\nExample: `/dd-holiday-update 2024-12-25 Christmas Day Updated`",
      });
      return;
    }

    const dateStr = args[0];
    const newName = args.slice(1).join(" ");

    // Validate date
    const date = dayjs(dateStr, "YYYY-MM-DD", true);
    if (!date.isValid()) {
      await updateResponse({
        text: `❌ Invalid date format: ${dateStr}. Use YYYY-MM-DD format.`,
      });
      return;
    }

    // Check if holiday exists
    const existingHoliday = await prisma.holiday.findUnique({
      where: {
        date_country: {
          date: date.toDate(),
          country: "US",
        },
      },
    });

    if (!existingHoliday) {
      await updateResponse({
        text: `❌ No holiday found for ${dateStr}`,
      });
      return;
    }

    // Update holiday
    const updatedHoliday = await prisma.holiday.update({
      where: {
        date_country: {
          date: date.toDate(),
          country: "US",
        },
      },
      data: {
        name: newName,
      },
    });

    await updateResponse({
      text: `✅ Holiday for ${dateStr} updated from "${existingHoliday.name}" to "${updatedHoliday.name}"`,
    });

  } catch (error) {
    console.error("Error updating holiday:", error);
    await updateResponse({
      text: `❌ Error: ${error.message}`,
    });
  }
}

async function deleteHoliday({ command, ack, respond, client }) {
  const updateResponse = ackWithProcessing(
    ack,
    respond,
    "Deleting holiday...",
    command
  );

  try {
    // Check admin permissions
    const userData = await userService.fetchSlackUserData(command.user_id, client);
    const user = await userService.findOrCreateUser(command.user_id, userData);
    const org = await userService.getUserOrganization(command.user_id);

    if (!org) {
      await updateResponse({
        text: "❌ You must belong to an organization to manage holidays",
      });
      return;
    }

    const canManage = await userService.canCreateTeam(user.id, org.id);
    if (!canManage) {
      await updateResponse({
        text: "❌ You need admin permissions to manage holidays",
      });
      return;
    }

    // Parse command: /dd-holiday-delete YYYY-MM-DD [YYYY-MM-DD]
    const args = command.text.trim().split(" ");
    
    if (args.length < 1 || !args[0]) {
      await updateResponse({
        text: "❌ Usage: `/dd-holiday-delete YYYY-MM-DD [YYYY-MM-DD]`\nExamples:\n- `/dd-holiday-delete 2024-12-25`\n- `/dd-holiday-delete 2024-12-24 2024-12-26`",
      });
      return;
    }

    const startDateStr = args[0];
    const endDateStr = args[1];

    // Validate start date
    const startDate = dayjs(startDateStr, "YYYY-MM-DD", true);
    if (!startDate.isValid()) {
      await updateResponse({
        text: `❌ Invalid start date format: ${startDateStr}. Use YYYY-MM-DD format.`,
      });
      return;
    }

    let endDate = startDate;
    if (endDateStr) {
      endDate = dayjs(endDateStr, "YYYY-MM-DD", true);
      if (!endDate.isValid()) {
        await updateResponse({
          text: `❌ Invalid end date format: ${endDateStr}. Use YYYY-MM-DD format.`,
        });
        return;
      }
      
      if (endDate.isBefore(startDate)) {
        await updateResponse({
          text: "❌ End date cannot be before start date",
        });
        return;
      }
    }

    // Delete holidays in the date range
    let deletedCount = 0;
    let currentDate = startDate;
    
    while (currentDate.isSameOrBefore(endDate)) {
      try {
        const deleteResult = await prisma.holiday.deleteMany({
          where: {
            date: currentDate.toDate(),
            country: "US",
          },
        });
        deletedCount += deleteResult.count;
      } catch (error) {
        console.error(`Error deleting holiday for ${currentDate.format("YYYY-MM-DD")}:`, error);
      }
      
      currentDate = currentDate.add(1, "day");
    }

    if (deletedCount === 0) {
      const dateRange = endDateStr 
        ? `${startDateStr} to ${endDateStr}` 
        : startDateStr;
      await updateResponse({
        text: `❌ No holidays found for ${dateRange}`,
      });
      return;
    }

    const dateRange = endDateStr 
      ? `${startDateStr} to ${endDateStr}` 
      : startDateStr;

    await updateResponse({
      text: `✅ Deleted ${deletedCount} holiday${deletedCount > 1 ? 's' : ''} for ${dateRange}`,
    });

  } catch (error) {
    console.error("Error deleting holiday:", error);
    await updateResponse({
      text: `❌ Error: ${error.message}`,
    });
  }
}

module.exports = {
  setHoliday,
  updateHoliday,
  deleteHoliday,
};