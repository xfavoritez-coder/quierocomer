/**
 * Fetches Toteat sales for a given date range with a short-lived in-memory
 * cache (30s) shared across all routes. Reads credentials from a Restaurant
 * row when given, or from TOTEAT_* env vars as a development fallback.
 */

import { chileTodayYYYYMMDD } from "./timezone";

export interface ToteatProduct {
  id: string;
  name: string;
  quantity: number;
  netPrice: number;
  payed: number;
  taxes?: number;
  discounts?: number;
  hierarchyId?: string;
  hierarchyName?: string;
}

export interface ToteatSale {
  orderId: number;
  dateClosed: string;
  dateOpen: string;
  total: number;
  payed: number;
  gratuity?: number;
  numberClients?: number;
  tableId?: number;
  tableName?: string;
  waiterId?: number;
  waiterName?: string;
  subtotal?: number;
  taxes?: number;
  fiscalType?: string;
  paymentForms?: { method?: string }[];
  products: ToteatProduct[];
}

export interface ToteatSalesResponse {
  ok?: boolean;
  data?: ToteatSale[];
  msg?: { texto?: string } | string;
}

export interface ToteatCredentials {
  base: string;
  xir: string;
  xil: string | number;
  xiu: string | number;
  token: string;
}

const TTL_MS = 30_000;
const cache = new Map<string, { at: number; payload: ToteatSalesResponse }>();

export function envCredentials(): ToteatCredentials | null {
  const base = process.env.TOTEAT_API_BASE;
  const xir = process.env.TOTEAT_RESTAURANT_ID;
  const xil = process.env.TOTEAT_LOCAL_ID;
  const xiu = process.env.TOTEAT_USER_ID;
  const token = process.env.TOTEAT_API_TOKEN;
  if (!base || !xir || !xil || !xiu || !token) return null;
  return { base, xir, xil, xiu, token };
}

export async function fetchToteatSales(
  args: { ini?: string; end?: string; credentials?: ToteatCredentials } = {}
): Promise<ToteatSalesResponse> {
  const creds = args.credentials || envCredentials();
  if (!creds) return { ok: false, msg: "Missing Toteat credentials" };

  const today = chileTodayYYYYMMDD();
  const i = args.ini || today;
  const e = args.end || today;
  const key = `${creds.xir}|${creds.xil}|${i}|${e}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.payload;

  const url = `${creds.base}/sales?xir=${creds.xir}&xil=${creds.xil}&xiu=${creds.xiu}&xapitoken=${creds.token}&ini=${i}&end=${e}`;
  try {
    const res = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
    const payload: ToteatSalesResponse = await res.json();
    if (payload.ok !== false || (payload.data && payload.data.length >= 0)) {
      cache.set(key, { at: Date.now(), payload });
    }
    return payload;
  } catch (err: any) {
    return { ok: false, msg: `Toteat fetch failed: ${err?.message || "unknown"}` };
  }
}

export function clearToteatSalesCache() {
  cache.clear();
}
