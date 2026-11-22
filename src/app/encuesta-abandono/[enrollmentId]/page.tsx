import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import AbandonmentSurveyForm from "@/components/ecommerce/AbandonmentSurveyForm";

export const metadata: Metadata = { title: "Tu opinión nos importa", robots: "noindex" };

export default async function AbandonmentSurveyPage({ params, searchParams }: { params: Promise<{ enrollmentId: string }>; searchParams: Promise<{ r?: string }> }) {
  const { enrollmentId } = await params;
  const { r: preselectedReason } = await searchParams;

  const enrollment = await prisma.recoveryEnrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true, automation: true, customerName: true, surveyReason: true, surveyAnsweredAt: true, openedAt: true, clickedAt: true, status: true,
      restaurant: { select: { name: true, logoUrl: true, ecommerceStoreConfig: true } },
    },
  });

  if (!enrollment || enrollment.automation !== "abandonment_survey") return notFound();

  const cfg = enrollment.restaurant.ecommerceStoreConfig as Record<string, unknown> | null;
  const accent = (typeof cfg?.primaryColor === "string" && /^#/.test(cfg.primaryColor)) ? cfg.primaryColor : "#e63946";

  // Si viene ?r=reason y aún no se respondió, guardar la respuesta inmediatamente
  // (el click en el email ya cuenta como respuesta principal)
  // Marcar como abierto/clickeado siempre que se visite la página
  try {
    const now = new Date();
    const updateData: Record<string, unknown> = {};
    if (!enrollment.surveyAnsweredAt && preselectedReason) {
      updateData.surveyReason = preselectedReason.slice(0, 50);
      updateData.surveyAnsweredAt = now;
    }
    if (!(enrollment as any).openedAt) updateData.openedAt = now;
    if (!(enrollment as any).clickedAt) updateData.clickedAt = now;
    if (enrollment.status === "sent" || enrollment.status === "delivered") updateData.status = "clicked";
    if (Object.keys(updateData).length > 0) {
      await prisma.recoveryEnrollment.update({ where: { id: enrollmentId }, data: updateData });
    }
  } catch { /* noop */ }

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <AbandonmentSurveyForm
        enrollmentId={enrollment.id}
        storeName={enrollment.restaurant.name}
        logoUrl={enrollment.restaurant.logoUrl}
        accent={accent}
        customerName={enrollment.customerName}
        alreadyAnswered={!!enrollment.surveyAnsweredAt}
        preselectedReason={preselectedReason || enrollment.surveyReason || undefined}
      />
    </div>
  );
}
