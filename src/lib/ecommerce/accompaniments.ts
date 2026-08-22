// ═══════════════════════════════════════════════════════════
//  Acompañamientos del checkout (portado de Servio).
//  Dos sistemas combinables:
//   • Por monto: máx según subtotal (qtyPer por cada perAmount, con minOrder).
//   • Por producto: pool por grupo = Σ(regla.quantity × cantidad del producto
//     en el carrito); las opciones de un grupo comparten el pool.
// ═══════════════════════════════════════════════════════════

export interface AccompItem {
  name: string;
  qtyPer: number; // cantidad que se otorga por cada tramo
  perAmount: number; // tamaño del tramo en CLP (ej: 10000)
  minOrder: number; // mínimo $ para que aparezca (0 = siempre)
}

export interface AccompGroup {
  id: string;
  name: string;
  options: string[]; // nombres de items (del sistema por monto) que comparten el pool
}

export interface AccompRule {
  productId: string;
  groupId: string;
  quantity: number; // unidades de pool que otorga cada unidad del producto
}

export interface AccompConfig {
  perAmountEnabled: boolean;
  perProductEnabled: boolean;
  items: AccompItem[];
  groups: AccompGroup[];
  rules: AccompRule[];
}

export interface UnifiedEntry {
  name: string;
  type: "amount" | "group";
  groupId?: string;
}

export interface CartLine {
  product_id: string;
  quantity: number;
}

export function emptyAccompConfig(): AccompConfig {
  return { perAmountEnabled: false, perProductEnabled: false, items: [], groups: [], rules: [] };
}

function num(v: unknown, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export function parseAccompConfig(raw: unknown): AccompConfig {
  const o = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const items = Array.isArray(o.items)
    ? (o.items as unknown[]).map((it) => {
        const x = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
        return { name: String(x.name ?? "").trim(), qtyPer: Math.max(1, Math.round(num(x.qtyPer, 1))), perAmount: Math.max(1, Math.round(num(x.perAmount, 10000))), minOrder: Math.max(0, Math.round(num(x.minOrder, 0))) };
      }).filter((i) => i.name)
    : [];
  const groups = Array.isArray(o.groups)
    ? (o.groups as unknown[]).map((g) => {
        const x = (g && typeof g === "object" ? g : {}) as Record<string, unknown>;
        return { id: String(x.id ?? Math.random().toString(36).slice(2, 9)), name: String(x.name ?? "").trim(), options: Array.isArray(x.options) ? (x.options as unknown[]).map(String) : [] };
      }).filter((g) => g.name)
    : [];
  const rules = Array.isArray(o.rules)
    ? (o.rules as unknown[]).map((r) => {
        const x = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
        return { productId: String(x.productId ?? ""), groupId: String(x.groupId ?? ""), quantity: Math.max(1, Math.round(num(x.quantity, 1))) };
      }).filter((r) => r.productId && r.groupId)
    : [];
  return {
    perAmountEnabled: o.perAmountEnabled === true,
    perProductEnabled: o.perProductEnabled === true,
    items, groups, rules,
  };
}

/** Pool total por grupo (sistema por producto). */
export function groupPools(cfg: AccompConfig, items: CartLine[]): Record<string, number> {
  if (!cfg.perProductEnabled) return {};
  const pools: Record<string, number> = {};
  for (const rule of cfg.rules) {
    const cartQty = items.filter((i) => i.product_id === rule.productId).reduce((s, i) => s + i.quantity, 0);
    if (cartQty > 0) pools[rule.groupId] = (pools[rule.groupId] ?? 0) + cartQty * (rule.quantity ?? 1);
  }
  return pools;
}

/** Lista unificada de acompañamientos a mostrar, respetando el orden de los items. */
export function buildUnifiedList(cfg: AccompConfig, items: CartLine[], subtotal: number): UnifiedEntry[] {
  if (!cfg.perAmountEnabled) return [];
  const pools = groupPools(cfg, items);
  const result: UnifiedEntry[] = [];
  for (const item of cfg.items) {
    if (cfg.perProductEnabled) {
      const group = cfg.groups.find((g) => g.options.includes(item.name));
      if (group) {
        if (pools[group.id]) result.push({ name: item.name, type: "group", groupId: group.id });
        continue;
      }
    }
    if (item.minOrder && item.minOrder > 0 && subtotal < item.minOrder) continue;
    result.push({ name: item.name, type: "amount" });
  }
  return result;
}

/** Máximo seleccionable para un acompañamiento, dado lo ya elegido. */
export function accomMaxFor(entry: UnifiedEntry, cfg: AccompConfig, subtotal: number, pools: Record<string, number>, selectedQty: Record<string, number>): number {
  if (entry.type === "amount") {
    const item = cfg.items.find((a) => a.name === entry.name);
    if (!item || !item.perAmount || !item.qtyPer) return 99;
    const porMonto = Math.floor(subtotal / item.perAmount) * item.qtyPer;
    const alcanzaMinimo = !!item.minOrder && item.minOrder > 0 && subtotal >= item.minOrder;
    return alcanzaMinimo ? Math.max(item.qtyPer, porMonto) : Math.max(0, porMonto);
  }
  const group = cfg.groups.find((g) => g.id === entry.groupId);
  if (!group) return 0;
  const pool = pools[entry.groupId!] ?? 0;
  const otherSelected = group.options.filter((o) => o !== entry.name).reduce((s, o) => s + (selectedQty[o] ?? 0), 0);
  return Math.max(0, pool - otherSelected);
}
