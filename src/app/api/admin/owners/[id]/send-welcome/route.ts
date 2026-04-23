import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";
import { sendAdminEmail, welcomeOwnerEmailHtml } from "@/lib/email/sendAdminEmail";
import bcrypt from "bcryptjs";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";

/** Superadmin sends a welcome email with auto-generated password */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const { id } = await params;

    const owner = await prisma.restaurantOwner.findUnique({
      where: { id },
      include: { restaurants: { select: { name: true, slug: true }, take: 1 } },
    });
    if (!owner) return NextResponse.json({ error: "Owner no encontrado" }, { status: 404 });

    // Generate random password
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let tempPassword = "";
    for (let i = 0; i < 10; i++) tempPassword += chars[Math.floor(Math.random() * chars.length)];

    // Hash and save, force password change on next login
    const hash = await bcrypt.hash(tempPassword, 10);
    await prisma.restaurantOwner.update({
      where: { id },
      data: { passwordHash: hash, mustChangePassword: true },
    });

    const firstName = owner.name.split(" ")[0];
    const restaurant = owner.restaurants[0];
    const qrLink = restaurant ? `${BASE_URL}/qr/${restaurant.slug}` : null;

    await sendAdminEmail({
      to: owner.email,
      subject: `${firstName}, tu carta digital está lista 🧞`,
      html: welcomeOwnerEmailHtml(firstName, owner.email, tempPassword, qrLink, `${BASE_URL}/panel`),
      purpose: "welcome",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Send welcome error:", error);
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
