import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PASSWORD = "joan";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = req.headers.get("x-leads-auth");
  if (auth !== PASSWORD) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { crmStatus, crmFollowUpAt, note } = body;

  const current = await prisma.lead.findUnique({ where: { id }, select: { crmNotes: true } });
  if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const existingNotes = Array.isArray(current.crmNotes) ? current.crmNotes : [];
  const updatedNotes = note
    ? [...existingNotes, { text: note, ts: new Date().toISOString() }]
    : existingNotes;

  const updated = await prisma.lead.update({
    where: { id },
    data: {
      ...(crmStatus !== undefined && { crmStatus }),
      ...(crmFollowUpAt !== undefined && { crmFollowUpAt: crmFollowUpAt ? new Date(crmFollowUpAt) : null }),
      ...(note && { crmNotes: updatedNotes }),
    },
    select: {
      id: true,
      crmStatus: true,
      crmNotes: true,
      crmFollowUpAt: true,
    },
  });

  return NextResponse.json(updated);
}
