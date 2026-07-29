import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

// Registered once, here. Everything in the admin panel that needs a date goes
// through this module, so no other file has to extend dayjs or remember which
// values are UTC.
dayjs.extend(utc);

const EM_DASH = '—';
const DAY = 'DD MMM, YY';

/**
 * Parses a **calendar date** — a Prisma `@db.Date` column (`Holiday.date`,
 * `standupDate`, `lastStandupDate`), which arrives either as UTC midnight
 * (`2026-03-26T00:00:00.000Z`) or bare (`2026-03-26`).
 *
 * `dayjs.utc(v)`, not `dayjs(v).utc()`: dayjs parses a bare `YYYY-MM-DD` as
 * *local* midnight, so converting afterwards walks the day backwards for any
 * viewer east of UTC (at UTC+6, "2026-03-26" renders as 25 Mar).
 */
function parseDay(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = dayjs.utc(value);
  return date.isValid() ? date : null;
}

/** Parses a real **instant** (`createdAt`, `lastUsedAt`, `submittedAt`) in the viewer's zone. */
function parseInstant(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = dayjs(value);
  return date.isValid() ? date : null;
}

/** Formats a calendar date as "26 Mar, 26". */
export function formatDate(value: string | Date | null | undefined): string {
  return parseDay(value)?.format(DAY) ?? EM_DASH;
}

/** Formats a calendar date as "26 Mar" — for dense axes and grid headers. */
export function formatDayMonth(value: string | Date | null | undefined): string {
  return parseDay(value)?.format('DD MMM') ?? EM_DASH;
}

/** Formats a calendar date as `YYYY-MM-DD`, for API paths and query params. */
export function toDateParam(value: string | Date | null | undefined): string {
  return parseDay(value)?.format('YYYY-MM-DD') ?? '';
}

/** Formats a timestamp as "26 Mar, 26 · 14:05" in the viewer's local time. */
export function formatDateTime(value: string | Date | null | undefined): string {
  return parseInstant(value)?.format(`${DAY} [·] HH:mm`) ?? EM_DASH;
}

export type HolidayStatus = 'upcoming' | 'today' | 'passed';

/**
 * Classifies a calendar date against today, as `YYYY-MM-DD` strings.
 *
 * The two sides need different clocks, which is why they use different parsers.
 * The holiday is a stored calendar date, so it reads as UTC. "Today" is a real
 * instant, and the viewer's calendar day is what they mean by today, so it
 * stays local. Reading both as UTC flips the status by hours in either
 * direction: at UTC+6 a holiday reads "Upcoming" until 06:00 on the day itself;
 * at UTC-5 it reads "Today" from 19:00 the evening before.
 */
export function dateStatus(value: string | Date | null | undefined): HolidayStatus | null {
  const date = parseDay(value);
  if (!date) return null;
  const key = date.format('YYYY-MM-DD');
  const today = dayjs().format('YYYY-MM-DD');
  if (key === today) return 'today';
  return key > today ? 'upcoming' : 'passed';
}
