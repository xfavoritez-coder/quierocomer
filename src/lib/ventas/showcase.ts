// Local de muestra para QuieroComer Ventas: una marca ficticia con 3 sucursales y ~1 año de datos
// (ventas, mesas, cajas, clientes, fidelización, recuperación, analítica de la carta) para mostrar
// el panel y el POS "en vivo" a los prospectos. Solo servidor.
//
// - La carta (platos, precios, fotos) se copia de Horus Vegan (con permiso de su dueño).
// - Los locales quedan isActive=false: no aparecen en el directorio, mapa ni sitemap.
// - Correos @example.com y teléfonos ficticios: ningún cron envía nada real (recuperación,
//   encuestas y correos semanales apagados).
// - Se regenera a diario (cron) para que "hoy", "clientes en riesgo", etc. sigan al día.
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const SHOWCASE_OWNER_EMAIL = "muestra@quierocomer.invalid";
const BRAND = "Raíz Cocina Vegana";
const BRAND_SLUG = "muestra-raiz";
const COLOR = "#2F7D4F";
const BRANCHES = [
  { key: "prov", slug: "muestra-raiz-providencia", branch: "Providencia", address: "Av. Providencia 1840, Providencia", weight: 1 },
  { key: "nunoa", slug: "muestra-raiz-nunoa", branch: "Ñuñoa", address: "Av. Irarrázaval 2950, Ñuñoa", weight: 0.72 },
  { key: "lc", slug: "muestra-raiz-las-condes", branch: "Las Condes", address: "Av. Apoquindo 4300, Las Condes", weight: 0.55 },
] as const;
type Branch = (typeof BRANCHES)[number];

// ── Utilidades ──────────────────────────────────────────────────────────────
function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const id = (p: string) => `${p}${crypto.randomBytes(9).toString("base64url").replace(/[-_]/g, "x")}`;
const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
async function createChunks<T>(rows: T[], fn: (batch: T[]) => Promise<unknown>, size = 800) { for (const b of chunk(rows, size)) if (b.length) await fn(b); }

const DAY = 86400000;
/** Fecha UTC para "hace `daysAgo` días, a las hh:mm hora de Chile". */
function chileAt(daysAgo: number, h: number, m: number): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() - daysAgo * DAY)).split("-").map(Number);
  const hourIn = (d: Date) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Santiago", hour: "numeric", hour12: false }).format(d)) % 24;
  for (const off of [3, 4]) {
    const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], h + off, m));
    if (hourIn(d) === h % 24) return d;
  }
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], h + 3, m));
}
const chileHourNow = () => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Santiago", hour: "numeric", hour12: false }).format(new Date())) % 24;

const FIRST = ["Camila", "Valentina", "Javiera", "Fernanda", "Catalina", "Constanza", "Francisca", "Daniela", "Antonia", "Sofía", "Isidora", "Martina", "Josefa", "Paula", "Carolina", "María José", "Florencia", "Trinidad", "Macarena", "Bárbara",
  "Matías", "Benjamín", "Sebastián", "Diego", "Nicolás", "Felipe", "Tomás", "Joaquín", "Ignacio", "Cristóbal", "Vicente", "Martín", "Agustín", "Gonzalo", "Rodrigo", "Andrés", "Pablo", "Francisco", "Javier", "Lucas"];
const LAST = ["González", "Muñoz", "Rojas", "Díaz", "Pérez", "Soto", "Contreras", "Silva", "Martínez", "Sepúlveda", "Morales", "Rodríguez", "López", "Fuentes", "Hernández", "Torres", "Araya", "Flores", "Espinoza", "Valenzuela", "Castillo", "Tapia", "Reyes", "Gutiérrez", "Castro", "Pizarro", "Álvarez", "Vásquez", "Sánchez", "Fernández"];
const STREETS = ["Los Leones", "Pedro de Valdivia", "Manuel Montt", "Italia", "Irarrázaval", "Grecia", "Tobalaba", "Apoquindo", "Bilbao", "Eliodoro Yáñez", "Suecia", "Ricardo Lyon"];
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

// Carta de respaldo si no se encuentra Horus Vegan.
const FALLBACK_MENU: { cat: string; dishes: [string, number, string][] }[] = [
  { cat: "Para compartir", dishes: [["Nachos veganos", 7900, "Queso de castaña, pico de gallo y guacamole"], ["Gyozas de verduras", 6900, "Seis gyozas con salsa ponzu"], ["Papas rústicas", 4900, "Con alioli de ajo asado"]] },
  { cat: "Hamburguesas", dishes: [["Burger Raíz", 9900, "Medallón de lentejas, cheddar vegano y cebolla caramelizada"], ["Burger BBQ", 10490, "Seitán ahumado, salsa BBQ y aros de cebolla"], ["Burger Mediterránea", 9490, "Garbanzos, hummus y tomate seco"]] },
  { cat: "Bowls", dishes: [["Bowl Teriyaki", 9490, "Tofu teriyaki, arroz y verduras"], ["Bowl Mexicano", 8990, "Porotos negros, choclo y palta"], ["Poke vegano", 9990, "Mango, edamame y salsa de soya"]] },
  { cat: "Postres", dishes: [["Brownie vegano", 3990, "Con helado de coco"], ["Cheesecake de maracuyá", 4490, "Base de almendras"]] },
  { cat: "Bebidas", dishes: [["Limonada menta jengibre", 3490, "Natural, 500 ml"], ["Kombucha artesanal", 3990, "Sabores de temporada"], ["Agua mineral", 1500, "Con o sin gas"]] },
];

