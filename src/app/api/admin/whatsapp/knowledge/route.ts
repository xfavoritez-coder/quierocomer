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
  const record = await (prisma as any).statEvent.findFirst({
    where: { eventType: "BOT_KNOWLEDGE" },
    orderBy: { createdAt: "desc" },
    select: { metadata: true },
  });
  return (record?.metadata as any)?.entries || [];
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
  await (prisma as any).statEvent.deleteMany({ where: { eventType: "BOT_KNOWLEDGE" } });
  await (prisma as any).statEvent.create({
    data: { eventType: "BOT_KNOWLEDGE", metadata: { entries } },
  });

  return NextResponse.json({ ok: true, count: entries.length });
}
