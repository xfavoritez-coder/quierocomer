import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { createPanelMagicToken } from "@/lib/magicLink";
import { addLeadEvent } from "@/lib/ventas/leads";
import { getDemoPlans } from "@/lib/ventas/plans";
import { cleanForm, findRegistration, promoteRegistration, sendRegistrationFollowups, validateForm } from "@/lib/ventas/registration";

export const runtime = "nodejs";

/** POST /api/alta/[token]/complete — el dueño confirma: el local demo pasa a real y se crea su cuenta. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!rateLimit(`alta-complete:${getClientIp(req)}`, { limit: 10, windowMs: 10 * 60_000 }).success) return NextResponse.json({ error: "Demasiados intentos, espera unos minutos" }, { status: 429 });
  const reg = await findRegistration(token);
  if (!reg) return NextResponse.json({ error: "Enlace no válido" }, { status: 404 });
  if (reg.completedAt) return NextResponse.json({ error: "Este registro ya está completo" }, { status: 409 });
  if (reg.expired) return NextResponse.json({ error: "El enlace venció. Pídele uno nuevo a tu vendedor." }, { status: 410 });

  const f = cleanForm(await req.json().catch(() => ({})));
  const invalid = validateForm(f);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
  const plan = (await getDemoPlans()).sections.flatMap((s) => s.plans).find((p) => p.id === f.planId);
  if (!plan) return NextResponse.json({ error: "Elige un plan" }, { status: 400 });

  let res;
  try { res = await promoteRegistration(reg.id, f); }
  catch (e) {
    console.error("[alta] promote", e);
    return NextResponse.json({ error: (e as Error).message.includes("ya está completo") ? "Este registro ya está completo" : "No pudimos completar el registro. Intenta de nuevo." }, { status: 500 });
  }

  const origin = req.nextUrl.origin;
  await sendRegistrationFollowups({
    origin, ownerId: res.ownerId, ownerEmail: f.email!, ownerName: f.ownerName!, localName: f.localName!, slug: res.slug,
    planName: plan.name, seller: reg.lead.seller ? { name: reg.lead.seller.name, email: reg.lead.seller.email } : null,
    leadId: reg.lead.id, currentSystem: [f.currentSystem, f.currentSystemLink].filter(Boolean).join(" · ") || undefined,
  }).catch((e) => console.error("[alta] followups", e));
  await addLeadEvent(reg.lead.id, "email_sent", "system", null, { payload: { kind: "welcome", to: f.email } });

  // Entrada directa al panel solo si la cuenta es nueva: si el correo ya tenía cuenta, entra desde su correo.
  const panelUrl = res.createdOwner ? `/api/panel/magic-entry?t=${encodeURIComponent(createPanelMagicToken(res.ownerId))}&r=${encodeURIComponent("/panel")}` : null;
  return NextResponse.json({ ok: true, slug: res.slug, panelUrl });
}
