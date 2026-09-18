// ═══════════════════════════════════════════════════════════
//  Horario de atención del Ecommerce (tienda abierta/cerrada).
//  Se guarda en Restaurant.ecommerceHours (JSON). Día 0 = Domingo.
// ═══════════════════════════════════════════════════════════

export interface DayHours {
  open: boolean; // ¿atiende ese día?
  from: string; // "HH:MM"
  to: string; // "HH:MM" ("00:00" = medianoche)
}

/** Cierre programado (feriado, vacaciones, etc.). Fechas en hora local de
 *  Chile con formato "YYYY-MM-DDTHH:MM" (sin zona). Afecta a los métodos de
 *  entrega marcados: si bloquea todos los disponibles, la tienda queda cerrada. */
export interface Closure {
  id: string;
  from: string; // "YYYY-MM-DDTHH:MM" (inicio, hora Chile)
  to: string; // "YYYY-MM-DDTHH:MM" (fin, hora Chile)
  reason: string; // motivo visible para el cliente
  affectsDelivery: boolean;
  affectsPickup: boolean;
}

export interface EcommerceHours {
  enabled: boolean; // aplicar horario; si false, siempre abierto
  days: Record<string, DayHours>; // "0".."6"
  closures: Closure[]; // cierres programados
}

/** Cierre activo consolidado (unión de los cierres vigentes ahora mismo). */
export interface ActiveClosure {
  reason: string; // motivo del cierre vigente más relevante
  affectsDelivery: boolean;
  affectsPickup: boolean;
  until: string; // "YYYY-MM-DDTHH:MM" — fin del cierre vigente (el que termina más tarde)
}

export const DAY_KEYS = ["0", "1", "2", "3", "4", "5", "6"] as const;
export const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export function defaultHours(): EcommerceHours {
  const days: Record<string, DayHours> = {};
  for (const k of DAY_KEYS) days[k] = { open: true, from: "10:00", to: "22:00" };
  return { enabled: false, days, closures: [] };
}

const DT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Normaliza la lista de cierres programados desde un valor arbitrario (JSON). */
export function parseClosures(raw: unknown): Closure[] {
  if (!Array.isArray(raw)) return [];
  const out: Closure[] = [];
  for (const item of raw) {
    const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const from = typeof o.from === "string" && DT_RE.test(o.from) ? o.from : null;
    const to = typeof o.to === "string" && DT_RE.test(o.to) ? o.to : null;
    if (!from || !to || to <= from) continue; // rango inválido → se descarta
    const reason = (typeof o.reason === "string" ? o.reason : "").trim().slice(0, 200);
    const affectsDelivery = o.affectsDelivery !== false;
    const affectsPickup = o.affectsPickup !== false;
    if (!affectsDelivery && !affectsPickup) continue; // no afecta a nada → inútil
    const id = typeof o.id === "string" && o.id ? o.id.slice(0, 40) : `cl_${Math.random().toString(36).slice(2, 10)}`;
    out.push({ id, from, to, reason, affectsDelivery, affectsPickup });
  }
  return out;
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
  return { enabled: o.enabled === true, days, closures: parseClosures(o.closures) };
}

/** Hora local de Chile como string "YYYY-MM-DDTHH:MM" (comparable lexicográficamente). */
function chileWallString(date: Date = new Date()): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date).reduce((a, x) => { a[x.type] = x.value; return a; }, {} as Record<string, string>);
  const hh = p.hour === "24" ? "00" : p.hour;
  return `${p.year}-${p.month}-${p.day}T${hh}:${p.minute}`;
}

/** Cierre programado vigente ahora (unión de todos los activos). null si no hay. */
export function getActiveClosure(hours: EcommerceHours, nowWall: string = chileWallString()): ActiveClosure | null {
  const activos = (hours.closures || []).filter((c) => c.from <= nowWall && nowWall < c.to);
  if (!activos.length) return null;
  const affectsDelivery = activos.some((c) => c.affectsDelivery);
  const affectsPickup = activos.some((c) => c.affectsPickup);
  // Motivo: el del cierre que termina más tarde; `until`: el fin más lejano.
  const ultimo = activos.reduce((a, b) => (b.to > a.to ? b : a));
  return { reason: ultimo.reason, affectsDelivery, affectsPickup, until: ultimo.to };
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
  closure: ActiveClosure | null; // cierre programado vigente (si hay)
  closedByClosure: boolean; // true si el cierre programado dejó la tienda sin métodos
}

/** Estado abierto/cerrado sólo por el horario semanal (sin considerar cierres). */
function weeklyStatus(hours: EcommerceHours, now: Date): Omit<OpenStatus, "closure" | "closedByClosure"> {
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

/** ¿La tienda está abierta ahora? (horario semanal + cierre programado). */
export function getOpenStatus(hours: EcommerceHours, now: Date = chileNow()): OpenStatus {
  const weekly = weeklyStatus(hours, now);
  const closure = getActiveClosure(hours);
  return { ...weekly, closure, closedByClosure: false };
}

/** Resuelve la disponibilidad efectiva combinando horario semanal, cierres
 *  programados y los métodos de entrega que ofrece la tienda. Es la fuente de
 *  verdad para el storefront y el checkout (bloqueo por método). */
export function resolveAvailability(
  hours: EcommerceHours,
  methods: { deliveryEnabled: boolean; pickupEnabled: boolean },
  now: Date = chileNow(),
): { openStatus: OpenStatus; deliveryEnabled: boolean; pickupEnabled: boolean } {
  const status = getOpenStatus(hours, now);
  let deliveryEnabled = methods.deliveryEnabled;
  let pickupEnabled = methods.pickupEnabled;
  const cl = status.closure;
  if (cl) {
    if (cl.affectsDelivery) deliveryEnabled = false;
    if (cl.affectsPickup) pickupEnabled = false;
  }
  // Si tras aplicar el cierre no queda ningún método (y antes sí había), la
  // tienda queda cerrada del todo por el cierre programado.
  const closedByClosure = !!cl && !deliveryEnabled && !pickupEnabled && (methods.deliveryEnabled || methods.pickupEnabled);
  const open = status.open && (deliveryEnabled || pickupEnabled);
  return { openStatus: { ...status, open, closedByClosure }, deliveryEnabled, pickupEnabled };
}
