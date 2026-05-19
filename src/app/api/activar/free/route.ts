import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail, freeActivatedEmailHtml, adminNewActivationEmailHtml } from "@/lib/email/sendAdminEmail";

/**
 * POST /api/activar/free
 * Body: { restaurantId }
 *
 * Activa un restaurant demo en plan gratis. Sin pago, sin traducción.
 */
export async function POST(req: NextRequest) {
  let body: { restaurantId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const { restaurantId } = body;
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, isDemo: true, slug: true, name: true, owner: { select: { email: true, name: true } } },
  });

  if (!restaurant || !restaurant.isDemo) {
    return NextResponse.json({ error: "No encontrado o ya activado" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        isDemo: false,
        plan: "FREE",
        weeklyEmailEnabled: true,
      },
    }),
    // Limpiar fotos Unsplash referenciales
    prisma.dish.updateMany({
      where: { restaurantId, isPhotoReferential: true },
      data: { photos: [], isPhotoReferential: false, photoCredits: [] },
    }),
    // Borrar sessions demo (cascade borra DishImpressions)
    prisma.session.deleteMany({ where: { restaurantId } }),
  ]);

  // Fire-and-forget: emails de notificación
  const ownerEmail = restaurant.owner?.email;
  const ownerName = restaurant.owner?.name || ownerEmail?.split("@")[0] || "Hola";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
  const panelLink = `${baseUrl}/api/panel/demo-auth?slug=${restaurant.slug}`;
  const qrLink = `${baseUrl}/qr/${restaurant.slug}`;

  if (ownerEmail) {
    sendAdminEmail({
      to: ownerEmail,
      subject: `${restaurant.name} · Tu carta está activa`,
      html: freeActivatedEmailHtml(ownerName, restaurant.name, panelLink, qrLink),
      purpose: "free_activated",
    }).catch((err) => console.error("[activar/free] Email al dueño falló:", err));
  }

  sendAdminEmail({
    to: "favoritez@gmail.com",
    subject: `Nuevo cliente: ${restaurant.name} activó Gratis`,
    html: adminNewActivationEmailHtml(restaurant.name, "Gratis", "$0", ownerEmail || "sin email", restaurant.slug || ""),
    purpose: "admin_new_activation",
  }).catch((err) => console.error("[activar/free] Email admin falló:", err));

  return NextResponse.json({ ok: true, plan: "FREE" });
}
