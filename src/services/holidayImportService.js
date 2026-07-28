const XLSX = require("xlsx");
const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");

dayjs.extend(customParseFormat);

// Zoho People "Holiday" export column headers (case-insensitive match).
const HEADER_ALIASES = {
  name: ["name"],
  from: ["from"],
  to: ["to"],
  description: ["description"],
};

const DATE_FORMATS = [
  "DD-MMM-YYYY",
  "DD-MMM-YY",
  "DD/MMM/YYYY",
  "YYYY-MM-DD",
  "MM/DD/YYYY",
  "DD/MM/YYYY",
];

// Guardrails against malformed rows producing runaway date ranges.
const MAX_DAYS_PER_ROW = 60;
const MAX_TOTAL_RECORDS = 1000;
// Matches Holiday.name's `@db.VarChar(255)` — longer names are truncated
// rather than blowing up the import mid-transaction.
const MAX_NAME_LENGTH = 255;

function normalizeHeaderCell(cell) {
  return String(cell || "")
    .trim()
    .toLowerCase();
}

function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cells = rows[i].map(normalizeHeaderCell);
    if (
      cells.includes("name") &&
      cells.includes("from") &&
      cells.includes("to")
    ) {
      return i;
    }
  }
  return -1;
}

function buildColumnMap(headerRow) {
  const map = {};
  headerRow.forEach((cell, index) => {
    const normalized = normalizeHeaderCell(cell);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(normalized) && map[field] === undefined) {
        map[field] = index;
      }
    }
  });
  return map;
}

// Minimal RFC4180-ish CSV parser. SheetJS's own CSV reader auto-detects and
// silently mis-converts "DD-MMM-YYYY" strings (e.g. Zoho's date format) into
// unrelated numbers/dates, so plain text files are parsed by hand instead.
function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\r") {
      // skip; \n (or EOF) terminates the row
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function parseDate(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;

  for (const format of DATE_FORMATS) {
    const parsed = dayjs(str, format, true);
    if (parsed.isValid()) return parsed;
  }
  return null;
}

function readRawRows(buffer, filename) {
  if (/\.csv$/i.test(filename || "")) {
    return parseCsvRows(buffer.toString("utf8"));
  }

  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("The uploaded file has no sheets");
  }

  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    dateNF: "yyyy-mm-dd",
    defval: "",
  });
}

/**
 * Parses a Zoho People holiday export (.xls/.xlsx/.csv) into raw row entries.
 * Returns { rows, warnings } where rows are { name, description, startDate, endDate }
 * (dayjs instances) and warnings are human-readable strings for skipped lines.
 */
function parseHolidayFile(buffer, filename) {
  const rawRows = readRawRows(buffer, filename);
  const headerIndex = findHeaderRow(rawRows);
  if (headerIndex === -1) {
    throw new Error(
      'Could not find a header row with "Name", "From", and "To" columns'
    );
  }

  const columnMap = buildColumnMap(rawRows[headerIndex]);
  const warnings = [];
  const rows = [];

  for (let i = headerIndex + 1; i < rawRows.length; i++) {
    const line = rawRows[i];
    if (!line || line.every((cell) => String(cell || "").trim() === ""))
      continue;

    const rowNumber = i + 1;
    const name = String(line[columnMap.name] || "").trim();
    const fromRaw = line[columnMap.from];
    const toRaw = line[columnMap.to];
    const description =
      columnMap.description !== undefined
        ? String(line[columnMap.description] || "").trim()
        : "";

    if (!name) {
      warnings.push(`Row ${rowNumber}: skipped, missing holiday name`);
      continue;
    }

    const startDate = parseDate(fromRaw);
    if (!startDate) {
      warnings.push(
        `Row ${rowNumber}: skipped, unrecognized "From" date "${fromRaw}"`
      );
      continue;
    }

    const endDate = toRaw ? parseDate(toRaw) : startDate;
    if (!endDate) {
      warnings.push(
        `Row ${rowNumber}: skipped, unrecognized "To" date "${toRaw}"`
      );
      continue;
    }

    if (endDate.isBefore(startDate)) {
      warnings.push(
        `Row ${rowNumber}: skipped, "To" date is before "From" date`
      );
      continue;
    }

    if (endDate.diff(startDate, "day") + 1 > MAX_DAYS_PER_ROW) {
      warnings.push(
        `Row ${rowNumber}: skipped, date range exceeds ${MAX_DAYS_PER_ROW} days`
      );
      continue;
    }

    rows.push({ name, description: description || null, startDate, endDate });
  }

  return { rows, warnings };
}

