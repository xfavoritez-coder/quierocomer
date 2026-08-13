import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, assertOwnsRestaurant, authErrorResponse } from "@/lib/adminAuth";
import * as XLSX from "xlsx";
import { createHash } from "crypto";

function excelDateToJS(serial: number): Date {
  const utcDays = serial - 25569;
  const ms = utcDays * 86400 * 1000;
  const d = new Date(ms);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
}

function parseBCIXLSX(buffer: Buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  const headerIdx = raw.findIndex(r => r && typeof r[2] === "string" && /descrip/i.test(r[2]));
  if (headerIdx === -1) return [];

  const result = [];
  for (const row of raw.slice(headerIdx + 1)) {
    if (!row || !row[0] || !row[2]) continue;
    const dateRaw = row[0];
    const desc = String(row[2]).trim();
    if (!desc) continue;
    let date: Date;
    if (typeof dateRaw === "number") {
      date = excelDateToJS(dateRaw);
    } else {
      const s = String(dateRaw).trim();
      const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) date = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 12, 0, 0));
      else continue;
    }
    const debit = row[3] && row[3] !== "" ? Math.round(Number(row[3])) : null;
    const credit = row[4] && row[4] !== "" ? Math.round(Number(row[4])) : null;
    if (!debit && !credit) continue;
    const externalKey = createHash("sha1")
      .update(`${date.toISOString()}|${desc}|${debit ?? ""}|${credit ?? ""}`)
      .digest("hex").slice(0, 16);
    result.push({ date, description: desc, debit, credit, balance: row[5] ? Math.round(Number(row[5])) : null, externalKey });
  }
  return result;
}

// POST /api/admin/financial/movements/preview
// Recibe el XLSX, analiza qué hay nuevo vs duplicado vs auto-sugerido, SIN guardar nada.
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const formData = await req.formData();
  const restaurantId = formData.get("restaurantId") as string;
  const file = formData.get("file") as File | null;
  if (!restaurantId || !file) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  try { await assertOwnsRestaurant(req, restaurantId); } catch (e: any) { return authErrorResponse(e); }

  const buffer = Buffer.from(await file.arrayBuffer());
  const rows = parseBCIXLSX(buffer);
  if (rows.length === 0) return NextResponse.json({ error: "No se encontraron movimientos válidos" }, { status: 422 });

  // Obtener todos los externalKeys ya existentes para este restaurante
  const existingKeys = new Set(
    (await prisma.bankMovement.findMany({ where: { restaurantId }, select: { externalKey: true } }))
      .map(m => m.externalKey).filter(Boolean)
  );

  // Cargar agentes y reglas para pre-clasificar
  const agents = await prisma.cashAgent.findMany({ where: { restaurantId, isActive: true }, select: { id: true, name: true, bankPatterns: true } });
  const rules = await prisma.categorizationRule.findMany({ where: { restaurantId }, select: { pattern: true, categoryId: true, isSplit: true } });
  const cats = await prisma.financialCategory.findMany({ where: { restaurantId }, select: { id: true, name: true } });
  const catById = new Map(cats.map(c => [c.id, c]));

  const preview: {
    date: string; description: string; debit: number | null; credit: number | null;
    isNew: boolean; isDuplicate: boolean;
    agentName?: string; suggestedCategory?: string; isSplit?: boolean;
  }[] = [];

  for (const row of rows) {
    const isDuplicate = existingKeys.has(row.externalKey);
    let agentName: string | undefined;
    let suggestedCategory: string | undefined;
    let isSplit: boolean | undefined;

    if (!isDuplicate) {
      // Detectar agente
      for (const agent of agents) {
        if (agent.bankPatterns.some(p => row.description.toLowerCase().includes(p.toLowerCase()))) {
          agentName = agent.name; break;
        }
      }
      // Detectar regla si no es agente
      if (!agentName) {
        for (const rule of rules) {
          if (row.description.toLowerCase().includes(rule.pattern.toLowerCase())) {
            if (!rule.isSplit && rule.categoryId) {
              suggestedCategory = catById.get(rule.categoryId)?.name;
            } else if (rule.isSplit) {
              isSplit = true;
              suggestedCategory = "Split";
            }
            break;
          }
        }
      }
    }

    preview.push({
      date: row.date.toISOString(),
      description: row.description,
      debit: row.debit,
      credit: row.credit,
      isNew: !isDuplicate,
      isDuplicate,
      agentName,
      suggestedCategory,
      isSplit,
    });
  }

  const newCount = preview.filter(p => p.isNew).length;
  const duplicateCount = preview.filter(p => p.isDuplicate).length;
  const agentCount = preview.filter(p => p.isNew && p.agentName).length;
  const suggestedCount = preview.filter(p => p.isNew && p.suggestedCategory).length;
  const pendingCount = newCount - agentCount - suggestedCount;

  return NextResponse.json({
    total: rows.length,
    newCount,
    duplicateCount,
    agentCount,
    suggestedCount,
    pendingCount,
    rows: preview,
  });
}
