import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { cleanForm, findRegistration } from "@/lib/ventas/registration";

export const runtime = "nodejs";

/** PATCH /api/alta/[token] — autoguardado del formulario de registro del dueño. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!rateLimit(`alta-save:${token.slice(0, 16)}`, { limit: 120, windowMs: 60_000 }).success) return NextResponse.json({ error: "Demasiados intentos" }, { status: 429 });
  const reg = await findRegistration(token);
  if (!reg) return NextResponse.json({ error: "Enlace no válido" }, { status: 404 });
  if (reg.completedAt) return NextResponse.json({ error: "Este registro ya está completo" }, { status: 409 });
  if (reg.expired) return NextResponse.json({ error: "El enlace venció" }, { status: 410 });
  const prev = (reg.formData && typeof reg.formData === "object" ? reg.formData : {}) as Record<string, unknown>;
  const next = cleanForm({ ...prev, ...(await req.json().catch(() => ({}))) });
  await prisma.leadRegistration.update({ where: { id: reg.id }, data: { formData: next as object } });
  return NextResponse.json({ ok: true });
}
