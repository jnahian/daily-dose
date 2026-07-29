const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const EM_DASH = '—';

function parse(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Formats a **calendar date** as "26 Mar, 26".
 *
 * Read in UTC on purpose. Holiday.date, StandupResponse.standupDate and
 * friends are Prisma `@db.Date` columns, which serialize as UTC midnight —
 * formatting those with local getters shows the previous day for any viewer
 * west of UTC. Use formatDateTime for real timestamps instead.
 */
export function formatDate(value: string | Date | null | undefined): string {
  const date = parse(value);
  if (!date) return EM_DASH;
  const day = String(date.getUTCDate()).padStart(2, '0');
  const year = String(date.getUTCFullYear()).slice(-2);
  return `${day} ${MONTHS[date.getUTCMonth()]}, ${year}`;
}

/**
 * Formats a **timestamp** as "26 Mar, 26 · 14:05" in the viewer's local time.
 * For instants (submittedAt, joinedAt, expiresAt) — not for `@db.Date` values.
 */
export function formatDateTime(value: string | Date | null | undefined): string {
  const date = parse(value);
  if (!date) return EM_DASH;
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  const time = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${day} ${MONTHS[date.getMonth()]}, ${year} · ${time}`;
}

export type HolidayStatus = 'upcoming' | 'today' | 'passed';

/**
 * Classifies a calendar date against today. Compared as UTC day strings so a
 * holiday doesn't flip to "passed" a few hours early for western viewers.
 */
export function dateStatus(value: string | Date | null | undefined): HolidayStatus | null {
  const date = parse(value);
  if (!date) return null;
  const key = date.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  if (key === today) return 'today';
  return key > today ? 'upcoming' : 'passed';
}
