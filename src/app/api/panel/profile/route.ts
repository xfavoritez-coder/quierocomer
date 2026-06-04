import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { normalizePhone } from "@/lib/normalizePhone";

function getAuth(req: NextRequest) {
  const token = req.cookies.get("panel_token")?.value;
  const panelId = req.cookies.get("panel_id")?.value;
  if (!token || !panelId) return null;
  return panelId;
}

export async function GET(req: NextRequest) {
  const panelId = getAuth(req);
  if (!panelId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const owner = await prisma.restaurantOwner.findUnique({
      where: { id: panelId },
      select: { name: true, email: true, whatsapp: true },
    });
    if (!owner) return NextResponse.json({ error: "Owner no encontrado" }, { status: 404 });

    return NextResponse.json({ name: owner.name, email: owner.email, whatsapp: owner.whatsapp });
  } catch (error) {
    console.error("Panel profile GET error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const panelId = getAuth(req);
  if (!panelId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { name, email, whatsapp, currentPassword, newPassword } = await req.json();

    const owner = await prisma.restaurantOwner.findUnique({
      where: { id: panelId },
      select: { id: true, passwordHash: true },
    });
    if (!owner) return NextResponse.json({ error: "Owner no encontrado" }, { status: 404 });

    const data: any = {};

    // Update name if provided
    if (name !== undefined && name.trim()) {
      data.name = name.trim();
    }

    // Update email if provided
    if (email !== undefined && email.trim()) {
      const newEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        return NextResponse.json({ error: "El email no es válido" }, { status: 400 });
      }
      // Check uniqueness
      const existing = await prisma.restaurantOwner.findUnique({ where: { email: newEmail } });
      if (existing && existing.id !== panelId) {
        return NextResponse.json({ error: "Ese email ya está registrado en otra cuenta" }, { status: 409 });
      }
      data.email = newEmail;
    }

    // Update whatsapp if provided
    if (whatsapp !== undefined) {
      if (whatsapp) {
        const normalized = normalizePhone(whatsapp);
        if (!normalized) {
          return NextResponse.json({ error: "El número de WhatsApp no es válido" }, { status: 400 });
        }
        data.whatsapp = normalized;
      } else {
        data.whatsapp = null;
      }
    }

    // Handle password change if provided
    if (newPassword) {
      if (newPassword.length < 8) {
        return NextResponse.json({ error: "La nueva contraseña debe tener al menos 8 caracteres" }, { status: 400 });
      }
      if (!/\d/.test(newPassword)) {
        return NextResponse.json({ error: "La nueva contraseña debe contener al menos 1 número" }, { status: 400 });
      }
      data.passwordHash = await bcrypt.hash(newPassword, 10);
      data.mustChangePassword = false;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No hay datos para actualizar" }, { status: 400 });
    }

    await prisma.restaurantOwner.update({ where: { id: panelId }, data });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Panel profile PUT error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
