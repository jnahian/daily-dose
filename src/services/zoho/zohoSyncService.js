const dayjs = require("dayjs");
const prisma = require("../../config/prisma");
const logger = require("../../utils/logger");
const { fetchLeaveRecords, fetchHolidays } = require("./zohoPeopleClient");
const { parseZohoDate } = require("./zohoDateHelper");
const { getUserIdsByEmployeeId } = require("./zohoMappingService");

// How far back/forward each leave sync looks. Back-dating catches leaves
// approved after the fact for a day that's already passed; forward-dating
// lets the "out today" gate and summary line see approved leave ahead of
// time instead of only on the day itself.
const LEAVE_SYNC_DAYS_BACK = 7;
const LEAVE_SYNC_DAYS_FORWARD = 30;

const APPROVED_STATUSES = new Set(["approved"]);

function formatZohoRequestDate(date) {
  // Zoho People's REST endpoints conventionally take query-param dates as
  // MM-dd-yyyy (distinct from the dd-MMM-yyyy the API returns in response
  // bodies). Verify against a real Zoho org — if a sync run returns zero
  // records unexpectedly, this format is the first thing to check.
  return dayjs(date).format("MM-DD-YYYY");
}

async function recordSyncRun(organizationId, syncType, fn) {
  const startedAt = new Date();
  try {
    const recordsSynced = await fn();
    await prisma.zohoSyncRun.create({
      data: {
        organizationId,
        syncType,
        status: "SUCCESS",
        recordsSynced,
        startedAt,
        completedAt: new Date(),
      },
    });
    return { recordsSynced };
  } catch (error) {
    await prisma.zohoSyncRun.create({
      data: {
        organizationId,
        syncType,
        status: "FAILED",
        error: String(error.message || error).slice(0, 1000),
        startedAt,
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

// NOTE: field names below are Daily Dose's best-effort mapping of the
// documented Zoho People holiday-calendar response. Zoho People fields can
// be renamed per organization — verify against a real response from your
// Zoho org and adjust here if names differ.
function mapZohoHoliday(raw) {
  const holidayId = raw.holidayId ?? raw.HolidayId ?? raw.id;
  const name = raw.Name ?? raw.name ?? raw.holidayName;
  const rawDate = raw.Date ?? raw.date ?? raw.holidayDate;
  if (!name || !rawDate) return null;

  const date = parseZohoDate(rawDate);
  if (!date) return null;

  return {
    externalId:
      holidayId !== null && holidayId !== undefined ? String(holidayId) : null,
    name: String(name),
    date,
  };
}

// NOTE: field names below are Daily Dose's best-effort mapping of the
// documented Zoho People Leave Tracker v2 "get records" response — verify
// against a real response and adjust here if names differ. zohoEmployeeId
// and externalId are always kept as strings; Zoho's own IDs overflow JS's
// safe integer range, so never wrap them in Number()/parseInt().
function mapZohoLeaveRecord(raw) {
  const recordId = raw.recordId ?? raw.RecordId ?? raw.id;
  const employeeId = raw.employeeId ?? raw.EmployeeID ?? raw.EmployeeId;
  const approvalStatus = raw.approvalStatus ?? raw.ApprovalStatus ?? "";
  const fromDate = raw.fromDate ?? raw.From;
  const toDate = raw.toDate ?? raw.To;
  const leaveType = raw.leaveType ?? raw.LeaveType;

  if (
    recordId === null ||
    recordId === undefined ||
    employeeId === null ||
    employeeId === undefined ||
    !fromDate ||
    !toDate
  ) {
    return null;
  }

  const startDate = parseZohoDate(fromDate);
  const endDate = parseZohoDate(toDate);
  if (!startDate || !endDate) return null;

  return {
    externalId: String(recordId),
    zohoEmployeeId: String(employeeId),
    isApproved: APPROVED_STATUSES.has(
      String(approvalStatus).trim().toLowerCase()
    ),
    startDate,
    endDate,
    reason: leaveType ? String(leaveType) : "Zoho leave",
  };
}

async function syncHolidaysForOrganization(organizationId) {
  return recordSyncRun(organizationId, "HOLIDAY", async () => {
    const rawHolidays = await fetchHolidays(organizationId);
    let synced = 0;

    for (const raw of rawHolidays) {
      const holiday = mapZohoHoliday(raw);
      if (!holiday) continue;

      // Same upsert key /dd-holiday-set already uses — a nightly Zoho sync
      // is authoritative for any date it returns, overwriting a same-date
      // manual entry (source is tagged so it's visible which one won).
      await prisma.holiday.upsert({
        where: {
          organization_id_date: {
            organization_id: organizationId,
            date: holiday.date,
          },
        },
        update: {
          name: holiday.name,
          source: "ZOHO",
          externalId: holiday.externalId,
          updated_at: new Date(),
        },
        create: {
          organization_id: organizationId,
          date: holiday.date,
          name: holiday.name,
          source: "ZOHO",
          externalId: holiday.externalId,
          updated_at: new Date(),
        },
      });
      synced += 1;
    }

    logger.info(
      `zoho:sync holidays organization=${organizationId} synced=${synced}`
    );
    return synced;
  });
}

async function syncLeavesForOrganization(organizationId) {
  return recordSyncRun(organizationId, "LEAVE", async () => {
    const from = dayjs().subtract(LEAVE_SYNC_DAYS_BACK, "day");
    const to = dayjs().add(LEAVE_SYNC_DAYS_FORWARD, "day");

    const rawRecords = await fetchLeaveRecords(
      organizationId,
      formatZohoRequestDate(from.toDate()),
      formatZohoRequestDate(to.toDate())
    );

    const userIdsByEmployeeId = await getUserIdsByEmployeeId(organizationId);
    let synced = 0;
    let skippedUnmapped = 0;
    let skippedNotApproved = 0;

    for (const raw of rawRecords) {
      const leave = mapZohoLeaveRecord(raw);
      if (!leave) continue;

      if (!leave.isApproved) {
        skippedNotApproved += 1;
        // Clean up a previously-synced Leave row if this record has since
        // flipped to pending/rejected/cancelled in Zoho — otherwise the
        // person stays marked "on leave" indefinitely after Zoho rescinds it.
        await prisma.leave.deleteMany({
          where: { source: "ZOHO", externalId: leave.externalId },
        });
        continue;
      }

      const userId = userIdsByEmployeeId.get(leave.zohoEmployeeId);
      if (!userId) {
        skippedUnmapped += 1;
        continue;
      }

      await prisma.leave.upsert({
        where: {
          source_externalId: { source: "ZOHO", externalId: leave.externalId },
        },
        update: {
          userId,
          startDate: leave.startDate,
          endDate: leave.endDate,
          reason: leave.reason,
        },
        create: {
          userId,
          startDate: leave.startDate,
          endDate: leave.endDate,
          reason: leave.reason,
          source: "ZOHO",
          externalId: leave.externalId,
        },
      });
      synced += 1;
    }

    logger.info(
      `zoho:sync leaves organization=${organizationId} synced=${synced} ` +
        `skippedUnmapped=${skippedUnmapped} skippedNotApproved=${skippedNotApproved}`
    );
    return synced;
  });
}

async function getEnabledOrganizations() {
  return prisma.organization.findMany({
    where: { isActive: true, zohoCredential: { enabled: true } },
    select: { id: true, name: true },
  });
}

// Nightly entry point: syncs holidays then leaves for every organization
// with an enabled Zoho credential. Sequential, not parallel — Zoho
// rate-limits the holiday endpoint at 30 req/min, and there's no benefit to
// racing a handful of orgs against that ceiling.
async function syncAllOrganizations() {
  const organizations = await getEnabledOrganizations();

  for (const org of organizations) {
    try {
      await syncHolidaysForOrganization(org.id);
    } catch (error) {
      logger.error(
        `zoho:sync holidays failed for organization ${org.name}:`,
        error
      );
    }

    try {
      await syncLeavesForOrganization(org.id);
    } catch (error) {
      logger.error(
        `zoho:sync leaves failed for organization ${org.name}:`,
        error
      );
    }
  }

  return { organizationsProcessed: organizations.length };
}

module.exports = {
  mapZohoHoliday,
  mapZohoLeaveRecord,
  syncHolidaysForOrganization,
  syncLeavesForOrganization,
  syncAllOrganizations,
  getEnabledOrganizations,
};
