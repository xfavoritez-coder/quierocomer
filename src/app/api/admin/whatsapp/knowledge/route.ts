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

  // Upsert: delete old, create new
  await prisma.$executeRaw`DELETE FROM "StatEvent" WHERE "eventType" = 'BOT_KNOWLEDGE'`;
  const id = `bot_${Date.now()}`;
  await prisma.$executeRaw`INSERT INTO "StatEvent" (id, "eventType", metadata, "createdAt") VALUES (${id}, 'BOT_KNOWLEDGE', ${JSON.stringify({ entries })}::jsonb, NOW())`.catch(() => {
    // Fallback if raw fails
    (prisma as any).statEvent.create({ data: { eventType: "BOT_KNOWLEDGE", metadata: { entries } } }).catch(() => {});
  });

  return NextResponse.json({ ok: true, count: entries.length });
}
