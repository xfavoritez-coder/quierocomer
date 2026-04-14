import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";

import * as crypto from "crypto";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { email, action, codigo, passNueva } = await req.json();
    if (!email) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });

    if (action === "enviar") {
      const usuario = await prisma.usuario.findUnique({ where: { email: email.toLowerCase() }, select: { id: true, nombre: true, email: true } });
      if (!usuario) return NextResponse.json({ error: "No encontramos una cuenta con ese email" }, { status: 404 });

      const code = crypto.randomInt(100000, 999999).toString();
      const expira = new Date(Date.now() + 600000); // 10 min

      await prisma.usuario.update({ where: { id: usuario.id }, data: { resetToken: code, resetTokenExpira: expira } });

      const nombre = usuario.nombre.split(" ")[0];
      await resend.emails.send({
        from: process.env.FROM_EMAIL ? `QuieroComer <${process.env.FROM_EMAIL}>` : "QuieroComer <onboarding@resend.dev>",
        to: usuario.email,
        subject: "Código de verificación · QuieroComer",
        html: `<html><body style="background-color:#0D0D0D;font-family:Georgia,serif;margin:0;padding:0">
<div style="max-width:560px;margin:0 auto;padding:40px 24px">
<div style="text-align:center;margin-bottom:32px"><p style="font-size:28px;margin:0 0 8px">🧞</p><h1 style="color:#FFD600;font-size:20px;letter-spacing:0.3em;text-transform:uppercase;margin:0">QuieroComer</h1></div>
<div style="background-color:#2d1a08;border-radius:20px;border:1px solid rgba(232,168,76,0.25);padding:40px 32px">
<h2 style="color:#FFD600;font-size:22px;margin-top:0;margin-bottom:16px">Código de verificación</h2>
<p style="color:#c0a060;font-size:16px;line-height:1.7;margin-bottom:24px">Hola ${nombre}, tu código para cambiar la contraseña es:</p>
<div style="text-align:center;margin-bottom:24px"><span style="background-color:rgba(232,168,76,0.15);color:#FFD600;font-size:32px;font-weight:bold;letter-spacing:0.3em;padding:16px 32px;border-radius:12px;display:inline-block">${code}</span></div>
<p style="color:#5a4028;font-size:13px;line-height:1.6;margin-bottom:0">Este código expira en 10 minutos. Si no solicitaste este cambio, ignora este email.</p>
</div>
<div style="text-align:center;margin-top:32px"><p style="color:#5a4028;font-size:12px">Hecho con 💛 y mucha hambre · QuieroComer.com</p></div>
</div></body></html>`,
      });

      const parts = usuario.email.split("@");
      const masked = parts[0].slice(0, 2) + "***@" + parts[1];
      return NextResponse.json({ ok: true, emailMasked: masked });
    }

    if (action === "verificar") {
      if (!codigo || !passNueva) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
      if (passNueva.length < 8) return NextResponse.json({ error: "Mínimo 8 caracteres" }, { status: 400 });

      const usuario = await prisma.usuario.findUnique({ where: { email: email.toLowerCase() }, select: { id: true, resetToken: true, resetTokenExpira: true } });
      if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
      if (!usuario.resetToken || !usuario.resetTokenExpira || usuario.resetToken !== codigo) {
        return NextResponse.json({ error: "Código incorrecto" }, { status: 401 });
      }
      if (new Date() > usuario.resetTokenExpira) {
        return NextResponse.json({ error: "El código ha expirado" }, { status: 401 });
      }

      const hash = await bcrypt.hash(passNueva, 10);
      await prisma.usuario.update({ where: { id: usuario.id }, data: { password: hash, resetToken: null, resetTokenExpira: null } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (error) {
    console.error("[Recuperar password usuario]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
