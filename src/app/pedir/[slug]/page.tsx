import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRestaurantBySlug } from "@/lib/qr/queries/getRestaurant";
import { prisma } from "@/lib/prisma";
import OrderMenuPage from "@/components/order/OrderMenuPage";
import { OrderCartProvider } from "@/components/order/OrderCartContext";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug, "es");
  if (!restaurant) return {};
  return {
    title: `Pedir en ${restaurant.name} | QuieroComer`,
    description: `Arma tu pedido de ${restaurant.name} y envíalo directo por WhatsApp. Sin apps, sin comisiones.`,
    openGraph: {
      title: `🛍️ Pide en ${restaurant.name}`,
      description: `Elige tus platos y envía tu pedido por WhatsApp. Rápido, sin apps.`,
      images: restaurant.logoUrl
        ? [{ url: restaurant.logoUrl, width: 400, height: 400, alt: restaurant.name }]
        : [],
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `🛍️ Pide en ${restaurant.name}`,
      description: `Elige tus platos y envía tu pedido por WhatsApp. Rápido, sin apps.`,
      images: restaurant.logoUrl ? [restaurant.logoUrl] : [],
    },
  };
}

export default async function PedirPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const [restaurant, config] = await Promise.all([
    getRestaurantBySlug(slug, "es"),
    prisma.restaurant.findUnique({
      where: { slug },
      select: {
        id: true, slug: true, name: true, logoUrl: true, plan: true,
        orderingEnabled: true, orderingPhone: true, orderingDelivery: true,
        orderingMinAmount: true, orderingWaitTime: true, orderingNote: true, orderingPaymentMethods: true,
        orderingTheme: true, orderingAccentColor: true, orderingBannerUrl: true,
        whatsapp: true, address: true, phone: true,
      },
    }),
  ]);

  if (!restaurant || !config) return notFound();

  // Only PREMIUM can use ordering (excepción: el-menu-de-la-esquina con plan GOLD)
  const ORDERING_EXCEPTIONS = ["el-menu-de-la-esquina"];
  if (config.plan !== "PREMIUM" && !ORDERING_EXCEPTIONS.includes(slug)) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "var(--font-body, sans-serif)", background: "#fafafa" }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          {config.logoUrl && <img src={config.logoUrl} alt={config.name} style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", marginBottom: 16 }} />}
          <h1 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 8px" }}>{config.name}</h1>
          <p style={{ fontSize: "0.85rem", color: "#666", lineHeight: 1.6 }}>Los pedidos online no están disponibles en este restaurante por el momento.</p>
        </div>
      </div>
    );
  }

  // Ordering is disabled
  if (!config.orderingEnabled) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "var(--font-body, sans-serif)", background: "#fafafa" }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          {config.logoUrl && <img src={config.logoUrl} alt={config.name} style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", marginBottom: 16 }} />}
          <h1 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 8px" }}>{config.name}</h1>
          <p style={{ fontSize: "0.85rem", color: "#666", lineHeight: 1.6 }}>Los pedidos online no están disponibles en este momento. Visítanos o contáctanos directamente.</p>
        </div>
      </div>
    );
  }

  const orderingConfig = {
    phone: config.orderingPhone || config.whatsapp || config.phone || "",
    delivery: config.orderingDelivery as "PICKUP" | "DELIVERY" | "BOTH",
    minAmount: config.orderingMinAmount ?? null,
    waitTime: config.orderingWaitTime ?? null,
    note: config.orderingNote ?? null,
    address: config.address ?? null,
    paymentMethods: ((config as any).orderingPaymentMethods || "efectivo,transferencia,tarjeta").split(",").filter(Boolean) as string[],
    theme: (config as any).orderingTheme || "light",
    accentColor: (config as any).orderingAccentColor || null,
    orderingBannerUrl: (config as any).orderingBannerUrl || null,
  };

  return (
    <OrderCartProvider>
      <OrderMenuPage
        restaurant={restaurant as any}
        orderingConfig={orderingConfig}
      />
    </OrderCartProvider>
  );
}
