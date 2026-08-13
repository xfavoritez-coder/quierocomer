import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, assertOwnsRestaurant, authErrorResponse } from "@/lib/adminAuth";
import * as XLSX from "xlsx";
import { createHash } from "crypto";

// ── Convertir número serial de Excel a Date ──
function excelDateToJS(serial: number): Date {
  // Excel usa 1 = 1 ene 1900 (con bug de año bisiesto en 1900)
  const utcDays = serial - 25569; // 25569 = días entre 1/1/1900 y 1/1/1970
  const ms = utcDays * 86400 * 1000;
  const d = new Date(ms);
  // Fijar a mediodía UTC para evitar problemas de zona horaria
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
}

type ParsedRow = {
  date: Date;
  description: string;
  debit: number | null;
  credit: number | null;
  balance: number | null;
  externalKey: string;
};

// ── Parsear XLSX de BCI ──
// Columnas: Fecha Transacción | Fecha Contable | Descripción | Egreso (-) | Ingreso (+) | Saldo
function parseBCIXLSX(buffer: Buffer): ParsedRow[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
  });

  // Buscar fila header (contiene "Descripción" o "Fecha Transacción")
  const headerIdx = raw.findIndex(
    (r) => r && typeof r[2] === "string" && /descrip/i.test(r[2])
  );
  if (headerIdx === -1) return [];

  const result: ParsedRow[] = [];

  for (const row of raw.slice(headerIdx + 1)) {
    if (!row || !row[0] || !row[2]) continue;

    const dateRaw = row[0];
    const desc = String(row[2]).trim();
    if (!desc) continue;

    let date: Date;
    if (typeof dateRaw === "number") {
      date = excelDateToJS(dateRaw);
    } else {
      // Intentar parsear DD/MM/YYYY
      const s = String(dateRaw).trim();
      const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) date = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 12, 0, 0));
      else continue;
    }

    const debit = row[3] && row[3] !== "" ? Math.round(Number(row[3])) : null;
    const credit = row[4] && row[4] !== "" ? Math.round(Number(row[4])) : null;
    const balance = row[5] ? Math.round(Number(row[5])) : null;

    if (!debit && !credit) continue;

    const amount = debit ?? credit ?? 0;
    const externalKey = createHash("sha1")
      .update(`${date.toISOString()}|${desc}|${debit ?? ""}|${credit ?? ""}`)
      .digest("hex")
      .slice(0, 16);

    result.push({ date, description: desc, debit, credit, balance, externalKey });
  }

  return result;
}

