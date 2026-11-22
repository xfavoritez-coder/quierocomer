import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import AbandonmentSurveyForm from "@/components/ecommerce/AbandonmentSurveyForm";

export const metadata: Metadata = { title: "Tu opinión nos importa", robots: "noindex" };

export default async function AbandonmentSurveyPage({ params }: { params: Promise<{ enrollmentId: string }> }) {
  const { enrollmentId } = await params;

  const enrollment = await prisma.recoveryEnrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true, automation: true, customerName: true, surveyAnsweredAt: true,
      restaurant: { select: { name: true, logoUrl: true, ecommerceStoreConfig: true } },
    },
  });

  if (!enrollment || enrollment.automation !== "abandonment_survey") return notFound();

  const cfg = enrollment.restaurant.ecommerceStoreConfig as Record<string, unknown> | null;
  const accent = (typeof cfg?.primaryColor === "string" && /^#/.test(cfg.primaryColor)) ? cfg.primaryColor : "#e63946";

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <AbandonmentSurveyForm
        enrollmentId={enrollment.id}
        storeName={enrollment.restaurant.name}
        logoUrl={enrollment.restaurant.logoUrl}
        accent={accent}
        customerName={enrollment.customerName}
        alreadyAnswered={!!enrollment.surveyAnsweredAt}
      />
    </div>
  );
}
