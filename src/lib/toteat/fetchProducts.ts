/**
 * Fetches the full Toteat product catalog (all dishes the restaurant has
 * configured in the POS) — not just those that have sold recently.
 * In-memory cached for 5 minutes since the catalog rarely changes.
 */

import { ToteatCredentials, envCredentials } from "./fetchSales";

export interface ToteatCatalogProduct {
  id: string;          // e.g. "HV0010"
  idToteat: number;    // big internal id
  name: string;
  description?: string;
  price: number;
  category: string | null;
  categoryId: string | null;
  isModifier: boolean;
  alcohol: boolean;
  modificationDate: string;
  images: string[];
}

export interface ToteatProductsResponse {
  ok?: boolean;
  data?: ToteatCatalogProduct[];
  msg?: { texto?: string } | string;
}

const TTL_MS = 5 * 60 * 1000; // 5 min
const cache = new Map<string, { at: number; payload: ToteatProductsResponse }>();

export async function fetchToteatProducts(
  args: { credentials?: ToteatCredentials; activeOnly?: boolean } = {}
): Promise<ToteatProductsResponse> {
  const creds = args.credentials || envCredentials();
  if (!creds) return { ok: false, msg: "Missing Toteat credentials" };

  const key = `${creds.xir}|${creds.xil}|${args.activeOnly !== false}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.payload;

  const url = `${creds.base}/products?xir=${creds.xir}&xil=${creds.xil}&xiu=${creds.xiu}&xapitoken=${creds.token}&activeProducts=${args.activeOnly !== false ? "true" : "false"}`;
  try {
    const res = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
    const payload: ToteatProductsResponse = await res.json();
    if (payload.ok !== false || (payload.data && payload.data.length > 0)) {
      cache.set(key, { at: Date.now(), payload });
    }
    return payload;
  } catch (err: any) {
    return { ok: false, msg: `Toteat /products fetch failed: ${err?.message || "unknown"}` };
  }
}

export function clearToteatProductsCache() {
  cache.clear();
}
