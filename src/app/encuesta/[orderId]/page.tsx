import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";
import SurveyForm from "@/components/ecommerce/SurveyForm";

export const dynamic = "force-dynamic";

const REST_SELECT = { id: true, name: true, logoUrl: true, cartaAccentColor: true, ecommerceStoreConfig: true } as const;

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Tu opinión nos importa", robots: { index: false } };
}

export default async function EncuestaPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const preview = orderId.startsWith("preview_");

  let restaurant: { id: string; name: string; logoUrl: string | null; cartaAccentColor: string | null; ecommerceStoreConfig: unknown } | null = null;
  let customerName: string | null = null;
  let realOrderId: string | null = null;
  let alreadyAnswered = false;

  if (preview) {
    restaurant = await prisma.restaurant.findUnique({ where: { id: orderId.slice("preview_".length) }, select: REST_SELECT });
  } else {
    const order = await prisma.onlineOrder.findUnique({
      where: { id: orderId },
      select: { id: true, customerName: true, restaurant: { select: REST_SELECT } },
    });
    if (!order) return notFound();
    restaurant = order.restaurant;
    customerName = order.customerName;
    realOrderId = order.id;
    const existing = await prisma.ecommerceSurveyResponse.findUnique({ where: { orderId }, select: { id: true } });
    alreadyAnswered = !!existing;
  }
  if (!restaurant) return notFound();

  const cfg = parseStoreConfig(restaurant.ecommerceStoreConfig, { accent: restaurant.cartaAccentColor });
  const questions = cfg.survey.questions.filter((q) => q.active).map((q) => ({ id: q.id, text: q.text }));

  return (
    <SurveyForm
      orderId={realOrderId}
      preview={preview}
      storeName={restaurant.name}
      logoUrl={restaurant.logoUrl}
      accent={cfg.primaryColor}
      questions={questions}
      intro={cfg.survey.intro}
      thankYou={cfg.survey.thankYou}
      customerName={customerName}
      alreadyAnswered={alreadyAnswered}
    />
  );
}
