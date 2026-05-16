import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("panel_token")?.value;
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const owner = await prisma.owner.findFirst({ where: { sessionToken: token }, select: { id: true, name: true, email: true } });
  if (!owner) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { message } = await req.json();
  if (!message || typeof message !== "string" || message.trim().length < 5) {
    return NextResponse.json({ error: "Mensaje muy corto" }, { status: 400 });
  }

  try {
    await resend.emails.send({
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
    });
  } catch (e) {
    console.error("[support] email error:", e);
    return NextResponse.json({ error: "Error al enviar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
