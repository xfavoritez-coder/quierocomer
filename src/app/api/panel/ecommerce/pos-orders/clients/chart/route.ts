import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";
import { isSuperAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  if (isSuperAdmin(req)) return true;
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId === "demo") return true;
  if (panelId.startsWith("tm_")) return teamMemberCanAccess(panelId.slice(3), restaurantId);
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

type Granularity = "day" | "week" | "month";
type RangeParam = "today" | "7d" | "30d" | "90d" | "365d";

function chileDate(d: Date): string {
  // Approximate Chile time (UTC-3)
  return new Date(d.getTime() - 3 * 3600000).toISOString().slice(0, 10);
}

function getGranularity(range: RangeParam): Granularity {
  if (range === "today" || range === "7d" || range === "30d") return "day";
  if (range === "90d") return "week";
  return "month";
}

function getRangeDates(range: RangeParam): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  let from: Date;
  if (range === "today") {
    const todayStr = chileDate(now);
    from = new Date(`${todayStr}T03:00:00Z`); // midnight Chile = UTC-3 = 03:00 UTC
    return { from, to };
  }
  const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 365;
  from = new Date(now.getTime() - days * 24 * 3600000);
  return { from, to };
}

function bucketExprForCol(col: string, gran: Granularity): string {
  if (gran === "day")
    return `(${col} AT TIME ZONE 'America/Santiago')::date`;
  if (gran === "week")
    return `date_trunc('week', ${col} AT TIME ZONE 'America/Santiago')::date`;
  return `date_trunc('month', ${col} AT TIME ZONE 'America/Santiago')::date`;
}

function generateExpectedBuckets(range: RangeParam, gran: Granularity): string[] {
  const { from, to } = getRangeDates(range);
  const buckets: string[] = [];

  if (gran === "day") {
    // Walk day by day
    const cur = new Date(from);
    while (cur <= to) {
      buckets.push(chileDate(cur));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  } else if (gran === "week") {
    // Find Monday of the week containing `from`
    const fromStr = chileDate(from);
    const d = new Date(`${fromStr}T12:00:00Z`);
    const dow = d.getUTCDay(); // 0=Sun
    d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow)); // back to Monday
    while (d <= to) {
      buckets.push(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 7);
    }
  } else {
    // month
    const fromStr = chileDate(from);
    const year = parseInt(fromStr.slice(0, 4));
    const month = parseInt(fromStr.slice(5, 7));
    let y = year, m = month;
    while (true) {
      const bucket = `${y}-${String(m).padStart(2, "0")}-01`;
      buckets.push(bucket);
      m++;
      if (m > 12) { m = 1; y++; }
      const toStr = chileDate(to);
      if (bucket > toStr) break;
      if (`${y}-${String(m).padStart(2, "0")}-01` > toStr) break;
    }
  }

  return buckets;
}

function formatLabel(dateStr: string, gran: Granularity, prevDateStr: string | null): string {
  // dateStr is YYYY-MM-DD
  try {
    const d = new Date(`${dateStr}T12:00:00Z`);
    if (gran === "month") {
      const year = dateStr.slice(0, 4);
      const prevYear = prevDateStr ? prevDateStr.slice(0, 4) : null;
      const monthName = new Intl.DateTimeFormat("es-CL", { month: "short", timeZone: "UTC" }).format(d).replace(".", "");
      if (prevYear !== null && prevYear !== year) {
        return `${monthName} '${year.slice(2)}`;
      }
      return monthName;
    }
    // day or week: "4 nov"
    const day = d.getUTCDate();
    const monthName = new Intl.DateTimeFormat("es-CL", { month: "short", timeZone: "UTC" }).format(d).replace(".", "");
    return `${day} ${monthName}`;
  } catch {
    return dateStr;
  }
}

