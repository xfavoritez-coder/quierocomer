import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const body = await req.json();
    const { sessionId, userId, nombre } = body;
    if (!sessionId) return NextResponse.json({ error: "sessionId requerido" }, { status: 400 });

    const group = await prisma.groupSession.findUnique({
      where: { code: code.toUpperCase() },
      include: { members: true },
    });
    if (!group) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
    if (group.expiresAt < new Date()) return NextResponse.json({ error: "Sala expirada" }, { status: 410 });
    if (group.estado === "READY") return NextResponse.json({ error: "Sala ya cerrada" }, { status: 400 });

    // Check if already a member — update estado if provided
    const existing = group.members.find(m => m.sessionId === sessionId);
    if (existing) {
      if (body.estado && body.estado !== existing.estado) {
        await prisma.groupMember.update({ where: { id: existing.id }, data: { estado: body.estado } });
      }
      return NextResponse.json({ ...existing, estado: body.estado || existing.estado });
    }

    if (group.members.length >= group.totalMembers) {
      return NextResponse.json({ error: "Sala llena" }, { status: 400 });
    }

    const member = await prisma.groupMember.create({
      data: {
        groupId: group.id,
        sessionId,
        userId: userId || null,
        nombre: nombre || `Invitado ${group.members.length + 1}`,
        estado: "WAITING",
      },
    });

    // If all joined, update status to SELECTING
    if (group.members.length + 1 >= group.totalMembers) {
      await prisma.groupSession.update({ where: { id: group.id }, data: { estado: "SELECTING" } });
    }

    return NextResponse.json(member);
  } catch (e) {
    console.error("[Group join]", e);
    return NextResponse.json({ error: "Error al unirse" }, { status: 500 });
  }
}
