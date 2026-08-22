// ═══════════════════════════════════════════════════════════
//  Horario de atención del Ecommerce (tienda abierta/cerrada).
//  Se guarda en Restaurant.ecommerceHours (JSON). Día 0 = Domingo.
// ═══════════════════════════════════════════════════════════

export interface DayHours {
  open: boolean; // ¿atiende ese día?
  from: string; // "HH:MM"
  to: string; // "HH:MM" ("00:00" = medianoche)
}

export interface EcommerceHours {
  enabled: boolean; // aplicar horario; si false, siempre abierto
  days: Record<string, DayHours>; // "0".."6"
}

export const DAY_KEYS = ["0", "1", "2", "3", "4", "5", "6"] as const;
export const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export function defaultHours(): EcommerceHours {
  const days: Record<string, DayHours> = {};
  for (const k of DAY_KEYS) days[k] = { open: true, from: "10:00", to: "22:00" };
  return { enabled: false, days };
}

function cleanDay(raw: unknown): DayHours {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const hhmm = (v: unknown, d: string) => (typeof v === "string" && /^\d{1,2}:\d{2}$/.test(v) ? v : d);
  return { open: o.open !== false, from: hhmm(o.from, "10:00"), to: hhmm(o.to, "22:00") };
}

export function parseHours(raw: unknown): EcommerceHours {
  const base = defaultHours();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const daysRaw = (o.days && typeof o.days === "object" ? o.days : o) as Record<string, unknown>;
  const days: Record<string, DayHours> = {};
  for (const k of DAY_KEYS) days[k] = cleanDay(daysRaw[k]);
  return { enabled: o.enabled === true, days };
}

function parseMins(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Momento actual en Santiago. */
function chileNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
}

export interface OpenStatus {
  open: boolean;
  today: DayHours | null; // config del día de hoy
  opensAt: string | null; // si está cerrado y abre hoy más tarde
  closesAt: string | null; // si está abierto, cuándo cierra
}

/** ¿La tienda está abierta ahora? (según el horario). */
export function getOpenStatus(hours: EcommerceHours, now: Date = chileNow()): OpenStatus {
  if (!hours.enabled) return { open: true, today: null, opensAt: null, closesAt: null };
  const day = String(now.getDay());
  const today = hours.days[day] ?? null;
  if (!today || !today.open) return { open: false, today, opensAt: null, closesAt: null };

  const nowMins = now.getHours() * 60 + now.getMinutes();
  const fromMins = parseMins(today.from || "00:00");
  const rawTo = today.to || "23:59";
  const toMins = rawTo === "00:00" ? 1440 : parseMins(rawTo);

  // Horario normal (from <= to) vs nocturno (cruza medianoche).
  const isOpen = fromMins <= toMins ? nowMins >= fromMins && nowMins < toMins : nowMins >= fromMins || nowMins < toMins;

  return {
    open: isOpen,
    today,
    opensAt: !isOpen && nowMins < fromMins ? today.from : null,
    closesAt: isOpen ? (rawTo === "00:00" ? "00:00" : today.to) : null,
  };
}
