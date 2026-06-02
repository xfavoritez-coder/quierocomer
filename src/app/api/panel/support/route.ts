import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("panel_token")?.value;
  const panelId = cookieStore.get("panel_id")?.value;
  if (!token || !panelId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const owner = await prisma.restaurantOwner.findUnique({
    where: { id: panelId },
    select: { id: true, name: true, email: true, whatsapp: true, restaurants: { select: { slug: true }, take: 1 } },
  });
  if (!owner) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { message } = await req.json();
  if (!message || typeof message !== "string" || message.trim().length < 5) {
    return NextResponse.json({ error: "Mensaje muy corto" }, { status: 400 });
  }

  try {
    await Promise.all([
      resend.emails.send({
        from: "QuieroComer Soporte <soporte@quierocomer.cl>",
        to: "hola@quierocomer.cl",
        replyTo: owner.email,
        subject: `[Soporte Panel] ${owner.name || owner.email}`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:600px">
            <p><strong>De:</strong> ${owner.name || "Sin nombre"} (${owner.email})</p>
            <p><strong>Owner ID:</strong> ${owner.id}</p>
            <hr style="border:none;border-top:1px solid #eee;margin:16px 0" />
            <p style="white-space:pre-wrap;line-height:1.6">${message.trim()}</p>
          </div>
        `,
      }),
      prisma.supportMessage.create({
        data: {
          source: "panel_soporte",
          name: owner.name || null,
          email: owner.email,
          message: message.trim(),
          ownerId: owner.id,
          restaurantSlug: owner.restaurants[0]?.slug || null,
        },
      }),
    ]);
  } catch (e) {
    console.error("[support] email error:", e);
    return NextResponse.json({ error: "Error al enviar" }, { status: 500 });
  }

  // Fire-and-forget: send WhatsApp follow-up if owner has WhatsApp
  if (owner.whatsapp) {
    import("@/lib/whatsapp").then(({ sendWhatsApp }) => {
      const ownerName = (owner.name || "").split(" ")[0] || "Hola";
      sendWhatsApp({
        to: owner.whatsapp!,
        body: `Hola ${ownerName}, te habla Camila de QuieroComer. Recibimos tu mensaje sobre nuestro servicio de carta QR inteligente. ¿En qué te puedo ayudar?`,
        contentSid: "HXb70a8b2bf8e01e4a4c4d3a70bf3c13a8",
        contentVariables: { "1": ownerName },
      }).then(sid => { if (sid) console.log(`[Support] WA sent to ${owner.whatsapp}: ${sid}`); })
        .catch(() => {});
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
