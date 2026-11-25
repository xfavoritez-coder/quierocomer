import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { findRegistration, type RegistrationForm } from "@/lib/ventas/registration";
import { addLeadEvent } from "@/lib/ventas/leads";
import { getDemoPlans } from "@/lib/ventas/plans";
import { recommendPlanId, withRecommendation } from "@/components/ventas/demo/recommend";
import AltaForm, { AltaMessage } from "./AltaForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Completa tu registro · QuieroComer", robots: { index: false, follow: false } };

const HEX = /^#[0-9a-fA-F]{6}$/;

export default async function AltaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const reg = await findRegistration(token);
  if (!reg) return <AltaMessage title="Enlace no válido" text="Revisa que el enlace esté completo o pídele uno nuevo a tu vendedor." />;
  if (reg.completedAt) return <AltaMessage title="Registro completo" text="Este local ya está registrado. Revisa tu correo para entrar a tu panel." ok />;
  if (reg.expired) return <AltaMessage title="El enlace venció" text="Por seguridad, el enlace dura 14 días. Pídele uno nuevo a tu vendedor." />;

  const lead = reg.lead;
  const [r, { sections }] = await Promise.all([
    lead.generatedSlug ? prisma.restaurant.findUnique({ where: { slug: lead.generatedSlug }, select: { id: true, slug: true, isDemo: true, logoUrl: true, cartaAccentColor: true, address: true, phone: true } }) : null,
    getDemoPlans(),
  ]);
  const demo = r?.isDemo ? r : null;
  const dishCount = demo ? await prisma.dish.count({ where: { restaurantId: demo.id, deletedAt: null, isActive: true } }) : 0;

  // Primera apertura del enlace → evento para el CRM.
  const opened = await prisma.leadEvent.findFirst({ where: { leadId: lead.id, type: "link_opened", createdAt: { gte: reg.createdAt } }, select: { id: true } });
  if (!opened) await addLeadEvent(lead.id, "link_opened", "owner", null, { payload: { kind: "registration" } });

  const planId = lead.recommendedPlan && sections.some((s) => s.plans.some((p) => p.id === lead.recommendedPlan)) ? lead.recommendedPlan : recommendPlanId(sections, lead.interestModules);
  const saved = (reg.formData && typeof reg.formData === "object" ? reg.formData : {}) as RegistrationForm;
  const initial: RegistrationForm = {
    localName: lead.localName, address: demo?.address ?? "", commune: lead.commune ?? "", localPhone: demo?.phone ?? "",
    ownerName: lead.ownerName && lead.ownerName !== lead.localName ? lead.ownerName : "", ownerPhone: lead.whatsapp ?? "", email: lead.email || reg.sentTo || "",
    rut: "", businessName: "", currentSystem: lead.detectedProvider?.name ?? "", currentSystemLink: "", cartaNote: "", planId: planId ?? "", acceptTerms: false, step: 0,
    ...Object.fromEntries(Object.entries(saved).filter(([, v]) => v !== undefined && v !== null)),
  };

  return (
    <AltaForm
      token={token}
      initial={initial}
      color={demo?.cartaAccentColor && HEX.test(demo.cartaAccentColor) ? demo.cartaAccentColor : "#DE7C00"}
      logoUrl={demo?.logoUrl ?? null}
      cartaUrl={demo ? `/qr/${demo.slug}` : null}
      dishCount={dishCount}
      sellerName={lead.seller?.name ?? null}
      sections={withRecommendation(sections, planId)}
      expiresAt={reg.expiresAt.toISOString()}
    />
  );
}
