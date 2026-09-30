// ═══════════════════════════════════════════════════════════
//  Pedidos programados (scheduling): el cliente elige una fecha/hora
//  futura dentro del horario del local y de la ventana permitida.
//  El pedido se libera (envía a POS + imprime) `estimado` minutos antes.
// ═══════════════════════════════════════════════════════════
import { EcommerceHours, getActiveClosure } from "@/lib/ecommerce/hours";

const TZ = "America/Santiago";

/** Minutos estimados a partir de un texto tipo "40-60" / "30" / "" → borde superior. */
export function parseWaitMinutes(waitTime: string | null | undefined, fallback = 30): number {
  if (!waitTime) return fallback;
  const nums = String(waitTime).match(/\d+/g);
  if (!nums || !nums.length) return fallback;
  const n = Math.max(...nums.map(Number));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Offset de Chile ("-03:00"/"-04:00") para una fecha YYYY-MM-DD. */
function tzOffset(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  const s = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" }).format(d);
  const m = s.match(/GMT([+-]\d{2}:\d{2})/);
  return m ? m[1] : "-03:00";
}

/** Date UTC para una hora de pared de Chile (ymd + "HH:MM"). */
export function chileWallToDate(ymd: string, hhmm: string): Date {
  return new Date(`${ymd}T${hhmm}:00${tzOffset(ymd)}`);
}

/** Partes de una fecha en hora de Chile. */
export function chileParts(date: Date): { ymd: string; weekday: number; minutes: number; hhmm: string } {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
  }).formatToParts(date).reduce((a, x) => { a[x.type] = x.value; return a; }, {} as Record<string, string>);
  const hh = p.hour === "24" ? "00" : p.hour;
  const ymd = `${p.year}-${p.month}-${p.day}`;
  // weekday desde el propio Date en TZ Chile.
  const wd = new Date(`${ymd}T12:00:00${tzOffset(ymd)}`).getUTCDay(); // 12:00 evita saltos de día
  const minutes = parseInt(hh, 10) * 60 + parseInt(p.minute, 10);
  return { ymd, weekday: wd, minutes, hhmm: `${hh}:${p.minute}` };
}

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function toMins(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function fmtHHMM(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export interface SlotDay {
  ymd: string; // "YYYY-MM-DD"
  label: string; // "Hoy" / "Mañana" / "Vie 3 oct"
  slots: { iso: string; label: string }[]; // horas disponibles
}

const DAY_NAMES_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function dayLabel(ymd: string, todayYmd: string): string {
  if (ymd === todayYmd) return "Hoy";
  if (ymd === addDaysYmd(todayYmd, 1)) return "Mañana";
  const d = new Date(`${ymd}T12:00:00Z`);
  return `${DAY_NAMES_SHORT[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}

/** ¿La hora de pared cae dentro de la ventana del día (soporta cruce de medianoche)? */
function withinWindow(mins: number, fromM: number, toM: number): boolean {
  if (fromM <= toM) return mins >= fromM && mins < toM;
  return mins >= fromM || mins < toM; // nocturno
}

/** Genera los días con horas disponibles para programar, según horario y ventana.
 *  `stepMin` = paso entre horas (default 30). Excluye horas < ahora + estimado. */
export function generateSlots(opts: {
  hours: EcommerceHours;
  maxDaysAhead: number;
  estimatedMinutes: number;
  now?: Date;
  stepMin?: number;
}): SlotDay[] {
  const { hours, maxDaysAhead, estimatedMinutes } = opts;
  const now = opts.now ?? new Date();
  const step = opts.stepMin ?? 30;
  const nowParts = chileParts(now);
  const todayYmd = nowParts.ymd;
  const earliestMs = now.getTime() + estimatedMinutes * 60_000;

  const out: SlotDay[] = [];
  for (let d = 0; d <= Math.max(0, maxDaysAhead); d++) {
    const ymd = addDaysYmd(todayYmd, d);
    const wd = new Date(`${ymd}T12:00:00Z`).getUTCDay();
    const day = hours.enabled ? hours.days[String(wd)] : { open: true, from: "00:00", to: "23:59" };
    if (!day || !day.open) continue;
    const fromM = toMins(day.from || "00:00");
    const rawTo = day.to || "23:59";
    const toM = rawTo === "00:00" ? 1440 : toMins(rawTo);
    // Recorre las marcas del día (respeta ventana normal o nocturna hasta 24h).
    const endM = fromM <= toM ? toM : toM + 1440;
    const slots: { iso: string; label: string }[] = [];
    for (let m = Math.ceil(fromM / step) * step; m <= endM; m += step) {
      const realMin = m % 1440;
      if (!withinWindow(realMin, fromM, toM) && m < 1440) continue;
      const slotYmd = m >= 1440 ? addDaysYmd(ymd, 1) : ymd;
      const hhmm = fmtHHMM(realMin);
      const date = chileWallToDate(slotYmd, hhmm);
      if (date.getTime() < earliestMs) continue; // muy pronto para preparar
      // Descarta si cae en un cierre programado.
      const wall = `${slotYmd}T${hhmm}`;
      const closure = getActiveClosure(hours, wall);
      if (closure && (closure.affectsDelivery || closure.affectsPickup)) continue;
      slots.push({ iso: date.toISOString(), label: hhmm });
      if (slots.length >= 48) break;
    }
    if (slots.length) out.push({ ymd, label: dayLabel(ymd, todayYmd), slots });
  }
  return out;
}

/** Valida (server-side) que un `scheduledFor` ISO sea programable. */
export function validateScheduledFor(opts: {
  iso: string;
  hours: EcommerceHours;
  maxDaysAhead: number;
  estimatedMinutes: number;
  now?: Date;
}): { ok: boolean; error?: string; date?: Date } {
  const { iso, hours, maxDaysAhead, estimatedMinutes } = opts;
  const now = opts.now ?? new Date();
  const date = new Date(iso);
  if (isNaN(date.getTime())) return { ok: false, error: "Fecha inválida." };
  // No en el pasado (con margen para preparar).
  if (date.getTime() < now.getTime() + estimatedMinutes * 60_000 - 60_000) {
    return { ok: false, error: "La hora programada es muy pronto." };
  }
  // Dentro de la ventana de días.
  const todayYmd = chileParts(now).ymd;
  const maxYmd = addDaysYmd(todayYmd, Math.max(0, maxDaysAhead));
  const { ymd, weekday, minutes } = chileParts(date);
  if (ymd < todayYmd || ymd > maxYmd) return { ok: false, error: "Fuera del rango de fechas permitido." };
  // Dentro del horario del día.
  if (hours.enabled) {
    const day = hours.days[String(weekday)];
    if (!day || !day.open) return { ok: false, error: "El local no atiende ese día." };
    const fromM = toMins(day.from || "00:00");
    const rawTo = day.to || "23:59";
    const toM = rawTo === "00:00" ? 1440 : toMins(rawTo);
    if (!withinWindow(minutes, fromM, toM)) return { ok: false, error: "Fuera del horario de atención." };
  }
  // No en cierre programado.
  const wall = chileParts(date).ymd + "T" + chileParts(date).hhmm;
  const closure = getActiveClosure(hours, wall);
  if (closure && (closure.affectsDelivery || closure.affectsPickup)) {
    return { ok: false, error: "El local tiene un cierre programado en esa fecha." };
  }
  return { ok: true, date };
}

/** Momento de liberación de un pedido programado: hora objetivo − estimado. */
export function releaseTime(scheduledFor: Date, estimatedMinutes: number): Date {
  return new Date(scheduledFor.getTime() - estimatedMinutes * 60_000);
}