// ── Auto-categorizar un movimiento según reglas + agentes ──
async function autoCategorizeSingle(
  restaurantId: string,
  description: string
): Promise<{ agentId?: string; suggestedCatId?: string } | null> {
  // 1. ¿Es retiro a un CashAgent?
  const agents = await prisma.cashAgent.findMany({
    where: { restaurantId, isActive: true },
    select: { id: true, bankPatterns: true },
  });
  for (const agent of agents) {
    if (agent.bankPatterns.some((p) => description.toLowerCase().includes(p.toLowerCase()))) {
      return { agentId: agent.id };
    }
  }

  // 2. ¿Hay una regla de categorización?
  const rules = await prisma.categorizationRule.findMany({
    where: { restaurantId },
    select: { id: true, pattern: true, categoryId: true, isSplit: true },
  });
  for (const rule of rules) {
    if (description.toLowerCase().includes(rule.pattern.toLowerCase())) {
      if (!rule.isSplit && rule.categoryId) {
        // Actualizar lastUsedAt
        await prisma.categorizationRule.update({
          where: { id: rule.id },
          data: { lastUsedAt: new Date() },
        });
        return { suggestedCatId: rule.categoryId };
      }
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET: listar movimientos del mes
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  const month = req.nextUrl.searchParams.get("month"); // "2026-08"
  const status = req.nextUrl.searchParams.get("status"); // "PENDING,SUGGESTED,RECONCILED,IGNORED"
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  const where: Record<string, unknown> = { restaurantId };
  if (month) {
    const [y, m] = month.split("-").map(Number);
    where.date = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
  }
  if (status) {
    where.status = { in: status.split(",") };
  }

  const movements = await prisma.bankMovement.findMany({
    where,
    orderBy: { date: "desc" },
    take: 1000,
    include: {
      agent: { select: { id: true, name: true } },
      entries: {
        include: {
          category: { select: { id: true, name: true, color: true, icon: true, type: true } },
        },
      },
    },
  });

  // Agregar categoría sugerida si aplica
  const catIds = movements
    .map((m) => m.suggestedCatId)
    .filter(Boolean) as string[];
  const suggestedCats =
    catIds.length > 0
      ? await prisma.financialCategory.findMany({
          where: { id: { in: catIds } },
          select: { id: true, name: true, color: true, icon: true, type: true },
        })
      : [];
  const catMap = new Map(suggestedCats.map((c) => [c.id, c]));

  const result = movements.map((m) => ({
    ...m,
    suggestedCategory: m.suggestedCatId ? catMap.get(m.suggestedCatId) : null,
  }));

  return NextResponse.json(result);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST: importar XLSX de BCI (FormData con campo "file")
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const formData = await req.formData();
  const restaurantId = formData.get("restaurantId") as string;
  const file = formData.get("file") as File | null;

  if (!restaurantId || !file) {
    return NextResponse.json({ error: "Faltan campos (restaurantId, file)" }, { status: 400 });
  }
  try { await assertOwnsRestaurant(req, restaurantId); } catch (e: any) { return authErrorResponse(e); }

  const buffer = Buffer.from(await file.arrayBuffer());
  const rows = parseBCIXLSX(buffer);
  if (rows.length === 0) {
    return NextResponse.json({ error: "No se encontraron movimientos válidos en el archivo" }, { status: 422 });
  }

  let created = 0;
  let skipped = 0;
  let autoSuggested = 0;

  for (const row of rows) {
    // Dedup por externalKey
    const exists = await prisma.bankMovement.findUnique({
      where: { restaurantId_externalKey: { restaurantId, externalKey: row.externalKey } },
      select: { id: true },
    });
    if (exists) { skipped++; continue; }

    // Auto-categorizar
    const suggestion = await autoCategorizeSingle(restaurantId, row.description);
    const isAgent = !!suggestion?.agentId;
    const hasSuggestion = !!suggestion?.suggestedCatId;

    await prisma.bankMovement.create({
      data: {
        restaurantId,
        date: row.date,
        description: row.description,
        debit: row.debit,
        credit: row.credit,
        balance: row.balance,
        source: "BCI_XLSX",
        externalKey: row.externalKey,
        status: isAgent ? "PENDING" : hasSuggestion ? "SUGGESTED" : "PENDING",
        agentId: suggestion?.agentId ?? null,
        suggestedCatId: suggestion?.suggestedCatId ?? null,
      },
    });

    created++;
    if (isAgent || hasSuggestion) autoSuggested++;
  }

  return NextResponse.json({ created, skipped, total: rows.length, autoSuggested });
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH: categorizar movimiento (simple o split) / marcar como ignorado
// body: { movementId, restaurantId, action: "categorize"|"split"|"ignore"|"uncategorize",
//         categoryId?, splits?: [{categoryId, amount, description?}] }
// ─────────────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const body = await req.json();
  const { movementId, restaurantId, action, categoryId, splits } = body;

  if (!movementId || !restaurantId || !action) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }
  try { await assertOwnsRestaurant(req, restaurantId); } catch (e: any) { return authErrorResponse(e); }

  const movement = await prisma.bankMovement.findUnique({
    where: { id: movementId, restaurantId },
  });
  if (!movement) return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });

  // ── IGNORAR ──
  if (action === "ignore") {
    // Borrar entries si existían
    await prisma.financialEntry.deleteMany({ where: { bankMovementId: movementId } });
    await prisma.bankMovement.update({
      where: { id: movementId },
      data: { status: "IGNORED", suggestedCatId: null },
    });
    return NextResponse.json({ ok: true });
  }

  // ── DESHACER CATEGORIZACIÓN ──
  if (action === "uncategorize") {
    await prisma.financialEntry.deleteMany({ where: { bankMovementId: movementId } });
    await prisma.bankMovement.update({
      where: { id: movementId },
      data: { status: "PENDING" },
    });
    return NextResponse.json({ ok: true });
  }

  const movAmount = movement.debit ?? movement.credit ?? 0;
  const movType = movement.debit ? "EXPENSE" : "INCOME";

  // ── CATEGORIZACIÓN SIMPLE ──
  if (action === "categorize") {
    if (!categoryId) return NextResponse.json({ error: "categoryId requerido" }, { status: 400 });

    const cat = await prisma.financialCategory.findUnique({
      where: { id: categoryId },
      select: { type: true, name: true },
    });
    if (!cat) return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });

    // Borrar entries previas
    await prisma.financialEntry.deleteMany({ where: { bankMovementId: movementId } });

    await prisma.financialEntry.create({
      data: {
        restaurantId,
        categoryId,
        amount: movAmount,
        type: cat.type,
        date: movement.date,
        description: movement.description,
        source: "BANK_CSV",
        bankMovementId: movementId,
      },
    });

    await prisma.bankMovement.update({
      where: { id: movementId },
      data: { status: "RECONCILED", suggestedCatId: null },
    });

    // Aprender: guardar/actualizar regla para futuros movimientos similares
    const pattern = extractPattern(movement.description);
    if (pattern) {
      await prisma.categorizationRule.upsert({
        where: { restaurantId_pattern: { restaurantId, pattern } },
        create: { restaurantId, pattern, categoryId, isSplit: false, usageCount: 1 },
        update: {
          categoryId,
          isSplit: false,
          usageCount: { increment: 1 },
          confidence: { set: Math.min(1.0, 0.7 + 0.05) },
          lastUsedAt: new Date(),
        },
      });
    }

    return NextResponse.json({ ok: true });
  }

  // ── SPLIT: distribuir en múltiples categorías ──
  if (action === "split") {
    if (!splits || !Array.isArray(splits) || splits.length < 2) {
      return NextResponse.json({ error: "Se necesitan al menos 2 splits" }, { status: 400 });
    }

    const totalSplit: number = splits.reduce((s: number, sp: { amount: number }) => s + sp.amount, 0);
    if (totalSplit !== movAmount) {
      return NextResponse.json(
        { error: `La suma de los splits ($${totalSplit}) no coincide con el monto del movimiento ($${movAmount})` },
        { status: 400 }
      );
    }

    // Borrar entries previas
    await prisma.financialEntry.deleteMany({ where: { bankMovementId: movementId } });

    for (const sp of splits) {
      const cat = await prisma.financialCategory.findUnique({
        where: { id: sp.categoryId },
        select: { type: true },
      });
      if (!cat) continue;

      await prisma.financialEntry.create({
        data: {
          restaurantId,
          categoryId: sp.categoryId,
          amount: sp.amount,
          type: cat.type,
          date: movement.date,
          description: sp.description || movement.description,
          source: "BANK_CSV",
          bankMovementId: movementId,
        },
      });
    }

    await prisma.bankMovement.update({
      where: { id: movementId },
      data: { status: "RECONCILED", suggestedCatId: null },
    });

    // Aprender la regla de split (ratios)
    const pattern = extractPattern(movement.description);
    if (pattern) {
      await prisma.categorizationRule.upsert({
        where: { restaurantId_pattern: { restaurantId, pattern } },
        create: {
          restaurantId,
          pattern,
          isSplit: true,
          usageCount: 1,
          splits: {
            create: splits.map((sp: { categoryId: string; amount: number }) => ({
              categoryId: sp.categoryId,
              ratio: sp.amount / movAmount,
            })),
          },
        },
        update: {
          isSplit: true,
          usageCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });
    }

    return NextResponse.json({ ok: true });
  }

  // ── ASIGNAR A AGENTE ──
  if (action === "assign_agent") {
    const { agentId } = body;
    if (!agentId) return NextResponse.json({ error: "agentId requerido" }, { status: 400 });
    // Verificar que el agente pertenece al restaurante
    const agent = await prisma.cashAgent.findFirst({ where: { id: agentId, restaurantId } });
    if (!agent) return NextResponse.json({ error: "Agente no encontrado" }, { status: 404 });
    // Borrar entries si las había, quitar categorización
    await prisma.financialEntry.deleteMany({ where: { bankMovementId: movementId } });
    await prisma.bankMovement.update({
      where: { id: movementId },
      data: { agentId, status: "PENDING", suggestedCatId: null },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE: eliminar movimiento
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const body = await req.json();
  const { id, restaurantId } = body;
  if (!id || !restaurantId) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  try { await assertOwnsRestaurant(req, restaurantId); } catch (e: any) { return authErrorResponse(e); }

  await prisma.financialEntry.deleteMany({ where: { bankMovementId: id } });
  await prisma.bankMovement.delete({ where: { id, restaurantId } });
  return NextResponse.json({ ok: true });
}

// ── Extraer pattern significativo de la descripción ──
// "Transferencia enviada a Hod Foods SpA" → "Hod Foods"
// "Abono PNOL de TRANSBANK S A"           → "TRANSBANK"
// "Pago en línea Previred"                → "Previred"
function extractPattern(description: string): string | null {
  // "enviada a X" → extraer X (primeras 3 palabras)
  const toMatch = description.match(/(?:enviada? a|recibida? de|pago (?:en línea )?(?:a )?)\s+(.+)/i);
  if (toMatch) {
    const words = toMatch[1].trim().split(/\s+/).slice(0, 3).join(" ");
    return words.length > 2 ? words : null;
  }
  // "Abono PNOL de X" → extraer X
  const fromMatch = description.match(/de (.+)/i);
  if (fromMatch) {
    const words = fromMatch[1].trim().split(/\s+/).slice(0, 2).join(" ");
    return words.length > 2 ? words : null;
  }
  // Fallback: usar primeras 3 palabras significativas
  const words = description.split(/\s+/).filter((w) => w.length > 3).slice(0, 2).join(" ");
  return words.length > 4 ? words : null;
}
