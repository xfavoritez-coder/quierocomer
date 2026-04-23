import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { nombre, telefono, email } = await request.json();

    if (!nombre || !telefono || !email) {
      return NextResponse.json({ error: "Todos los campos son obligatorios" }, { status: 400 });
    }

    await prisma.referrer.upsert({
      where: { email },
      update: { name: nombre, phone: telefono },
      create: { name: nombre, phone: telefono, email },
    });

    // Notify
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: process.env.FROM_EMAIL || "QuieroComer <hola@quierocomer.cl>",
          to: "hola@quierocomer.cl",
          subject: `Nuevo vendedor registrado: ${nombre}`,
          html: `<h2>Nuevo vendedor</h2><p><strong>Nombre:</strong> ${nombre}</p><p><strong>Teléfono:</strong> ${telefono}</p><p><strong>Email:</strong> ${email}</p>`,
        }),
        signal: AbortSignal.timeout(10000),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Referrer register error:", error);
    return NextResponse.json({ error: "Error al registrar" }, { status: 500 });
  }
}
