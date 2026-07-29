import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { parseRewards } from "@/lib/loyalty";
import EnrollClient from "./EnrollClient";

export const metadata: Metadata = {
  title: "Únete al programa de fidelidad",
  robots: { index: false, follow: false },
};

export default async function FidelidadPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: { id: true, name: true, logoUrl: true },
  });

  const program = restaurant
    ? await prisma.loyaltyProgram.findUnique({ where: { restaurantId: restaurant.id } })
    : null;

  if (!restaurant || !program || !program.active) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111",
          color: "#fff",
          padding: 24,
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div>
          <p style={{ fontSize: "1.1rem", fontWeight: 600 }}>Programa no disponible</p>
          <p style={{ color: "rgba(255,255,255,0.6)", marginTop: 8 }}>
            Este restaurante aún no tiene un programa de fidelidad activo.
          </p>
        </div>
      </main>
    );
  }

  const rewards = parseRewards(program.rewards);

  return (
    <EnrollClient
      slug={slug}
      restaurantName={restaurant.name}
      restaurantLogo={restaurant.logoUrl}
      program={{
        name: program.name,
        cardColorHex: program.cardColorHex,
        stampIcon: program.stampIcon,
        stampGoal: program.stampGoal,
        description: program.description,
        rewards,
      }}
    />
  );
}
