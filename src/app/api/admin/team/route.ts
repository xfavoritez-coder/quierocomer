import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// GET /api/admin/team?restaurantId=xxx — list owner + team members
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      id: true,
      weeklyEmailEnabled: true,
      owner: { select: { id: true, name: true, email: true, role: true, status: true, lastLoginAt: true, createdAt: true } },
      teamMembers: {
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, email: true, role: true, status: true, weeklyEmailEnabled: true, lastLoginAt: true, createdAt: true },
      },
    },
  });

  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    owner: restaurant.owner ? {
      ...restaurant.owner,
      weeklyEmailEnabled: restaurant.weeklyEmailEnabled,
      isOwner: true,
    } : null,
    members: restaurant.teamMembers,
  });
}

// POST /api/admin/team — invite new member
export async function POST(req: NextRequest) {
  const { restaurantId, name, email, role } = await req.json();
  if (!restaurantId || !name || !email) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const validRole = role === "ADMIN" || role === "VIEWER" ? role : "VIEWER";

  // Check if already exists
  const existing = await prisma.teamMember.findUnique({
    where: { restaurantId_email: { restaurantId, email } },
  });
  if (existing) return NextResponse.json({ error: "Este email ya está registrado en tu equipo" }, { status: 409 });

  // Check if it's the owner's email
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { name: true, owner: { select: { email: true } } },
  });
  if (restaurant?.owner?.email === email) {
    return NextResponse.json({ error: "Este email ya es el dueño del restaurante" }, { status: 409 });
  }

  const inviteToken = crypto.randomUUID();
  const member = await prisma.teamMember.create({
    data: {
      restaurantId,
      name,
      email,
      role: validRole,
      status: "PENDING",
      inviteToken,
      inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
    select: { id: true, name: true, email: true, role: true, status: true, weeklyEmailEnabled: true, createdAt: true },
  });

  // Send invite email
  try {
    const { sendAdminEmail, adminEmailTemplate } = await import("@/lib/email/sendAdminEmail");
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
    await sendAdminEmail({
      to: email,
      subject: `Te invitaron al equipo de ${restaurant?.name || "un restaurante"} · QuieroComer`,
      html: adminEmailTemplate(`
        <h2 style="color:#FFD600;font-size:20px;margin:0 0 16px">${name}, te invitaron a ${restaurant?.name || "un restaurante"}</h2>
        <p style="color:#c0a060;font-size:15px;line-height:1.6;margin:0 0 24px">
          Ahora puedes acceder al panel de <strong>${restaurant?.name}</strong> como <strong>${validRole === "ADMIN" ? "Administrador" : "Visor"}</strong>.
        </p>
        <div style="text-align:center">
          <a href="${baseUrl}/panel/invite?token=${inviteToken}" style="display:inline-block;background:#F4A623;color:#0D0D0D;font-size:15px;font-weight:bold;padding:12px 28px;border-radius:10px;text-decoration:none">
            Aceptar invitación
          </a>
        </div>
        <p style="color:#5a4028;font-size:12px;margin:24px 0 0">Esta invitación expira en 7 días.</p>
      `),
      purpose: "team_invite",
    });
  } catch (e) {
    console.error("[team] invite email error:", e);
  }

  return NextResponse.json(member);
}

// PUT /api/admin/team — update member role/status/weeklyEmail
export async function PUT(req: NextRequest) {
  const { memberId, role, status, weeklyEmailEnabled } = await req.json();
  if (!memberId) return NextResponse.json({ error: "Missing memberId" }, { status: 400 });

  const data: any = {};
  if (role === "ADMIN" || role === "VIEWER") data.role = role;
  if (status === "ACTIVE" || status === "SUSPENDED") data.status = status;
  if (typeof weeklyEmailEnabled === "boolean") data.weeklyEmailEnabled = weeklyEmailEnabled;

  const member = await prisma.teamMember.update({
    where: { id: memberId },
    data,
    select: { id: true, name: true, email: true, role: true, status: true, weeklyEmailEnabled: true, createdAt: true },
  });

  return NextResponse.json(member);
}

// DELETE /api/admin/team — remove member
export async function DELETE(req: NextRequest) {
  const { memberId } = await req.json();
  if (!memberId) return NextResponse.json({ error: "Missing memberId" }, { status: 400 });

  await prisma.teamMember.delete({ where: { id: memberId } });
  return NextResponse.json({ ok: true });
}
