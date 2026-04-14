import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    const { email, password, tipo } = await req.json();

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    const { ok: allowed } = rateLimit(`login_${ip}_${email}`, 10, 900_000);
    if (!allowed) return NextResponse.json({ error: "Demasiados intentos. Espera 15 minutos." }, { status: 429 });

    if (tipo === "local") {
      const local = await prisma.local.findUnique({ where: { email } });
      if (!local) return NextResponse.json({ error: "Email o contraseña incorrectos" }, { status: 401 });
      const ok = await bcrypt.compare(password, local.password);
      if (!ok) return NextResponse.json({ error: "Email o contraseña incorrectos" }, { status: 401 });
      if (!local.activo) return NextResponse.json({ error: "Tu local está pendiente de aprobación. Te contactaremos pronto.", codigo: "LOCAL_PENDIENTE" }, { status: 401 });
      const { password: _, ...localSinPassword } = local;
      return NextResponse.json({ tipo: "local", data: localSinPassword });
    } else {
      const usuario = await prisma.usuario.findUnique({ where: { email } });
      if (!usuario) return NextResponse.json({ error: "Email o contraseña incorrectos" }, { status: 401 });
      const ok = await bcrypt.compare(password, usuario.password);
      if (!ok) return NextResponse.json({ error: "Email o contraseña incorrectos" }, { status: 401 });
      if (!usuario.emailVerificado) {
        return NextResponse.json({ error: "Debes verificar tu email antes de entrar. Revisa tu bandeja de entrada.", codigo: "EMAIL_NO_VERIFICADO" }, { status: 401 });
      }
      const { password: _, ...usuarioSinPassword } = usuario;
      return NextResponse.json({ tipo: "usuario", data: usuarioSinPassword });
    }
  } catch (error) {
    console.error("[API /auth/login] Error:", error);
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: "Error interno", detalle: msg }, { status: 500 });
  }
}