/**
 * Expands parsed rows into one entry per calendar day, deduping same-day
 * entries (last one wins) so multi-row ranges don't collide.
 * Returns { records, truncated } — `truncated` is how many days were dropped
 * by the MAX_TOTAL_RECORDS cap, so callers can warn only when it really bit.
 */
function expandToDailyRecords(rows) {
  const byDate = new Map();

  for (const row of rows) {
    let current = row.startDate;
    while (
      current.isBefore(row.endDate) ||
      current.isSame(row.endDate, "day")
    ) {
      const date = current.format("YYYY-MM-DD");
      byDate.set(date, { date, name: row.name, description: row.description });
      current = current.add(1, "day");
    }
  }

  const all = Array.from(byDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return {
    records: all.slice(0, MAX_TOTAL_RECORDS),
    truncated: Math.max(0, all.length - MAX_TOTAL_RECORDS),
  };
}

// Holiday.date is `@db.Date`, and Prisma persists the *UTC* calendar day of
// whatever Date it's handed. Everything here therefore pins to UTC midnight:
// a local-midnight Date would be written as the previous/next day on any host
// where TZ !== UTC, and the upsert key is (organization_id, date) — so the
// import would silently overwrite a neighbouring day's holiday.
function toUtcDate(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey ?? ""))) return null;
  const date = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  // Date rolls overflow days forward instead of rejecting them
  // ("2026-02-30" → Mar 2), so reject anything that doesn't round-trip.
  return toDateKey(date) === dateKey ? date : null;
}

// Inverse of toUtcDate: the UTC calendar day of a stored Holiday.date.
function toDateKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

/**
 * Tags each expanded record against the org's existing holidays as
 * `new` / `update` / `unchanged`. Both sides are keyed by UTC calendar day.
 */
function diffAgainstExisting(records, existingHolidays) {
  const existingByDate = new Map(
    existingHolidays.map((h) => [toDateKey(h.date), h])
  );

  return records.map((record) => {
    const match = existingByDate.get(record.date);
    if (!match) return { ...record, status: "new" };
    const unchanged =
      match.name === record.name &&
      (match.description || null) === (record.description || null);
    return { ...record, status: unchanged ? "unchanged" : "update" };
  });
}

/**
 * Normalizes confirmed import items into DB-ready rows, dropping anything
 * unusable (bad date, blank name, duplicate day) before the write starts so a
 * malformed item can't fail the transaction partway through.
 * Returns { valid, skipped }.
 */
function normalizeImportItems(items) {
  const valid = [];
  const seen = new Set();
  let skipped = 0;

  for (const item of items) {
    const date = toUtcDate(item?.date);
    const name = String(item?.name ?? "")
      .trim()
      .slice(0, MAX_NAME_LENGTH);
    const description = String(item?.description ?? "").trim() || null;

    if (!date || !name || seen.has(item.date)) {
      skipped++;
      continue;
    }
    seen.add(item.date);
    valid.push({ date, name, description });
  }

  return { valid, skipped };
}

module.exports = {
  parseHolidayFile,
  expandToDailyRecords,
  diffAgainstExisting,
  normalizeImportItems,
  toUtcDate,
  toDateKey,
  MAX_TOTAL_RECORDS,
  MAX_NAME_LENGTH,
};
