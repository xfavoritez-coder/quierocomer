import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";

const NOTIFY_TO = "favoritez@gmail.com";

const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY || "0x4AAAAAADSgtZR5ZeWri5oAHTapP1tHRpM";

export async function POST(request: Request) {
  try {
    const { email, nombre, telefono, mensaje, cfToken } = await request.json();

    // Verify Turnstile captcha
    if (!cfToken) {
      return NextResponse.json({ error: "Captcha requerido" }, { status: 400 });
    }
    const cfRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: TURNSTILE_SECRET, response: cfToken }),
    });
    const cfData = await cfRes.json();
    if (!cfData.success) {
      return NextResponse.json({ error: "Verificación fallida" }, { status: 403 });
    }

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }

    const lines = [
      mensaje ? `<p>Mensaje desde formulario de contacto.</p>` : `<p>Alguien pidió una demo desde la landing.</p>`,
      nombre ? `<p><strong>Nombre:</strong> ${nombre}</p>` : "",
      `<p><strong>Email:</strong> ${email}</p>`,
      telefono ? `<p><strong>Teléfono:</strong> ${telefono}</p>` : "",
      mensaje ? `<p><strong>Mensaje:</strong> ${mensaje}</p>` : "",
      `<p><strong>Fecha:</strong> ${new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" })}</p>`,
    ].filter(Boolean).join("");

    await Promise.all([
      resend.emails.send({
        from: process.env.FROM_EMAIL || "noreply@quierocomer.cl",
        to: NOTIFY_TO,
        subject: mensaje ? `Contacto QuieroComer — ${nombre || email}` : `Nueva solicitud de demo — ${nombre || email}`,
        html: lines,
      }),
      prisma.emailLog.create({
        data: {
          to: NOTIFY_TO,
          subject: mensaje ? `Contacto QuieroComer — ${nombre || email}` : `Nueva solicitud de demo — ${nombre || email}`,
          purpose: "landing_lead",
          status: "sent",
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Landing contact error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
