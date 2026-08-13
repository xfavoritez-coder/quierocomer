import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, assertOwnsRestaurant, authErrorResponse } from "@/lib/adminAuth";

// ── Parsear número en formato chileno "1.234.567" o "1,234,567" ──
function parseCLP(raw: string): number {
  if (!raw) return 0;
  // Elimina puntos de miles y convierte comas en decimales
  const clean = raw.trim().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : Math.round(n);
}

// ── Parsear fecha DD/MM/YYYY o YYYY-MM-DD ──
function parseDate(raw: string): Date {
  const s = raw.trim();
  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/");
    return new Date(`${y}-${m}-${d}T12:00:00.000Z`);
  }
  return new Date(s);
}

// ── Parsear CSV de BCI ──
// Formato esperado (con ; o ,):
// Fecha;Descripción;N° Documento;Cargo;Abono;Saldo
function parseBCICSV(csv: string): { date: Date; description: string; amount: number; balance: number; reference: string }[] {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  // Detectar separador
  const sep = lines[0].includes(";") ? ";" : ",";
  // Buscar línea header (contiene "Fecha" o "fecha")
  const headerIdx = lines.findIndex((l) => /fecha/i.test(l));
  if (headerIdx === -1) return [];

  const headers = lines[headerIdx].split(sep).map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));

  const iDate = headers.findIndex((h) => h.includes("fecha"));
  const iDesc = headers.findIndex((h) => h.includes("descr") || h.includes("glosa") || h.includes("detalle"));
  const iRef = headers.findIndex((h) => h.includes("document") || h.includes("n°") || h.includes("numero") || h.includes("ref"));
  const iCargo = headers.findIndex((h) => h === "cargo" || h.includes("débito") || h.includes("debito"));
  const iAbono = headers.findIndex((h) => h === "abono" || h.includes("crédito") || h.includes("credito"));
  const iSaldo = headers.findIndex((h) => h === "saldo");

  const rows = lines.slice(headerIdx + 1);
  const result = [];

  for (const row of rows) {
    const cols = row.split(sep).map((c) => c.trim().replace(/^["']|["']$/g, ""));
    if (cols.length < 3) continue;

    const dateRaw = iDate >= 0 ? cols[iDate] : cols[0];
    const desc = iDesc >= 0 ? cols[iDesc] : cols[1];
    const ref = iRef >= 0 ? cols[iRef] : "";
    const cargo = iCargo >= 0 ? parseCLP(cols[iCargo]) : 0;
    const abono = iAbono >= 0 ? parseCLP(cols[iAbono]) : 0;
    const saldo = iSaldo >= 0 ? parseCLP(cols[iSaldo]) : 0;

    if (!dateRaw || !desc) continue;

    // amount: positivo = ingreso (abono), negativo = egreso (cargo)
    const amount = abono > 0 ? abono : -cargo;
    if (amount === 0) continue;

    try {
      result.push({ date: parseDate(dateRaw), description: desc, amount, balance: saldo, reference: ref });
    } catch {
      // skip invalid date
    }
  }

  return result;
}

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  const month = req.nextUrl.searchParams.get("month"); // "2026-08"
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });
  try { await assertOwnsRestaurant(req, restaurantId); } catch (e: any) { return authErrorResponse(e); }

  const where: Record<string, unknown> = { restaurantId };
  if (month) {
    const [y, m] = month.split("-").map(Number);
    where.date = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
  }

  const movements = await prisma.bankMovement.findMany({
    where,
    orderBy: { date: "desc" },
    take: 500,
    include: { entry: { include: { category: { select: { name: true, color: true, icon: true } } } } },
  });

  return NextResponse.json(movements);
}

// POST: importar CSV de BCI
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const body = await req.json();
  const { restaurantId, csv } = body;
  if (!restaurantId || !csv) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  try { await assertOwnsRestaurant(req, restaurantId); } catch (e: any) { return authErrorResponse(e); }

  const rows = parseBCICSV(csv);
  if (rows.length === 0) return NextResponse.json({ error: "No se encontraron movimientos válidos en el CSV" }, { status: 422 });

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    // Evitar duplicados: misma fecha + descripción + monto
    const existing = await prisma.bankMovement.findFirst({
      where: { restaurantId, date: row.date, description: row.description, amount: row.amount },
      select: { id: true },
    });
    if (existing) { skipped++; continue; }

    await prisma.bankMovement.create({
      data: {
        restaurantId,
        date: row.date,
        description: row.description,
        amount: row.amount,
        balance: row.balance || null,
        reference: row.reference || null,
        source: "BANK_CSV",
      },
    });
    created++;
  }

  return NextResponse.json({ created, skipped, total: rows.length });
}

export async function DELETE(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const body = await req.json();
  const { id, restaurantId } = body;
  if (!id || !restaurantId) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  try { await assertOwnsRestaurant(req, restaurantId); } catch (e: any) { return authErrorResponse(e); }

  await prisma.bankMovement.delete({ where: { id, restaurantId } });
  return NextResponse.json({ ok: true });
}

// PATCH: asignar categoría a un movimiento (crea FinancialEntry)
export async function PATCH(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const body = await req.json();
  const { movementId, restaurantId, categoryId } = body;
  if (!movementId || !restaurantId) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  try { await assertOwnsRestaurant(req, restaurantId); } catch (e: any) { return authErrorResponse(e); }

  const movement = await prisma.bankMovement.findUnique({ where: { id: movementId, restaurantId } });
  if (!movement) return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });

  // Si categoryId null → desconciliar (borrar entry asociada)
  if (!categoryId) {
    const entry = await prisma.financialEntry.findUnique({ where: { bankMovementId: movementId } });
    if (entry) await prisma.financialEntry.delete({ where: { id: entry.id } });
    await prisma.bankMovement.update({ where: { id: movementId }, data: { reconciledAt: null } });
    return NextResponse.json({ ok: true });
  }

  const cat = await prisma.financialCategory.findUnique({ where: { id: categoryId }, select: { type: true } });
  if (!cat) return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });

  // Upsert entry
  const existing = await prisma.financialEntry.findUnique({ where: { bankMovementId: movementId } });
  if (existing) {
    await prisma.financialEntry.update({
      where: { id: existing.id },
      data: { categoryId, type: cat.type, amount: Math.abs(movement.amount) },
    });
  } else {
    await prisma.financialEntry.create({
      data: {
        restaurantId,
        categoryId,
        amount: Math.abs(movement.amount),
        type: cat.type,
        date: movement.date,
        description: movement.description,
        source: "BANK_CSV",
        bankMovementId: movementId,
      },
    });
  }

  await prisma.bankMovement.update({
    where: { id: movementId },
    data: { reconciledAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
