import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import { sendWhatsApp } from "@/lib/whatsapp";

const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@quierocomer.com";

export async function POST(req: NextRequest) {
  try {
    const { nombre, localName, email, whatsapp } = await req.json();

    // Validate required fields
    if (!nombre || !localName || !email) {
      return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }

    // Save to DB
    await prisma.supportMessage.create({
      data: {
        source: "landing_registro",
        name: nombre,
        email,
        phone: whatsapp || null,
        message: `Local: ${localName}`,
      },
    });

    // Send notification email to team
    await resend.emails.send({
      from: FROM_EMAIL,
      to: "favoritez@gmail.com",
      subject: `Nuevo registro: ${nombre} — ${localName}`,
      html: `
        <h2 style="font-family:sans-serif;color:#111;">Nuevo registro en QuieroComer</h2>
        <table style="font-family:sans-serif;font-size:15px;color:#333;border-collapse:collapse;">
          <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Nombre:</td><td style="padding:6px 0;">${nombre}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Local:</td><td style="padding:6px 0;">${localName}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Email:</td><td style="padding:6px 0;">${email}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;font-weight:600;">WhatsApp:</td><td style="padding:6px 0;">${whatsapp || "—"}</td></tr>
        </table>
        <p style="font-family:sans-serif;font-size:13px;color:#888;margin-top:20px;">Origen: landing_registro</p>
      `,
    }).catch((err: unknown) => {
      console.error("[register] Error sending email:", err);
    });

    // Send WhatsApp welcome if provided
    if (whatsapp) {
      // Normalize phone: strip non-digits, add +56 prefix if not starting with 56
      const digits = whatsapp.replace(/\D/g, "");
      const normalized = digits.startsWith("56") ? `+${digits}` : `+56${digits}`;
      const firstName = nombre.split(" ")[0];

      await sendWhatsApp({
        to: normalized,
        body: `Hola ${firstName} 👋 Bienvenido a QuieroComer. El equipo te contactará pronto para ayudarte a configurar tu carta.`,
        contentSid: "HXb70a8b2bf8e01e4a4c4d3a70bf3c13a8",
        contentVariables: { "1": firstName },
      }).catch((err: unknown) => {
        console.error("[register] Error sending WhatsApp:", err);
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[register] Unexpected error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
