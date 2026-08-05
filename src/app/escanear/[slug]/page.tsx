import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ScannerClient from "./ScannerClient";

export default async function EscanearPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { slug } = await params;
  const { t: token } = await searchParams;

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, logoUrl: true },
  });
  if (!restaurant) return notFound();

  const program = await prisma.loyaltyProgram.findUnique({
    where: { restaurantId: restaurant.id },
    select: {
      scanToken: true,
      scanEnabled: true,
      scanPinHash: true,
      stampGoal: true,
      rewards: true,
      name: true,
    },
  });

  // Token must exist and match
  if (!program?.scanToken || program.scanToken !== token) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f0f0f",
          padding: 24,
        }}
      >
        <div style={{ textAlign: "center", color: "#fff" }}>
          <p style={{ fontSize: "2rem", marginBottom: 12 }}>🔒</p>
          <p style={{ fontFamily: "sans-serif", fontSize: "1rem", color: "rgba(255,255,255,0.6)" }}>
            Link de acceso inválido.
          </p>
          <p style={{ fontFamily: "sans-serif", fontSize: "0.8rem", color: "rgba(255,255,255,0.35)", marginTop: 8 }}>
            Solicita un nuevo link al administrador.
          </p>
        </div>
      </div>
    );
  }

  if (!program.scanEnabled) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f0f0f",
          padding: 24,
        }}
      >
        <div style={{ textAlign: "center", color: "#fff" }}>
          <p style={{ fontSize: "2rem", marginBottom: 12 }}>⛔</p>
          <p style={{ fontFamily: "sans-serif", fontSize: "1rem", color: "rgba(255,255,255,0.6)" }}>
            El escáner está desactivado.
          </p>
          <p style={{ fontFamily: "sans-serif", fontSize: "0.8rem", color: "rgba(255,255,255,0.35)", marginTop: 8 }}>
            Contacta al administrador del local.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScannerClient
      slug={slug}
      token={token!}
      restaurant={{ name: restaurant.name, logoUrl: restaurant.logoUrl }}
      programName={program.name}
      stampGoal={program.stampGoal}
      rewards={Array.isArray(program.rewards) ? (program.rewards as { stamp: number; reward: string }[]) : []}
      hasPin={!!program.scanPinHash}
    />
  );
}
