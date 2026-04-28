import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendAdminEmail, welcomeOwnerEmailHtml } from "@/lib/email/sendAdminEmail";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";

/** Create owner for a freshly-added restaurant (from /agregarlocal) */
export async function POST(request: Request) {
  try {
    const { restaurantId, name, email, whatsapp, sendWelcome } = await request.json();

    if (!restaurantId || !name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: "Nombre y correo requeridos" }, { status: 400 });
    }

    // Get restaurant for slug and friendly password
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, name: true, slug: true },
    });
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
    }

    // Generate friendly password: restaurant name (lowercase, no spaces) + current year
    const cleanName = restaurant.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    const year = new Date().getFullYear();
    const password = `${cleanName}${year}`;

    const passwordHash = await bcrypt.hash(password, 10);

    // Check if owner already exists with this email
    const existing = await prisma.restaurantOwner.findUnique({ where: { email: email.trim().toLowerCase() } });

    let owner;
    if (existing) {
      // Link restaurant to existing owner
      owner = await prisma.restaurantOwner.update({
        where: { id: existing.id },
        data: {
          restaurants: { connect: { id: restaurantId } },
          whatsapp: whatsapp?.trim() || existing.whatsapp,
        },
        include: { restaurants: { select: { id: true, name: true } } },
      });
    } else {
      owner = await prisma.restaurantOwner.create({
        data: {
          email: email.trim().toLowerCase(),
          passwordHash,
          name: name.trim(),
          whatsapp: whatsapp?.trim() || null,
          status: "ACTIVE",
          mustChangePassword: true,
          restaurants: { connect: { id: restaurantId } },
        },
        include: { restaurants: { select: { id: true, name: true } } },
      });
    }

    // Send welcome email if requested
    if (sendWelcome) {
      const firstName = name.trim().split(" ")[0];
      const qrLink = `${BASE_URL}/qr/${restaurant.slug}`;

      await sendAdminEmail({
        to: email.trim().toLowerCase(),
        subject: `${firstName}, tu carta digital está lista`,
        html: welcomeOwnerEmailHtml(firstName, email.trim().toLowerCase(), password, qrLink, `${BASE_URL}/panel`),
        purpose: "welcome",
      });
    }

    return NextResponse.json({ ok: true, ownerId: owner.id, passwordGenerated: password });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });
    }
    console.error("Create owner error:", error);
    return NextResponse.json({ error: "Error al crear dueño" }, { status: 500 });
  }
}
