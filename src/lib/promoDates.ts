// Fechas de ofertas/promos en hora de Chile (America/Santiago), DST-safe.
//
// El input <input type="date"> entrega "YYYY-MM-DD". Si se guarda con
// `new Date("2026-11-21")` queda en MEDIANOCHE UTC = 21:00 del 20 en Chile → una
// oferta "del 21" se vence de inmediato y se muestra como "20 nov". Por eso:
//  - validFrom se guarda al INICIO del día en Chile.
//  - validUntil se guarda al FIN del día en Chile.
//  - para mostrar/editar se convierte el instante de vuelta a la fecha Chile.

const TZ = "America/Santiago";

/** Offset UTC ("-03:00"/"-04:00") de Chile para una fecha "YYYY-MM-DD" (respeta DST). */
function chileOffset(dateStr: string): string {
  const probe = new Date(`${dateStr}T12:00:00Z`); // mediodía UTC: evita bordes de DST
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" }).formatToParts(probe);
  const tz = parts.find((p) => p.type === "timeZoneName")?.value || "GMT-03:00"; // "GMT-03:00"
  const m = tz.match(/GMT([+-]\d{2}):?(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : "-03:00";
}

const isDateOnly = (s: string) => /^\d{4}-\d{2}-\d{2}/.test(s);

/** "YYYY-MM-DD" → Date al inicio (00:00:00.000) de ese día en Chile. */
export function chileDayStart(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  if (!isDateOnly(dateStr)) { const d = new Date(dateStr); return isNaN(d.getTime()) ? null : d; }
  const ds = dateStr.slice(0, 10);
  return new Date(`${ds}T00:00:00.000${chileOffset(ds)}`);
}

/** "YYYY-MM-DD" → Date al fin (23:59:59.999) de ese día en Chile. */
export function chileDayEnd(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  if (!isDateOnly(dateStr)) { const d = new Date(dateStr); return isNaN(d.getTime()) ? null : d; }
  const ds = dateStr.slice(0, 10);
  return new Date(`${ds}T23:59:59.999${chileOffset(ds)}`);
}

/** Instante → "YYYY-MM-DD" según el calendario de Chile (para mostrar y para el input date). */
export function toChileDateStr(d?: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