type MenuItem = { name: string; price: number; photo: string | null; description: string | null; category: string };

// ── Entrada al panel / POS ───────────────────────────────────────────────────
export async function getShowcaseOwner() {
  return prisma.restaurantOwner.findUnique({ where: { email: SHOWCASE_OWNER_EMAIL }, select: { id: true, status: true } });
}

// ── Generador ───────────────────────────────────────────────────────────────
export async function seedShowcase(): Promise<{ restaurants: number; orders: number; customers: number; source: string }> {
  const r = rng(Math.floor(Date.now() / DAY));
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const between = (a: number, b: number) => a + r() * (b - a);
  const int = (a: number, b: number) => Math.floor(between(a, b + 1));

  // 1) Dueño de muestra
  let owner = await prisma.restaurantOwner.findUnique({ where: { email: SHOWCASE_OWNER_EMAIL }, select: { id: true } });
  if (owner) await prisma.restaurantOwner.update({ where: { id: owner.id }, data: { name: "Javiera Muñoz", status: "ACTIVE" } });
  if (!owner) {
    owner = await prisma.restaurantOwner.create({
      data: { email: SHOWCASE_OWNER_EMAIL, name: "Javiera Muñoz", passwordHash: await bcrypt.hash(crypto.randomBytes(24).toString("base64url"), 10), role: "OWNER", status: "ACTIVE", emailVerificado: true, mustChangePassword: false },
      select: { id: true },
    });
  }

  // 2) Carta: Horus Vegan (o respaldo)
  const horus = await prisma.restaurant.findFirst({
    where: { name: { contains: "horus", mode: "insensitive" }, isDemo: false, NOT: { slug: { startsWith: "muestra-" } } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, logoUrl: true, bannerUrl: true },
  });
  let menu: MenuItem[] = [];
  if (horus) {
    const cats = await prisma.category.findMany({
      where: { restaurantId: horus.id, isActive: true }, orderBy: { position: "asc" }, take: 10,
      select: { name: true, dishes: { where: { isActive: true, deletedAt: null }, orderBy: { position: "asc" }, take: 14, select: { name: true, price: true, discountPrice: true, photos: true, description: true } } },
    });
    menu = cats.flatMap((c) => c.dishes.filter((d) => d.price > 0).map((d) => ({ name: d.name, price: Math.round(d.discountPrice && d.discountPrice > 0 && d.discountPrice < d.price ? d.discountPrice : d.price), photo: d.photos?.[0] ?? null, description: d.description, category: c.name })));
  }
  const source = menu.length >= 6 ? `Horus Vegan (${menu.length} platos)` : "carta de respaldo";
  if (menu.length < 6) menu = FALLBACK_MENU.flatMap((c) => c.dishes.map(([name, price, description]) => ({ name, price, description, photo: null, category: c.cat })));
  // Popularidad: unos pocos platos venden mucho más (para "platos estrella").
  const weights = menu.map((_, i) => 1 / Math.pow(i % 17 + 1, 0.8) * between(0.6, 1.4));
  const wsum = weights.reduce((a, b) => a + b, 0);
  const pickDish = () => { let x = r() * wsum; for (let i = 0; i < menu.length; i++) { x -= weights[i]; if (x <= 0) return menu[i]; } return menu[0]; };

  // 3) Clientes de la marca (compartidos entre sucursales)
  type Cust = { name: string; email: string; phone: string; home: number; kind: string; dates: number[] /* días atrás */ };
  const customers: Cust[] = [];
  const usedEmails = new Set<string>();
  const mkCust = (kind: string): Cust => {
    const f = pick(FIRST), l = pick(LAST);
    let email = `${norm(f)}.${norm(l)}@example.com`; let n = 2;
    while (usedEmails.has(email)) email = `${norm(f)}.${norm(l)}${n++}@example.com`;
    usedEmails.add(email);
    const home = r() < 0.55 ? 0 : r() < 0.6 ? 1 : 2;
    return { name: `${f} ${l}`, email, phone: `+569${int(30000000, 99999999)}`, home, kind, dates: [] };
  };
  const schedule = (c: Cust, from: number, to: number, gapMin: number, gapMax: number) => { for (let d = from; d >= to; d -= between(gapMin, gapMax)) c.dates.push(Math.max(0, Math.round(d))); };
  for (let i = 0; i < 70; i++) { const c = mkCust("loyal"); schedule(c, int(90, 330), 0, 6, 18); customers.push(c); }
  for (let i = 0; i < 55; i++) { const c = mkCust("churned"); const stop = int(55, 150); schedule(c, int(stop + 90, 360), stop, 9, 24); customers.push(c); }
  for (let i = 0; i < 35; i++) { const c = mkCust("risk"); const last = int(24, 44); schedule(c, int(last + 80, 300), last, 11, 19); customers.push(c); }
  for (let i = 0; i < 45; i++) { const c = mkCust("new"); c.dates.push(int(0, 28)); customers.push(c); }
  for (let i = 0; i < 110; i++) { const c = mkCust("once"); c.dates.push(int(29, 360)); customers.push(c); }

  let totalOrders = 0;
  const branchIds: string[] = [];
  const recovered: { cust: Cust; daysAgo: number; branchIdx: number }[] = [];

  // Recuperación: los perdidos reciben un correo; algunos vuelven (pedido nuevo después del correo).
  const churned = customers.filter((c) => c.kind === "churned");
  type Enr = { cust: Cust; automation: string; status: string; sentAgo: number; openedAgo?: number; clickedAgo?: number; convertedAgo?: number; reason?: string; coupon?: string };
  const enrollments: Enr[] = [];
  churned.slice(0, 46).forEach((c, i) => {
    const lastAgo = Math.min(...c.dates);
    const sentAgo = Math.max(1, lastAgo - int(46, 60));
    if (sentAgo >= lastAgo) return;
    const survey = i % 5 === 0;
    const e: Enr = { cust: c, automation: survey ? "abandonment_survey" : "recovery_incentive", status: "sent", sentAgo };
    if (survey) { e.reason = pick(["price", "delivery_slow", "no_occasion", "competitor", "delivery_expensive", "quality", "moved"]); e.status = "clicked"; e.clickedAgo = Math.max(0, sentAgo - 1); }
    else if (i % 3 === 0 && sentAgo > 2) {
      e.status = "converted"; e.coupon = `VUELVE-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      e.openedAgo = sentAgo - 1; e.clickedAgo = sentAgo - 1; e.convertedAgo = Math.max(0, sentAgo - int(2, Math.min(10, sentAgo)));
      c.dates.push(e.convertedAgo); recovered.push({ cust: c, daysAgo: e.convertedAgo, branchIdx: c.home });
    } else if (i % 3 === 1) { e.status = "opened"; e.openedAgo = Math.max(0, sentAgo - 1); }
    enrollments.push(e);
  });
  customers.filter((c) => c.kind === "risk").slice(0, 18).forEach((c) => { const lastAgo = Math.min(...c.dates); const sentAgo = Math.max(0, lastAgo - 21); if (sentAgo < lastAgo) enrollments.push({ cust: c, automation: "at_risk", status: r() < 0.4 ? "opened" : "sent", sentAgo, openedAgo: Math.max(0, sentAgo - 1) }); });

  for (let bi = 0; bi < BRANCHES.length; bi++) {
    const b: Branch = BRANCHES[bi];
    // 4) Local (se conserva el id entre regeneraciones)
    const storeCfg = { brandSlug: BRAND_SLUG, branchName: b.branch, theme: "modern", primaryColor: COLOR, paymentMethods: ["efectivo", "webpay"], pickupEnabled: true, deliveryEnabled: true, recovery: { enabled: false }, survey: { enabled: false }, showcase: true };
    const base = {
      name: BRAND, ownerId: owner.id, isActive: false, isDemo: false, address: b.address, commune: b.branch, phone: "+56 2 2345 6789", whatsapp: "+56 9 5555 0101",
      logoUrl: horus?.logoUrl ?? null, bannerUrl: horus?.bannerUrl ?? null, cartaAccentColor: COLOR, cartaTheme: "PREMIUM" as const, defaultView: "impact",
      plan: "PREMIUM" as const, subscriptionStatus: "ACTIVE" as const, billingExempt: true, currentPeriodEnd: new Date("2099-12-31"), lastPaymentAt: new Date(),
      posEnabled: true, ecommerceEnabled: true, centroPedidosEnabled: true, waiterPanelActive: true, weeklyEmailEnabled: false, weeklyInsightsEnabled: false,
      reviewMode: "private", ecommerceStoreConfig: storeCfg as Prisma.InputJsonValue,
    };
    const rest = await prisma.restaurant.upsert({ where: { slug: b.slug }, update: base, create: { ...base, slug: b.slug }, select: { id: true } });
    const rid = rest.id;
    branchIds.push(rid);

    // 5) Limpieza de la generación anterior (la carta se conserva)
    await prisma.recoveryEnrollment.deleteMany({ where: { restaurantId: rid } });
    await prisma.ecommerceSurveyResponse.deleteMany({ where: { restaurantId: rid } });
    await prisma.posOrder.deleteMany({ where: { restaurantId: rid } });
    await prisma.onlineOrder.deleteMany({ where: { restaurantId: rid } });
    const prog = await prisma.loyaltyProgram.findUnique({ where: { restaurantId: rid }, select: { id: true } });
    if (prog) { await prisma.loyaltyTransaction.deleteMany({ where: { member: { programId: prog.id } } }); await prisma.loyaltyMember.deleteMany({ where: { programId: prog.id } }); }
    await prisma.statEvent.deleteMany({ where: { restaurantId: rid } });
    await prisma.session.deleteMany({ where: { restaurantId: rid } });
    await prisma.guestProfile.deleteMany({ where: { id: { startsWith: `scg_${b.key}_` } } });
    await prisma.privateReview.deleteMany({ where: { restaurantId: rid } });
    await prisma.waiterCall.deleteMany({ where: { restaurantId: rid } });
    await prisma.posCashSession.deleteMany({ where: { restaurantId: rid } });
    await prisma.posShift.deleteMany({ where: { restaurantId: rid } });
    await prisma.posTable.deleteMany({ where: { restaurantId: rid } });
    await prisma.posSector.deleteMany({ where: { restaurantId: rid } });
    await prisma.posStaff.deleteMany({ where: { restaurantId: rid } });

    // 6) Carta (solo la primera vez)
    if (!(await prisma.category.count({ where: { restaurantId: rid } }))) {
      const cats = [...new Set(menu.map((m) => m.category))];
      for (let ci = 0; ci < cats.length; ci++) {
        const cat = await prisma.category.create({ data: { restaurantId: rid, name: cats[ci], position: ci, scheduleDays: [] }, select: { id: true } });
        await prisma.dish.createMany({ data: menu.filter((m) => m.category === cats[ci]).map((m, di) => ({ restaurantId: rid, categoryId: cat.id, name: m.name, price: m.price, description: m.description, photos: m.photo ? [m.photo] : [], position: di, dishDiet: "VEGAN" as const, flavorTags: [], tags: [], txDishType: [], txCuisine: [], txMealSlot: [], txIngredient: [], txEstilo: [] })) });
      }
    }
    const dishRows = await prisma.dish.findMany({ where: { restaurantId: rid, isActive: true, deletedAt: null }, select: { id: true, name: true } });
    const dishId = new Map(dishRows.map((d) => [d.name, d.id]));

    // 7) Salón, mesas y equipo
    const salon = `scs_${b.key}_salon`, terraza = `scs_${b.key}_terraza`;
    await prisma.posSector.createMany({ data: [{ id: salon, restaurantId: rid, name: "Salón", position: 0 }, { id: terraza, restaurantId: rid, name: "Terraza", position: 1 }] });
    const tableCount = bi === 0 ? 14 : 10;
    await prisma.posTable.createMany({ data: Array.from({ length: tableCount }, (_, i) => ({ id: `sct_${b.key}_${i + 1}`, restaurantId: rid, number: i + 1, label: `Mesa ${i + 1}`, sectorId: i < tableCount - 4 ? salon : terraza, x: 40 + (i % 4) * 160, y: 40 + Math.floor(i / 4) * 140 })) });
    const staff = ["Rodrigo", "Camila", "Matías", "Fernanda"];
    await prisma.posStaff.createMany({ data: staff.map((n, i) => ({ id: `scst_${b.key}_${i}`, restaurantId: rid, name: n, role: i === 3 ? "cajero" : "garzon" })) });

    // 8) Cajas: una cerrada por día (últimos 45) + la de hoy abierta
    const sessionByDay = new Map<number, string>();
    const shifts: Prisma.PosShiftCreateManyInput[] = [], sessions: Prisma.PosCashSessionCreateManyInput[] = [];
    for (let d = 45; d >= 0; d--) {
      const shiftId = `scsh_${b.key}_${d}`, sid = `scc_${b.key}_${d}`;
      const open = d === 0;
      shifts.push({ id: shiftId, restaurantId: rid, openedAt: chileAt(d, 11, 30), isOpen: open, closedAt: open ? null : chileAt(d, 23, 40), cajaCount: 1, source: "pos", openedBy: "Fernanda", closedBy: open ? null : "Fernanda" });
      sessions.push({ id: sid, restaurantId: rid, shiftId, openedAt: chileAt(d, 11, 30), initialAmount: 50000, isOpen: open, closedAt: open ? null : chileAt(d, 23, 40), source: "pos", openedBy: "Fernanda", closedBy: open ? null : "Fernanda" });
      sessionByDay.set(d, sid);
    }

    // 9) Pedidos del año
    const pos: Prisma.PosOrderCreateManyInput[] = [];
    const web: Prisma.OnlineOrderCreateManyInput[] = [];
    const daySales = new Map<number, { total: number; tips: number; count: number; byMethod: Record<string, number> }>();
    let orderNo = 1000;
    const nowHour = chileHourNow();
    const makeItems = () => {
      const n = r() < 0.35 ? 1 : r() < 0.7 ? 2 : r() < 0.9 ? 3 : 4;
      const lines = new Map<string, { name: string; qty: number; price: number }>();
      for (let i = 0; i < n; i++) { const d = pickDish(); const l = lines.get(d.name); if (l) l.qty++; else lines.set(d.name, { name: d.name, qty: 1, price: d.price }); }
      return [...lines.values()];
    };
    const addOrder = (o: { daysAgo: number; type: "dine-in" | "delivery" | "pickup" | "quick"; cust?: Cust | null; channel?: "web" | "uber" | "pedidosya" | "pos"; active?: "preparing" | "ready" | "table" }) => {
      const lunch = r() < 0.55;
      let h = lunch ? int(12, 15) : int(19, 22), m = int(0, 59);
      if (o.daysAgo === 0) { if (o.active) { h = nowHour; m = Math.max(0, new Date().getUTCMinutes() - int(5, 40)); } else if (h >= nowHour) { h = Math.max(0, nowHour - int(1, 3)); } }
      const createdAt = chileAt(o.daysAgo, h, m);
      if (createdAt.getTime() > Date.now()) createdAt.setTime(Date.now() - int(5, 30) * 60000);
      const lines = makeItems();
      const sub = lines.reduce((s, l) => s + l.price * l.qty, 0);
      const deliveryFee = o.type === "delivery" ? 2490 : 0;
      const tip = o.type === "dine-in" && r() < 0.7 ? Math.round(sub * 0.1 / 100) * 100 : 0;
      const total = sub + deliveryFee + tip;
      const method = o.channel === "web" ? "webpay" : o.channel === "uber" || o.channel === "pedidosya" ? "app_pago" : pick(["debito", "debito", "credito", "efectivo", "transferencia"]);
      const isActive = !!o.active;
      const paid = !(o.active === "table");
      const sid = sessionByDay.get(o.daysAgo);
      const ref = String(++orderNo);
      const cust = o.cust ?? null;
      const name = cust?.name ?? (o.type === "quick" ? `Venta rápida #${orderNo % 100}` : o.type === "dine-in" ? "" : `${pick(FIRST)} ${pick(LAST)[0]}.`);
      const vendor = o.channel === "uber" ? "Uber Eats" : o.channel === "pedidosya" ? "PedidosYa" : o.channel === "web" ? `QC-${BRAND}-Web` : o.type === "quick" ? "" : `QC-${BRAND}`;
      const at = new Date(createdAt.getTime() + int(20, 45) * 60000);
      const extId = o.channel === "web" ? `oo-${id("sco")}` : `sc-${id("")}`;
      const rawPayload: Record<string, unknown> = {};
      if (o.type === "dine-in") rawPayload.mesa = { covers: int(1, 6), garzon: pick(staff.slice(0, 3)) };
      if (paid) {
        if (o.channel === "web") rawPayload.webPayment = { method: "webpay", at: createdAt.toISOString() };
        else rawPayload.posPayment = { method, parts: [{ method, amount: total, received: total, change: 0 }], received: total, tip, change: 0, at: at.toISOString(), by: "Fernanda", origin: "caja", balance: 0, cashSessionId: sid ?? null };
      }
      const stage = !isActive ? "delivered" : o.active === "ready" ? "ready" : "preparing";
      pos.push({
        restaurantId: rid, externalId: extId, provider: o.channel === "web" ? "ecommerce" : "pos", posStatus: isActive ? (o.active === "ready" ? "ready" : "preparing") : "delivered", opsStage: stage,
        saleType: o.type, isDelivery: o.type === "delivery", tableLabel: o.type === "dine-in" ? `Mesa ${int(1, tableCount)}` : null,
        customerName: name, customerEmail: cust && o.channel !== "uber" && o.channel !== "pedidosya" ? cust.email : "", customerPhone: cust ? cust.phone : "",
        addressLine: o.type === "delivery" ? `${pick(STREETS)} ${int(100, 3999)}, ${b.branch}` : "",
        totalAmount: total, paidAmount: paid ? total : 0, tipAmount: tip, deliveryFee, vendorName: vendor || null, orderReference: ref,
        items: lines.map((l) => ({ productName: l.name, quantity: l.qty, unit_price: l.price, options: [] })) as Prisma.InputJsonValue,
        rawPayload: rawPayload as Prisma.InputJsonValue, cashSessionId: paid ? sid ?? null : null,
        createdAt, completedAt: isActive ? null : at, opsDeliveredAt: isActive ? null : at, opsReadyForDeliveryAt: isActive && o.active !== "ready" ? null : new Date(createdAt.getTime() + 15 * 60000),
        opsDispatchedAt: o.type === "delivery" && !isActive ? new Date(createdAt.getTime() + 18 * 60000) : null,
      });
      if (o.channel === "web" && cust) {
        web.push({
          id: extId.slice(3), restaurantId: rid, customerName: cust.name, customerPhone: cust.phone, customerEmail: cust.email, orderType: o.type === "delivery" ? "DELIVERY" : "PICKUP",
          paymentMethod: "webpay", paymentStatus: "paid", items: lines.map((l) => ({ dishName: l.name, name: l.name, quantity: l.qty, unit_price: l.price, unitTotal: l.price, options: [] })) as Prisma.InputJsonValue,
          total, deliveryFee, status: isActive ? (o.active === "ready" ? "READY" : "PREPARING") : "DONE", statusHistory: [{ status: "ACCEPTED", ts: createdAt.toISOString() }, ...(isActive ? [] : [{ status: "DONE", ts: at.toISOString() }])] as Prisma.InputJsonValue,
          source: "ecommerce", channel: "web", orderNumber: orderNo, createdAt,
          deliveryAddress: o.type === "delivery" ? `${pick(STREETS)} ${int(100, 3999)}, ${b.branch}` : null,
        });
      }
      if (paid && !isActive) {
        const ds = daySales.get(o.daysAgo) ?? { total: 0, tips: 0, count: 0, byMethod: {} };
        ds.total += total - tip; ds.tips += tip; ds.count++; ds.byMethod[method] = (ds.byMethod[method] ?? 0) + total; daySales.set(o.daysAgo, ds);
      }
    };

    // Clientes con nombre (de esta sucursal)
    const mine = customers.filter((c) => c.home === bi);
    const custByDay = new Map<number, Cust[]>();
    for (const c of mine) for (const d of c.dates) { const l = custByDay.get(d) ?? []; l.push(c); custByDay.set(d, l); }
    for (let d = 364; d >= 0; d--) {
      const date = new Date(Date.now() - d * DAY);
      const dow = date.getUTCDay();
      const weekday = [0.8, 0.75, 0.85, 0.95, 1.1, 1.45, 1.3][dow];
      const growth = 0.7 + 0.45 * (1 - d / 364);
      let count = Math.round(13 * b.weight * weekday * growth * between(0.8, 1.2));
      if (d === 0) count = Math.round(count * Math.min(1, Math.max(0.15, (nowHour - 11) / 11)));
      for (const c of custByDay.get(d) ?? []) {
        const recentWeb = d <= 120 && r() < 0.6;
        addOrder({ daysAgo: d, type: r() < 0.55 ? "delivery" : "pickup", cust: c, channel: recentWeb ? "web" : "pos" });
        count--;
      }
      for (let i = 0; i < Math.max(0, count); i++) {
        const x = r();
        if (x < 0.58) addOrder({ daysAgo: d, type: "dine-in" });
        else if (x < 0.7) addOrder({ daysAgo: d, type: "quick" });
        else if (x < 0.88) addOrder({ daysAgo: d, type: "delivery", channel: r() < 0.55 ? "uber" : "pedidosya" });
        else addOrder({ daysAgo: d, type: "pickup" });
      }
    }
    // Ahora mismo: mesas ocupadas y pedidos en preparación
    const nowCust = mine.filter((c) => c.kind === "loyal");
    for (let i = 0; i < (bi === 0 ? 5 : 3); i++) addOrder({ daysAgo: 0, type: "dine-in", active: "table" });
    addOrder({ daysAgo: 0, type: "delivery", cust: nowCust[0] ?? null, channel: "web", active: "preparing" });
    addOrder({ daysAgo: 0, type: "delivery", channel: "uber", active: "preparing" });
    addOrder({ daysAgo: 0, type: "pickup", cust: nowCust[1] ?? null, channel: "web", active: "ready" });
    // Mesas ocupadas distintas (una cuenta por mesa)
    const seen = new Set<string>();
    for (const p of pos) if (p.paidAmount === 0 && p.tableLabel) { while (seen.has(p.tableLabel!)) p.tableLabel = `Mesa ${int(1, tableCount)}`; seen.add(p.tableLabel!); }

    // Totales de las cajas cerradas
    for (const s of sessions) {
      const d = Number(String(s.id).split("_").pop());
      const ds = daySales.get(d);
      if (!ds || s.isOpen) continue;
      s.totalSales = ds.total; s.totalTips = ds.tips; s.closedAccounts = ds.count;
      s.expectedAmounts = { efectivo: 50000 + (ds.byMethod.efectivo ?? 0), debito: ds.byMethod.debito ?? 0, credito: ds.byMethod.credito ?? 0, transferencia: ds.byMethod.transferencia ?? 0, webpay: 0, app_pago: 0 } as Prisma.InputJsonValue;
      s.countedAmounts = s.expectedAmounts; s.difference = 0;
    }
    for (const sh of shifts) { const d = Number(String(sh.id).split("_").pop()); const ds = daySales.get(d); if (ds && !sh.isOpen) sh.totalSales = ds.total; }
    await prisma.posShift.createMany({ data: shifts });
    await prisma.posCashSession.createMany({ data: sessions });
    await createChunks(web, (batch) => prisma.onlineOrder.createMany({ data: batch }));
    await createChunks(pos, (batch) => prisma.posOrder.createMany({ data: batch }));
    totalOrders += pos.length;

    // 10) Recuperación (en la sucursal de cada cliente)
    const enrs = enrollments.filter((e) => e.cust.home === bi);
    if (enrs.length) {
      const returnOrders = await prisma.posOrder.findMany({ where: { restaurantId: rid, customerEmail: { in: enrs.filter((e) => e.convertedAgo !== undefined).map((e) => e.cust.email) } }, orderBy: { createdAt: "desc" }, select: { id: true, customerEmail: true, createdAt: true } });
      await prisma.recoveryEnrollment.createMany({
        data: enrs.map((e) => {
          const conv = e.convertedAgo !== undefined ? returnOrders.find((o) => o.customerEmail === e.cust.email) : undefined;
          return {
            id: id("scr"), restaurantId: rid, customerEmail: e.cust.email, customerPhone: e.cust.phone, customerName: e.cust.name, automation: e.automation, status: e.status,
            couponCode: e.coupon ?? null, sentAt: chileAt(e.sentAgo, 11, 5), openedAt: e.openedAgo !== undefined ? chileAt(e.openedAgo, 13, 20) : null, clickedAt: e.clickedAgo !== undefined ? chileAt(e.clickedAgo, 13, 25) : null,
            convertedAt: conv ? conv.createdAt : null, convertedOrderId: conv?.id ?? null,
            surveyReason: e.reason ?? null, surveyAnsweredAt: e.reason ? chileAt(e.clickedAgo ?? 0, 13, 30) : null, createdAt: chileAt(e.sentAgo + 1, 9, 0),
          };
        }),
      });
    }

    // 11) Encuestas de satisfacción (pedidos web)
    const surveyed = web.filter((w) => w.status === "DONE").slice(-40);
    if (surveyed.length) {
      await prisma.ecommerceSurveyResponse.createMany({
        data: surveyed.map((w) => {
          const v = () => (r() < 0.75 ? 5 : r() < 0.7 ? 4 : 3);
          return { id: id("scq"), restaurantId: rid, orderId: w.id as string, customerName: w.customerName, ratings: { q_web: { t: "¿Qué tal fue pedir en la web?", v: v() }, q_delivery: { t: "¿Llegó a tiempo?", v: v() }, q_food: { t: "¿Qué tal la comida?", v: v() } }, comment: r() < 0.3 ? pick(["Todo increíble, la burger buenísima", "Llegó rápido y caliente", "Me encanta que sea todo vegano", "Muy rico, volveré a pedir"]) : null, createdAt: new Date((w.createdAt as Date).getTime() + 3 * 3600000) };
        }),
      });
    }

    // 12) Fidelización (tarjeta de sellos)
    const program = await prisma.loyaltyProgram.upsert({
      where: { restaurantId: rid },
      update: { active: true, cardColorHex: COLOR, name: `Tarjeta ${BRAND}` },
      create: { restaurantId: rid, name: `Tarjeta ${BRAND}`, active: true, cardColorHex: COLOR, stampGoal: 8, rewards: [{ stamp: 8, reward: "Burger gratis" }], description: "Junta sellos con cada visita y gana premios.", birthdayEnabled: true, birthdayTitle: "¡Feliz cumpleaños!", birthdayMessage: "Hoy te regalamos un postre." },
      select: { id: true },
    });
    const loyalMembers = mine.filter((c) => c.kind !== "once").slice(0, bi === 0 ? 120 : 70);
    const extra = Array.from({ length: bi === 0 ? 60 : 30 }, () => mkCust("member"));
    const members = [...loyalMembers, ...extra].map((c) => {
      const enrolledAgo = c.dates.length ? Math.max(...c.dates) : int(5, 200);
      const visits = Math.max(1, c.dates.length || int(1, 5));
      return { c, mid: id("scm"), enrolledAgo, visits, lastAgo: c.dates.length ? Math.min(...c.dates) : int(0, enrolledAgo) };
    });
    await prisma.loyaltyMember.createMany({
      data: members.map((m) => ({ id: m.mid, programId: program.id, restaurantId: rid, name: m.c.name, email: m.c.email, phone: m.c.phone, stamps: m.visits % 8, completedCards: Math.floor(m.visits / 8), enrolledAt: chileAt(m.enrolledAgo, 13, 10), lastStampAt: chileAt(m.lastAgo, 14, 0), birthDate: new Date(Date.UTC(int(1975, 2003), int(0, 11), int(1, 28))) })),
    });
    const txs: Prisma.LoyaltyTransactionCreateManyInput[] = [];
    for (const m of members) {
      const dates = m.c.dates.length ? m.c.dates : [m.lastAgo];
      dates.slice(0, 20).forEach((d, i) => {
        txs.push({ id: id("sct"), memberId: m.mid, type: "STAMP_ADD", amount: 1, createdAt: chileAt(d, 14, 0) });
        if ((i + 1) % 8 === 0) { txs.push({ id: id("sct"), memberId: m.mid, type: "REWARD_EARN", amount: 1, createdAt: chileAt(d, 14, 1) }); if (r() < 0.7) txs.push({ id: id("sct"), memberId: m.mid, type: "REWARD_REDEEM", amount: 1, createdAt: chileAt(Math.max(0, d - 3), 14, 0) }); }
      });
    }
    await createChunks(txs, (batch) => prisma.loyaltyTransaction.createMany({ data: batch }));

    // 13) Analítica de la carta QR (últimos 30 días)
    const guests: Prisma.GuestProfileCreateManyInput[] = [], sess: Prisma.SessionCreateManyInput[] = [], evs: Prisma.StatEventCreateManyInput[] = [];
    let gi = 0;
    for (let d = 30; d >= 0; d--) {
      const n = Math.round(38 * b.weight * between(0.7, 1.3) * (d === 0 ? Math.min(1, Math.max(0.2, (nowHour - 11) / 11)) : 1));
      for (let k = 0; k < n; k++) {
        const gid = `scg_${b.key}_${gi++}`, sId = id("scse");
        const startedAt = chileAt(d, r() < 0.5 ? int(12, 15) : int(19, 22), int(0, 59));
        if (startedAt.getTime() > Date.now()) startedAt.setTime(Date.now() - int(5, 120) * 60000);
        const views = int(2, 7);
        guests.push({ id: gid, createdAt: startedAt, lastSeenAt: startedAt, visitCount: r() < 0.3 ? int(2, 6) : 1, totalSessions: 1, deviceType: r() < 0.85 ? "mobile" : "desktop" });
        sess.push({ id: sId, guestId: gid, restaurantId: rid, startedAt, endedAt: new Date(startedAt.getTime() + views * 40000), durationMs: views * int(20000, 60000), isQrScan: r() < 0.7, deviceType: "mobile", cartaLang: r() < 0.88 ? "es" : r() < 0.6 ? "en" : "pt", viewUsed: "impact", isReturningVisitor: r() < 0.3 });
        evs.push({ id: id("sce"), restaurantId: rid, eventType: "SESSION_START", sessionId: sId, guestId: gid, createdAt: startedAt });
        for (let v = 0; v < views; v++) { const dsh = pickDish(); evs.push({ id: id("sce"), restaurantId: rid, eventType: "DISH_VIEW", sessionId: sId, guestId: gid, dishId: dishId.get(dsh.name) ?? null, createdAt: new Date(startedAt.getTime() + v * 30000) }); }
        if (r() < 0.12) evs.push({ id: id("sce"), restaurantId: rid, eventType: "FILTER_APPLIED", sessionId: sId, guestId: gid, query: pick(["popular", "estrella", "gluten-free"]), createdAt: startedAt });
      }
    }
    await createChunks(guests, (batch) => prisma.guestProfile.createMany({ data: batch }));
    await createChunks(sess, (batch) => prisma.session.createMany({ data: batch }));
    await createChunks(evs, (batch) => prisma.statEvent.createMany({ data: batch }), 2000);

    // 14) Llamadas al garzón de hoy y valoraciones privadas
    const calls = Array.from({ length: bi === 0 ? 7 : 4 }, (_, i) => { const at = new Date(Date.now() - int(3, 240) * 60000); return { id: id("scw"), restaurantId: rid, tableName: `Mesa ${int(1, tableCount)}`, calledAt: at, answeredAt: i < 2 ? null : new Date(at.getTime() + int(1, 4) * 60000), createdAt: at }; });
    await prisma.waiterCall.createMany({ data: calls });
    const COMMENTS = ["Excelente atención y la comida increíble", "Muy rico todo, volveremos", "La espera fue un poco larga", "Las porciones podrían ser más grandes", "El mejor lugar vegano de la zona", "Muy buena música y ambiente"];
    await prisma.privateReview.createMany({ data: Array.from({ length: bi === 0 ? 26 : 14 }, () => { const rating = r() < 0.7 ? 5 : r() < 0.7 ? 4 : int(2, 3); return { id: id("scv"), restaurantId: rid, rating, comment: r() < 0.7 ? pick(COMMENTS) : null, authorName: pick(FIRST), isRead: r() < 0.6, createdAt: chileAt(int(0, 180), 21, int(0, 59)) }; }) });
  }

  void recovered;
  return { restaurants: branchIds.length, orders: totalOrders, customers: customers.length, source };
}
