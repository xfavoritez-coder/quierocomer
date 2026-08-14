import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, assertOwnsRestaurant, authErrorResponse } from "@/lib/adminAuth";
import { parseBankFile } from "@/lib/parseBankFile";

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
  let rows;
  try {
    rows = await parseBankFile(buffer, file.name);
  } catch (e: any) {
    console.error("parseBankFile error:", e);
    return NextResponse.json({ error: `Error al leer el archivo: ${e.message || e}` }, { status: 422 });
  }
  if (rows.length === 0) return NextResponse.json({ error: "No se encontraron movimientos válidos en el archivo. Verifica que sea un estado de cuenta BCI con el formato correcto." }, { status: 422 });

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
