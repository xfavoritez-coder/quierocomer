/**
 * Chile timezone helpers.
 *
 * All analytics, live dashboard and weekly email code uses Chile time
 * (America/Santiago) so day buckets and hour bars match what the restaurant
 * actually experiences.
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

/**
 * Convert a YYYY-MM-DD date string (intended as a Chile-local day) into the
 * pair of UTC instants that bound that day in Chile.
 */
export function chileDayBoundsUTC(ymd: string): { from: Date; to: Date } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(ymd + "T12:00:00.000Z"));
  const offsetStr = parts.find((p) => p.type === "timeZoneName")?.value || "GMT-4";
  const m = offsetStr.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  const sign = m && m[1] === "-" ? -1 : 1;
  const hh = m ? parseInt(m[2], 10) : 4;
  const mm = m && m[3] ? parseInt(m[3], 10) : 0;
  const offsetMin = sign * (hh * 60 + mm);
  const [y, mo, d] = ymd.split("-").map(Number);
  const fromUtcMs = Date.UTC(y, mo - 1, d, 0, 0, 0) - offsetMin * 60_000;
  const toUtcMs = Date.UTC(y, mo - 1, d, 23, 59, 59, 999) - offsetMin * 60_000;
  return { from: new Date(fromUtcMs), to: new Date(toUtcMs) };
}

/** UTC instant representing 00:00:00 Chile time today. */
export function chileStartOfTodayUTC(): Date {
  const todayISO = chileTodayISODate();
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
  const offset = sign * (hh * 60 + mm);
  const [y, mo, d] = todayISO.split("-").map(Number);
  const utcMs = Date.UTC(y, mo - 1, d, 0, 0, 0) - offset * 60_000;
  return new Date(utcMs);
}
