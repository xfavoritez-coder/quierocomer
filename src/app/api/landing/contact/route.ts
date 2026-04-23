import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";

const NOTIFY_TO = "favoritez@gmail.com";

export async function POST(request: Request) {
  try {
    const { email, nombre, telefono } = await request.json();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }

    const lines = [
      `<p>Alguien pidió una demo desde la landing.</p>`,
      nombre ? `<p><strong>Nombre:</strong> ${nombre}</p>` : "",
      `<p><strong>Email:</strong> ${email}</p>`,
      telefono ? `<p><strong>Teléfono:</strong> ${telefono}</p>` : "",
      `<p><strong>Fecha:</strong> ${new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" })}</p>`,
    ].filter(Boolean).join("");

    await Promise.all([
      resend.emails.send({
        from: process.env.FROM_EMAIL || "noreply@quierocomer.cl",
        to: NOTIFY_TO,
        subject: `Nueva solicitud de demo — ${nombre || email}`,
        html: lines,
      }),
      prisma.emailLog.create({
        data: {
          to: NOTIFY_TO,
          subject: `Nueva solicitud de demo — ${nombre || email}`,
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
