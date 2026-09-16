import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import ResenaClient from "./ResenaClient";
import PageHitTracker from "@/components/PageHitTracker";
import OwnerPanelBar from "@/components/qr/carta/OwnerPanelBar";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const r = await prisma.restaurant.findUnique({ where: { slug }, select: { name: true, logoUrl: true } });
  if (!r) return {};
  return {
    title: `Deja tu opinión · ${r.name}`,
    robots: { index: false, follow: false },
  };
}

export default async function ResenaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: { id: true, name: true, logoUrl: true, reviewMode: true, reviewReward: true, cartaColorMode: true, isDemo: true },
  });

  if (!restaurant || restaurant.reviewMode !== "private") {
    return (
      <main style={{
        minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#111", color: "#fff", padding: 24, textAlign: "center",
        fontFamily: "system-ui, sans-serif",
      }}>
        <div>
          <p style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 8px" }}>Página no disponible</p>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem", margin: 0 }}>Este local no tiene reseñas activadas.</p>
          <a href={`/${slug}`} style={{ display: "inline-block", marginTop: 20, color: "#F4A623", fontSize: "0.85rem", textDecoration: "none" }}>← Volver al local</a>
        </div>
      </main>
    );
  }

  return (
    <>
      {restaurant.isDemo && <OwnerPanelBar slug={slug} />}
      <PageHitTracker restaurantId={restaurant.id} page="resena" />
      <ResenaClient restaurant={{ ...restaurant, slug }} colorMode={(restaurant.cartaColorMode as string) || "DARK"} />
    </>
  );
}
