import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("panel_token")?.value;
  const panelId = req.cookies.get("panel_id")?.value;
  if (!token || !panelId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { currentPassword, newPassword } = await req.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Campos requeridos" }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
    }
    if (!/\d/.test(newPassword)) {
      return NextResponse.json({ error: "La contraseña debe contener al menos 1 número" }, { status: 400 });
    }

    const owner = await prisma.restaurantOwner.findUnique({
      where: { id: panelId },
      select: { id: true, passwordHash: true },
    });
    if (!owner) return NextResponse.json({ error: "Owner no encontrado" }, { status: 404 });

    const valid = await bcrypt.compare(currentPassword, owner.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Contraseña actual incorrecta" }, { status: 401 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.restaurantOwner.update({
      where: { id: panelId },
      data: { passwordHash },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Panel change password error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
