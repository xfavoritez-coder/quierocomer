/**
 * Toteat returns ISO-style timestamps without a timezone suffix
 * (e.g. "2026-05-01T19:24:49"). This module normalizes everything to
 * Chile time (America/Santiago) so day buckets and hour bars match what
 * the restaurant actually experiences.
 *
 * - parseToteatDate: returns a Date object representing the same instant
 *   regardless of what timezone the host server runs in.
 * - chileTodayYYYYMMDD: returns today's date in Chile, formatted for the
 *   Toteat /sales `ini`/`end` parameters.
 * - chileHourOf: 0..23 in Chile, given any Date.
 * - chileDateOf: YYYY-MM-DD in Chile, given any Date.
 */

const TZ = "America/Santiago";

const ymdFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const hourFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hour: "2-digit",
  hour12: false,
});

/**
 * Parse a Toteat-style timestamp string into a Date.
 *
 * Empirically the API returns wall-clock UTC strings without a `Z`
 * suffix (e.g. "2026-05-02T02:23:49" actually means 02:23 UTC, which
 * is 22:23 Chile). We treat unsuffixed strings as UTC. Any explicit
 * suffix (Z, +/-hh:mm) is honored.
 */
export function parseToteatDate(s: string): Date | null {
  if (!s || typeof s !== "string") return null;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
  if (!m) {
    const fallback = new Date(s + "Z");
    return isNaN(fallback.getTime()) ? null : fallback;
  }
  const [, Y, M, D, h, mi, sec] = m;
  return new Date(Date.UTC(Number(Y), Number(M) - 1, Number(D), Number(h), Number(mi), Number(sec)));
}

/** Today's date in Chile, "YYYYMMDD" — for Toteat /sales ini/end params. */
export function chileTodayYYYYMMDD(): string {
  return ymdFormatter.format(new Date()).replace(/-/g, "");
}

/** Today's date in Chile, "YYYY-MM-DD". */
export function chileTodayISODate(): string {
  return ymdFormatter.format(new Date());
}

/** Date string in Chile from any Date. */
export function chileDateOf(d: Date): string {
  return ymdFormatter.format(d);
}

/** Hour 0..23 in Chile from any Date. */
export function chileHourOf(d: Date): number {
  const v = parseInt(hourFormatter.format(d), 10);
  return Number.isNaN(v) ? 0 : v;
}

/** UTC instant representing 00:00:00 Chile time today. */
export function chileStartOfTodayUTC(): Date {
  // Chile is UTC-4 (no DST in May). For other months we compute via Intl.
  const todayISO = chileTodayISODate(); // "YYYY-MM-DD" Chile
  // Extract Chile UTC offset for now to handle DST safely
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const offsetStr = parts.find((p) => p.type === "timeZoneName")?.value || "GMT-4";
  const m = offsetStr.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  const sign = m && m[1] === "-" ? -1 : 1;
  const hh = m ? parseInt(m[2], 10) : 4;
  const mm = m && m[3] ? parseInt(m[3], 10) : 0;
  const offset = sign * (hh * 60 + mm); // minutes; e.g. -240 for UTC-4
  // Chile midnight in UTC = chile_midnight - offset minutes
  const [y, mo, d] = todayISO.split("-").map(Number);
  const utcMs = Date.UTC(y, mo - 1, d, 0, 0, 0) - offset * 60_000;
  return new Date(utcMs);
}
