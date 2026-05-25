import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";

/**
 * Bot knowledge base — stored as JSON in a special StatEvent with eventType BOT_KNOWLEDGE.
 * GET: returns current knowledge entries
 * POST: saves/updates knowledge entries
 */

interface KnowledgeEntry {
  id: string;
  topic: string;
  content: string;
  enabled: boolean;
}

async function getKnowledge(): Promise<KnowledgeEntry[]> {
  try {
    const records = await prisma.$queryRaw`
      SELECT metadata FROM "StatEvent" WHERE "eventType" = 'BOT_KNOWLEDGE' ORDER BY "createdAt" DESC LIMIT 1
    ` as any[];
    return records[0]?.metadata?.entries || [];
  } catch { return []; }
}

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const entries = await getKnowledge();
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { entries } = await req.json();
  if (!Array.isArray(entries)) return NextResponse.json({ error: "entries required" }, { status: 400 });

  // Need a real restaurantId to satisfy FK — grab first restaurant
  const anyRestaurant = await prisma.restaurant.findFirst({ select: { id: true } });
  if (!anyRestaurant) return NextResponse.json({ error: "No hay restaurantes en el sistema" }, { status: 500 });

  const id = `bot_${Date.now()}`;
  const meta = JSON.stringify({ entries });
  await prisma.$transaction(async (tx) => {
    // Insert first — if this fails, nothing gets deleted
    await tx.$executeRaw`INSERT INTO "StatEvent" (id, "restaurantId", "sessionId", "eventType", metadata, "createdAt") VALUES (${id}, ${anyRestaurant.id}, 'bot', 'BOT_KNOWLEDGE', ${meta}::jsonb, NOW())`;
    // Only delete old entries after successful insert
    await tx.$executeRaw`DELETE FROM "StatEvent" WHERE "eventType" = 'BOT_KNOWLEDGE' AND id != ${id}`;
  });

  return NextResponse.json({ ok: true, count: entries.length });
}