/** GET /api/panel/ecommerce/pos-orders/clients/chart
 *  Params: restaurantId (required)
 *          branchIds    (optional, comma-separated)
 *          range        (today|7d|30d|90d|365d, default 30d)
 */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const range = (req.nextUrl.searchParams.get("range") || "30d") as RangeParam;
  const rawBranchIds = req.nextUrl.searchParams.get("branchIds") || "";
  const extraIds = rawBranchIds ? rawBranchIds.split(",").map(s => s.trim()).filter(Boolean) : [];
  const allIds = Array.from(new Set([restaurantId, ...extraIds]));

  const gran = getGranularity(range);
  const { from, to } = getRangeDates(range);

  // Build safe SQL literal for IN clause
  const idsLiteral = allIds.map(id => `'${id.replace(/'/g, "''")}'`).join(", ");

  const bucketExprCreatedAt = bucketExprForCol(`"createdAt"`, gran);
  const firstBucketExpr = bucketExprForCol(`fo.first_at`, gran);

  // Combina PosOrder + OnlineOrder usando email (preferido) o teléfono como clave de cliente
  const sql = `
    WITH
    all_orders AS (
      SELECT
        COALESCE(NULLIF(LOWER(TRIM("customerEmail")), ''), NULLIF(TRIM("customerPhone"), '')) AS client_key,
        "createdAt"
      FROM "PosOrder"
      WHERE "restaurantId" IN (${idsLiteral})
        AND "posStatus" != 'canceled'
        AND COALESCE(NULLIF(LOWER(TRIM("customerEmail")), ''), NULLIF(TRIM("customerPhone"), '')) IS NOT NULL
      UNION ALL
      SELECT
        COALESCE(NULLIF(LOWER(TRIM("customerEmail")), ''), NULLIF(TRIM("customerPhone"), '')) AS client_key,
        "createdAt"
      FROM "OnlineOrder"
      WHERE "restaurantId" IN (${idsLiteral})
        AND "status" != 'CANCELLED'
        AND "source" = 'ecommerce'
        AND COALESCE(NULLIF(LOWER(TRIM("customerEmail")), ''), NULLIF(TRIM("customerPhone"), '')) IS NOT NULL
    ),
    first_orders AS (
      SELECT client_key, MIN("createdAt") as first_at
      FROM all_orders
      GROUP BY client_key
    ),
    range_data AS (
      SELECT client_key, ${bucketExprCreatedAt} as order_bucket
      FROM all_orders
      WHERE "createdAt" >= $1::timestamptz
        AND "createdAt" <= $2::timestamptz
    ),
    client_buckets AS (SELECT DISTINCT client_key, order_bucket FROM range_data)
    SELECT
      cb.order_bucket::text as bucket,
      COUNT(CASE WHEN ${firstBucketExpr} = cb.order_bucket THEN 1 END)::int as new_clients,
      COUNT(CASE WHEN ${firstBucketExpr} < cb.order_bucket THEN 1 END)::int as recurring_clients
    FROM client_buckets cb
    JOIN first_orders fo ON cb.client_key = fo.client_key
    GROUP BY cb.order_bucket
    ORDER BY cb.order_bucket
  `;

  interface RawRow {
    bucket: string;
    new_clients: number;
    recurring_clients: number;
  }

  const rows = (await prisma.$queryRawUnsafe<RawRow[]>(sql, from, to)).map(r => ({
    bucket: r.bucket,
    newClients: Number(r.new_clients),
    recurringClients: Number(r.recurring_clients),
  }));

  // Fill in missing buckets
  const rowMap = new Map(rows.map(r => [r.bucket, r]));
  const expectedBuckets = generateExpectedBuckets(range, gran);

  const buckets = expectedBuckets.map((dateStr, idx) => {
    const existing = rowMap.get(dateStr);
    const prevDateStr = idx > 0 ? expectedBuckets[idx - 1] : null;
    return {
      date: dateStr,
      label: formatLabel(dateStr, gran, prevDateStr),
      newClients: existing?.newClients ?? 0,
      recurringClients: existing?.recurringClients ?? 0,
    };
  });

  return NextResponse.json({ buckets, gran });
}
