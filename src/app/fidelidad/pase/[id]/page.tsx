import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import {
  isGoogleWalletConfigured,
  upsertLoyaltyClass,
  upsertLoyaltyObject,
  generateSaveUrl,
  googleObjectId,
} from "@/lib/wallet/google";
import { isAppleWalletConfigured } from "@/lib/wallet/apple";
import GeoCheck from "./GeoCheck";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const member = await prisma.loyaltyMember.findUnique({ where: { id }, select: { restaurantId: true } });
  const restaurant = member
    ? await prisma.restaurant.findUnique({ where: { id: member.restaurantId }, select: { name: true, logoUrl: true } })
    : null;
  const name = restaurant?.name || "tu restaurante";
  const title = `Tarjeta de fidelidad · ${restaurant?.name || "Fidelidad"}`;
  return {
    title,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description: `Agrega tu tarjeta de fidelidad de ${name} a tu teléfono y junta sellos.`,
      siteName: restaurant?.name || "QuieroComer",
      ...(restaurant?.logoUrl && { images: [{ url: restaurant.logoUrl }] }),
    },
  };
}

export default async function PasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const { t } = await searchParams;

  const member = await prisma.loyaltyMember.findUnique({ where: { id }, include: { program: true } });
  const invalid = !member || !t || member.authToken !== t || member.revoked;

  const wrap = (children: React.ReactNode) => (
    <main style={{ minHeight: "100vh", background: "#0d0d0d", color: "#fff", display: "flex", justifyContent: "center", padding: "32px 18px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>{children}</div>
    </main>
  );

  if (invalid) {
    return wrap(
      <div style={{ textAlign: "center", marginTop: 40 }}>
        <p style={{ fontWeight: 700, fontSize: "1.1rem" }}>Enlace no válido</p>
        <p style={{ color: "rgba(255,255,255,0.6)", marginTop: 8 }}>Este enlace de tarjeta expiró o no es correcto.</p>
      </div>,
    );
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: member!.restaurantId },
    select: { name: true, logoUrl: true },
  });

  // Google: asegurar objeto y link
  let googleSaveUrl: string | null = null;
  if (isGoogleWalletConfigured()) {
    try {
      await upsertLoyaltyClass(member!.program, restaurant?.name || "Restaurante", restaurant?.logoUrl);
      await upsertLoyaltyObject(member!, member!.program, restaurant?.name || "Restaurante");
      const objectId = googleObjectId(member!.id);
      if (member!.googleObjectId !== objectId) {
        await prisma.loyaltyMember.update({ where: { id }, data: { googleObjectId: objectId } });
      }
      googleSaveUrl = generateSaveUrl(objectId);
    } catch {
      /* noop */
    }
  }
  const appleUrl = isAppleWalletConfigured() ? `/api/loyalty/pass/apple/${id}?t=${t}` : null;

  return wrap(
    <>
      {/* Geo check silencioso: si el miembro está cerca del local, envía push banner */}
      <GeoCheck memberId={id} authToken={t!} />

      <div style={{ textAlign: "center", marginBottom: 24 }}>
        {restaurant?.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={restaurant.logoUrl} alt="" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", margin: "0 auto 12px", display: "block", background: "rgba(255,255,255,0.1)" }} />
        )}
        <h1 style={{ fontSize: "1.35rem", fontWeight: 800, margin: 0 }}>{restaurant?.name}</h1>
        <p style={{ color: "rgba(255,255,255,0.6)", margin: "4px 0 0" }}>Tu tarjeta de fidelidad{member!.name ? `, ${member!.name}` : ""}</p>
      </div>

      <p style={{ textAlign: "center", color: "rgba(255,255,255,0.7)", marginBottom: 20, lineHeight: 1.5 }}>
        Agrega tu tarjeta a este teléfono:
      </p>

      {appleUrl && (
        <a href={appleUrl} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "15px", borderRadius: 12, background: "#000", border: "1px solid rgba(255,255,255,0.25)", color: "#fff", fontSize: "1rem", fontWeight: 700, textDecoration: "none", marginBottom: 12, boxSizing: "border-box" }}>
           Agregar a Apple Wallet
        </a>
      )}
      {googleSaveUrl && (
        <a href={googleSaveUrl} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "15px", borderRadius: 12, background: "#fff", color: "#111", fontSize: "1rem", fontWeight: 700, textDecoration: "none", boxSizing: "border-box" }}>
          Guardar en Google Wallet
        </a>
      )}

      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.72rem", textAlign: "center", marginTop: 18, lineHeight: 1.5 }}>
        En iPhone usa Apple Wallet; en Android, Google Wallet. Tus sellos se mantienen: es la misma tarjeta.
      </p>
    </>,
  );
}
