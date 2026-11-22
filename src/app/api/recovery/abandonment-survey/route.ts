import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** POST /api/recovery/abandonment-survey
 *  Registra la respuesta de la encuesta de abandono.
 *  Body: { enrollmentId, reason, detail?, comment? } */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { enrollmentId, reason, detail, comment } = body as {
      enrollmentId?: string; reason?: string; detail?: string; comment?: string;
    };

    if (!enrollmentId || !reason) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    // Verificar que el enrollment existe y es de tipo abandonment_survey
    const enrollment = await prisma.recoveryEnrollment.findUnique({
      where: { id: enrollmentId },
      select: { id: true, automation: true, surveyAnsweredAt: true },
    });

    if (!enrollment || enrollment.automation !== "abandonment_survey") {
      return NextResponse.json({ error: "Encuesta no encontrada" }, { status: 404 });
    }

    // Si ya respondió, no sobrescribir (idempotente)
    if (enrollment.surveyAnsweredAt) {
      return NextResponse.json({ ok: true, alreadyAnswered: true });
    }

    await prisma.recoveryEnrollment.update({
      where: { id: enrollmentId },
      data: {
        surveyReason: reason.slice(0, 50),
        surveyDetail: detail?.slice(0, 100) || null,
        surveyComment: comment?.slice(0, 500) || null,
        surveyAnsweredAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[abandonment-survey] error:", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
