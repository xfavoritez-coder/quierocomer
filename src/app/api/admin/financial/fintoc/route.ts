import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, assertOwnsRestaurant, authErrorResponse } from "@/lib/adminAuth";
import { Fintoc } from "fintoc";

const fintoc = new Fintoc(process.env.FINTOC_SECRET_KEY!);

// GET /api/admin/financial/fintoc?restaurantId=xxx
// Retorna estado de conexión Fintoc del restaurante
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });
  try { await assertOwnsRestaurant(req, restaurantId); } catch (e: any) { return authErrorResponse(e); }

  const r = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { fintocLinkToken: true, fintocAccountId: true, fintocLastSync: true },
  });
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    connected: !!r.fintocLinkToken,
    accountId: r.fintocAccountId,
    lastSync: r.fintocLastSync,
  });
}

// POST /api/admin/financial/fintoc
// body: { restaurantId, action: "widget_token" | "connect" | "sync" | "disconnect", ... }
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const body = await req.json();
  const { restaurantId, action } = body;
  if (!restaurantId || !action) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  try { await assertOwnsRestaurant(req, restaurantId); } catch (e: any) { return authErrorResponse(e); }

  // ── Obtener widget token para iniciar el widget de Fintoc ──
  if (action === "widget_token") {
    try {
      const res = await fetch("https://api.fintoc.com/v1/widget_tokens", {
        method: "POST",
        headers: {
          "Authorization": process.env.FINTOC_SECRET_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ product: "movements" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail || `Fintoc API error ${res.status}`);
      }
      const data = await res.json();
      return NextResponse.json({ widget_token: data.widget_token });
    } catch (e: any) {
      console.error("Fintoc widget_token error:", e);
      return NextResponse.json({ error: e.message || "Error creando widget token" }, { status: 500 });
    }
  }

  // ── Guardar link_token tras conexión exitosa ──
  if (action === "connect") {
    const { link_token, account_id } = body;
    if (!link_token) return NextResponse.json({ error: "link_token requerido" }, { status: 400 });

    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        fintocLinkToken: link_token,
        fintocAccountId: account_id || null,
        fintocLastSync: null,
      },
    });
    return NextResponse.json({ ok: true });
  }

  // ── Sincronizar movimientos ──
  if (action === "sync") {
    const r = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { fintocLinkToken: true, fintocAccountId: true, fintocLastSync: true },
    });
    if (!r?.fintocLinkToken) {
      return NextResponse.json({ error: "Banco no conectado" }, { status: 400 });
    }

    try {
      const result = await syncFintocMovements(restaurantId, r.fintocLinkToken, r.fintocAccountId, r.fintocLastSync);
      return NextResponse.json(result);
    } catch (e: any) {
      console.error("Fintoc sync error:", e);
      return NextResponse.json({ error: e.message || "Error sincronizando" }, { status: 500 });
    }
  }

  // ── Desconectar banco ──
  if (action === "disconnect") {
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { fintocLinkToken: null, fintocAccountId: null, fintocLastSync: null },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
}

// ── Lógica compartida de sincronización (también usada por el cron) ──
export async function syncFintocMovements(
  restaurantId: string,
  linkToken: string,
  accountId: string | null,
  lastSync: Date | null
) {
  const link = await fintoc.links.get(linkToken);

  // Listar cuentas y elegir la guardada o la primera disponible
  const accountsList: any[] = await (link as any).accounts.list();
  if (!accountsList || accountsList.length === 0) throw new Error("No hay cuentas disponibles en este link");

  const account = (accountId ? accountsList.find((a: any) => a.id === accountId) : null) || accountsList[0];

  // Traer movimientos desde la última sync (o últimos 3 meses)
  const since = lastSync
    ? lastSync.toISOString().slice(0, 10)
    : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const movements: any[] = await account.movements.list({ since });

  let created = 0;
  let skipped = 0;

  // Cargar agentes y reglas para auto-clasificar
  const agents = await prisma.cashAgent.findMany({
    where: { restaurantId, isActive: true },
    select: { id: true, bankPatterns: true },
  });
  const rules = await prisma.categorizationRule.findMany({
    where: { restaurantId },
    select: { id: true, pattern: true, categoryId: true, isSplit: true },
  });

  for (const mv of movements) {
    const externalKey = `fintoc_${account.id}_${mv.id}`;
    const exists = await prisma.bankMovement.findUnique({
      where: { restaurantId_externalKey: { restaurantId, externalKey } },
      select: { id: true },
    });
    if (exists) { skipped++; continue; }

    const rawAmount: number = mv.amount ?? 0;
    const amount = Math.abs(rawAmount);
    const isDebit = mv.type === "debit" || rawAmount < 0;
    const description: string = mv.description || mv.comment || "";

    // Auto-clasificar
    let agentId: string | null = null;
    let suggestedCatId: string | null = null;
    let status: "PENDING" | "SUGGESTED" = "PENDING";

    for (const agent of agents) {
      if (agent.bankPatterns.some((p) => description.toLowerCase().includes(p.toLowerCase()))) {
        agentId = agent.id;
        break;
      }
    }
    if (!agentId) {
      for (const rule of rules) {
        if (description.toLowerCase().includes(rule.pattern.toLowerCase())) {
          if (!rule.isSplit && rule.categoryId) {
            suggestedCatId = rule.categoryId;
            status = "SUGGESTED";
            await prisma.categorizationRule.update({
              where: { id: rule.id },
              data: { lastUsedAt: new Date() },
            });
          }
          break;
        }
      }
    }

    await prisma.bankMovement.create({
      data: {
        restaurantId,
        date: new Date(mv.post_date || mv.transaction_date),
        description,
        debit: isDebit ? amount : null,
        credit: isDebit ? null : amount,
        balance: mv.balance ?? null,
        source: "BANK_API",
        externalKey,
        status,
        agentId,
        suggestedCatId,
      },
    });
    created++;
  }

  // Actualizar timestamp de última sync
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { fintocAccountId: account.id, fintocLastSync: new Date() },
  });

  return { created, skipped, total: movements.length };
}
