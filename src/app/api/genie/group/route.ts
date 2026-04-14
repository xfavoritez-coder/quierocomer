import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateGroupCode } from "@/lib/genie-group";

export async function POST(req: NextRequest) {
  try {
    const { groupType, totalMembers, userId, sessionId, nombre } = await req.json();

    if (!totalMembers || !sessionId) {
      return NextResponse.json({ error: "Campos requeridos" }, { status: 400 });
    }

    // Generate unique code
    let code = generateGroupCode();
    let attempts = 0;
    while (await prisma.groupSession.findUnique({ where: { code } })) {
      code = generateGroupCode();
      if (++attempts > 10) return NextResponse.json({ error: "Error generando código" }, { status: 500 });
    }

    const group = await prisma.groupSession.create({
      data: {
        code,
        groupType: groupType || "AMIGOS",
        totalMembers: Math.min(Math.max(2, totalMembers), 8),
        creatorId: userId || null,
        creatorSession: sessionId,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        members: {
          create: {
            userId: userId || null,
            sessionId,
            nombre: nombre || "Tú",
            estado: "WAITING",
          },
        },
      },
      include: { members: true },
    });

    return NextResponse.json(group);
  } catch (e) {
    console.error("[Group create]", e);
    return NextResponse.json({ error: "Error al crear sala" }, { status: 500 });
  }
}
