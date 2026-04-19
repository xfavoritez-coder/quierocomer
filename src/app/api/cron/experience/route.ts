import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Cron: process pending experience submissions.
 * Runs every 5 minutes. Generates personalized message with Claude and sends email.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!apiKey || !resendKey) return NextResponse.json({ error: "Missing keys" }, { status: 500 });

  try {
    // Find submissions ready to send
    const pending = await prisma.experienceSubmission.findMany({
      where: { status: "pending", sendAfter: { lte: new Date() } },
      include: {
        assignedResult: true,
        experience: { include: { template: true, restaurant: { select: { name: true, slug: true } } } },
      },
      take: 10,
    });

    let sent = 0;
    let failed = 0;

    for (const sub of pending) {
      try {
        await prisma.experienceSubmission.update({ where: { id: sub.id }, data: { status: "processing" } });

        const result = sub.assignedResult!;
        const template = sub.experience.template;
        const restaurant = sub.experience.restaurant;

        // Get guest preferences
        let prefs = "";
        if (sub.guestId) {
          const guest = await prisma.guestProfile.findUnique({ where: { id: sub.guestId }, select: { preferences: true } });
          const p = guest?.preferences as any;
          if (p) {
            if (p.dietType) prefs += `Dieta: ${p.dietType}. `;
            if (p.restrictions?.length) prefs += `Restricciones: ${p.restrictions.join(", ")}. `;
            if (p.dislikes?.length) prefs += `No le gusta: ${p.dislikes.join(", ")}. `;
          }
        }

        // Generate personalized message with Claude
        const prompt = `Eres un oráculo místico del tema "${template.theme}". Escribe un mensaje personalizado para esta persona.

Persona: ${sub.userName}
Fecha nacimiento: ${sub.birthDate.toLocaleDateString("es-CL")}
Gustos detectados: ${prefs || "No disponibles"}
Resultado asignado: ${result.name}
Descripción base: ${result.description}
Características: ${result.traits.join(", ")}
Restaurante: ${restaurant.name}

Escribe exactamente 4 párrafos:
1. Revelación mística de que es "${result.name}" — usa su nombre "${sub.userName}"
2. Por qué es ese resultado según sus datos
3. Qué características comparten
4. Consejo gastronómico: qué debería probar en ${restaurant.name}

Tono: místico, cálido, personal. Usa su nombre. NO uses markdown, solo texto plano con saltos de línea.`;

        const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
        });

        const claudeData = await claudeRes.json();
        const personalizedMsg = claudeData.content?.[0]?.text || result.description;

        // Build email
        const accentColor = template.accentColor || "#F4A623";
        const emailHtml = `<div style="font-family:'DM Sans',system-ui,sans-serif;max-width:520px;margin:0 auto;background:#0a0a0a;color:white;border-radius:20px;overflow:hidden">
  <div style="background:linear-gradient(135deg,${accentColor}20,${accentColor}08);padding:40px 28px;text-align:center;border-bottom:1px solid ${accentColor}30">
    <p style="font-size:3rem;margin:0 0 12px">${template.iconEmoji}</p>
    <h1 style="font-family:'Playfair Display',serif;font-size:2rem;font-weight:600;color:${accentColor};margin:0 0 4px">${result.name}</h1>
    <p style="font-size:0.85rem;color:rgba(255,255,255,0.5);margin:0">${template.name}</p>
  </div>
  <div style="padding:28px">
    <p style="font-size:0.78rem;color:${accentColor};text-transform:uppercase;letter-spacing:0.15em;margin:0 0 16px">Tu resultado, ${sub.userName}</p>
    ${personalizedMsg.split("\n\n").map((p: string) => `<p style="font-size:0.92rem;line-height:1.6;color:rgba(255,255,255,0.8);margin:0 0 16px">${p}</p>`).join("")}
    <div style="text-align:center;margin-top:28px">
      <a href="https://quierocomer.cl/qr/${restaurant.slug}" style="display:inline-block;background:${accentColor};color:#0a0a0a;text-decoration:none;padding:14px 28px;border-radius:50px;font-weight:700;font-size:0.92rem">Ver la carta de ${restaurant.name}</a>
    </div>
  </div>
  <div style="padding:16px 28px;border-top:1px solid rgba(255,255,255,0.05);text-align:center">
    <p style="font-size:0.7rem;color:rgba(255,255,255,0.25);margin:0">QuieroComer · Experiencia de ${restaurant.name}</p>
  </div>
</div>`;

        // Send email
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: process.env.FROM_EMAIL || "QuieroComer <noreply@quierocomer.cl>",
            to: sub.email,
            subject: `${sub.userName}, eres ${result.name} ${template.iconEmoji}`,
            html: emailHtml,
          }),
        });

        await prisma.experienceSubmission.update({
          where: { id: sub.id },
          data: { status: "sent", personalizedMsg, resultSentAt: new Date() },
        });

        sent++;
      } catch (e) {
        console.error(`Experience email error for ${sub.id}:`, e);
        await prisma.experienceSubmission.update({ where: { id: sub.id }, data: { status: "failed" } });
        failed++;
      }
    }

    return NextResponse.json({ ok: true, processed: pending.length, sent, failed });
  } catch (error) {
    console.error("Experience cron error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
