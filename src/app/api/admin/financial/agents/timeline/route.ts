import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, assertOwnsRestaurant, authErrorResponse } from "@/lib/adminAuth";

export type TimelineItem =
  | { kind: "transfer"; id: string; date: string; amount: number; description: string; status: string }
  | { kind: "purchase"; id: string; date: string; amount: number; description: string; category: string | null; categoryIcon: string | null };

export type TimelineResponse = {
  items: TimelineItem[];
  runningBalance: number[];
  totalTransferred: number;
  totalSpent: number;
  balance: number;
};

// GET /api/admin/financial/agents/timeline?restaurantId=X&agentId=Y&month=YYYY-MM
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const { searchParams } = req.nextUrl;
  const restaurantId = searchParams.get("restaurantId");
  const agentId = searchParams.get("agentId");
  const monthParam = searchParams.get("month");

  if (!restaurantId || !agentId) {
    return NextResponse.json({ error: "restaurantId and agentId required" }, { status: 400 });
  }

  try { await assertOwnsRestaurant(req, restaurantId); } catch (e: unknown) { return authErrorResponse(e as Error); }

  const now = new Date();
  const [y, m] = monthParam
    ? monthParam.split("-").map(Number)
    : [now.getFullYear(), now.getMonth() + 1];

  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);

  // Fetch bank transfers to agent
  const bankMovements = await prisma.bankMovement.findMany({
    where: {
      restaurantId,
      agentId,
      date: { gte: start, lt: end },
    },
    orderBy: { date: "asc" },
  });

  // Fetch FinancialEntries from /flujo (source=FLUJO) for this restaurant + month
  const flujoEntries = await prisma.financialEntry.findMany({
    where: {
      restaurantId,
      source: "FLUJO",
      date: { gte: start, lt: end },
    },
    include: {
      category: { select: { name: true, icon: true } },
    },
    orderBy: { date: "asc" },
  });

  // Build timeline items
  const transfers: TimelineItem[] = bankMovements.map(bm => ({
    kind: "transfer",
    id: bm.id,
    date: bm.date.toISOString(),
    amount: bm.debit ?? 0,
    description: bm.description,
    status: bm.status,
  }));

  const purchases: TimelineItem[] = flujoEntries.map(fe => ({
    kind: "purchase",
    id: fe.id,
    date: fe.date.toISOString(),
    amount: fe.amount,
    description: fe.description ?? "",
    category: fe.category?.name ?? null,
    categoryIcon: fe.category?.icon ?? null,
  }));

  // Merge and sort: same-day transfers come before purchases
  const all: TimelineItem[] = [...transfers, ...purchases].sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    if (da !== db) return da - db;
    // Transfers first on same day
    if (a.kind === "transfer" && b.kind === "purchase") return -1;
    if (a.kind === "purchase" && b.kind === "transfer") return 1;
    return 0;
  });

  // Calculate running balance
  let balance = 0;
  const runningBalance: number[] = [];
  for (const item of all) {
    if (item.kind === "transfer") {
      balance += item.amount;
    } else {
      balance -= item.amount;
    }
    runningBalance.push(balance);
  }

  const totalTransferred = transfers.reduce((s, t) => s + t.amount, 0);
  const totalSpent = purchases.reduce((s, p) => s + p.amount, 0);

  const response: TimelineResponse = {
    items: all,
    runningBalance,
    totalTransferred,
    totalSpent,
    balance: totalTransferred - totalSpent,
  };

  return NextResponse.json(response);
}
