import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";
import { isSuperAdmin } from "@/lib/adminAuth";
import { parseEmailCsv, readImportedClients, type ImportedClient } from "@/lib/ecommerce/recoveryImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMPORTED = 20000;

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  if (isSuperAdmin(req)) return true;
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId === "demo") return true;
  if (panelId.startsWith("tm_")) return teamMemberCanAccess(panelId.slice(3), restaurantId);
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

/** Lee la config como objeto mutable (sin perder otras claves). */
async function readConfig(restaurantId: string): Promise<Record<string, unknown>> {
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ecommerceStoreConfig: true } });
  return (r?.ecommerceStoreConfig && typeof r.ecommerceStoreConfig === "object" && !Array.isArray(r.ecommerceStoreConfig))
    ? { ...(r.ecommerceStoreConfig as Record<string, unknown>) } : {};
}

/** GET: cuántos clientes importados hay guardados. */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const cfg = await readConfig(restaurantId);
  return NextResponse.json({ count: readImportedClients(cfg).length });
}

/**
 * POST: sube un CSV (cuerpo de texto). Autodetecta la columna de correo, fusiona con
 * la lista guardada (sin duplicar) y la persiste en ecommerceStoreConfig.recoveryImportedClients.
 */
export async function POST(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const text = await req.text();
  if (!text || !text.trim()) return NextResponse.json({ error: "Archivo vacío" }, { status: 400 });
  if (text.length > 8_000_000) return NextResponse.json({ error: "Archivo demasiado grande (máx. ~8 MB)" }, { status: 413 });

  const parsed = parseEmailCsv(text);
  if (!parsed.clients.length) {
    return NextResponse.json({
      error: parsed.emailColumn
        ? "No se encontró ningún correo válido en el archivo."
        : "No pude identificar una columna de correo. Asegúrate de que el CSV tenga una columna con los emails.",
      emailColumn: parsed.emailColumn, invalid: parsed.invalid, rows: parsed.rows,
    }, { status: 422 });
  }

  const cfg = await readConfig(restaurantId);
  const existing = readImportedClients(cfg);
  const byEmail = new Map<string, ImportedClient>(existing.map((c) => [c.email.toLowerCase(), c]));

  let added = 0;
  let updated = 0;
  for (const c of parsed.clients) {
    const key = c.email.toLowerCase();
    const prev = byEmail.get(key);
    if (!prev) { byEmail.set(key, c); added++; }
    else if (c.name && c.name !== prev.name) { byEmail.set(key, { ...prev, name: c.name }); updated++; }
  }

  let merged = [...byEmail.values()];
  let truncated = false;
  if (merged.length > MAX_IMPORTED) { merged = merged.slice(0, MAX_IMPORTED); truncated = true; }

  cfg.recoveryImportedClients = merged;
  await prisma.restaurant.update({ where: { id: restaurantId }, data: { ecommerceStoreConfig: cfg as object } });

  return NextResponse.json({
    ok: true,
    emailColumn: parsed.emailColumn,
    found: parsed.clients.length,
    added,
    updated,
    duplicatesInFile: parsed.duplicatesInFile,
    invalid: parsed.invalid,
    total: merged.length,
    truncated,
  });
}

/** DELETE: limpia la lista de clientes importados. */
export async function DELETE(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const cfg = await readConfig(restaurantId);
  delete cfg.recoveryImportedClients;
  await prisma.restaurant.update({ where: { id: restaurantId }, data: { ecommerceStoreConfig: cfg as object } });
  return NextResponse.json({ ok: true, count: 0 });
}
