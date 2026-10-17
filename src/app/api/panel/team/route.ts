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

// Resuelve el ownerId de la sesión actual (dueño directo o team member ADMIN).
async function resolveOwnerId(req: NextRequest): Promise<string | null> {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId || panelId === "demo") return null;
  if (panelId.startsWith("tm_")) {
    const m = await prisma.teamMember.findUnique({
      where: { id: panelId.slice(3) },
      select: { role: true, restaurant: { select: { ownerId: true } } },
    });
    if (!m || m.role !== "ADMIN") return null;
    return m.restaurant?.ownerId ?? null;
  }
  return panelId;
}

// POST /api/panel/team — invita a un usuario a 1 o más sucursales del dueño.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, role } = body;
  // Compatibilidad: acepta restaurantId (uno) o restaurantIds (varios).
  const ids: string[] = Array.isArray(body.restaurantIds) && body.restaurantIds.length
    ? body.restaurantIds
    : (body.restaurantId ? [body.restaurantId] : []);
  if (!ids.length || !name || !email) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }
  const emailNorm = String(email).trim().toLowerCase();
  const validRole = role === "ADMIN" || role === "VIEWER" ? role : "VIEWER";

  // Autorización: solo el dueño (o un admin de su equipo) puede invitar, y solo
  // a locales de ese mismo dueño.
  const ownerId = await resolveOwnerId(req);
  if (!ownerId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const targets = await prisma.restaurant.findMany({
    where: { id: { in: ids }, ownerId },
    select: { id: true, name: true, ecommerceStoreConfig: true, owner: { select: { email: true } } },
  });
  if (targets.length !== ids.length) {
    return NextResponse.json({ error: "Alguna sucursal no pertenece a tu cuenta" }, { status: 403 });
  }
  if (targets.some((t) => t.owner?.email?.toLowerCase() === emailNorm)) {
    return NextResponse.json({ error: "Este email es el del dueño de la cuenta" }, { status: 409 });
  }

  // Locales donde ya existe este usuario (se omiten).
  const existing = await prisma.teamMember.findMany({
    where: { email: { equals: emailNorm, mode: "insensitive" }, restaurantId: { in: ids } },
    select: { restaurantId: true },
  });
  const existingSet = new Set(existing.map((e) => e.restaurantId));
  const toCreate = targets.filter((t) => !existingSet.has(t.id));
  if (!toCreate.length) {
    return NextResponse.json({ error: "Este email ya está registrado en las sucursales seleccionadas" }, { status: 409 });
  }

  // Si ya tiene contraseña en otra sucursal (del mismo dueño), reusamos su hash
  // y lo dejamos ACTIVE directo (no se le reinvita).
  const siblingActive = await prisma.teamMember.findFirst({
    where: { email: { equals: emailNorm, mode: "insensitive" }, passwordHash: { not: null }, restaurant: { ownerId } },
    select: { passwordHash: true },
  });

  const branchLabel = (t: { name: string; ecommerceStoreConfig: unknown }) =>
    (t.ecommerceStoreConfig as { branchName?: string | null } | null)?.branchName || t.name;

  const firstToken = crypto.randomUUID();
  let createdCount = 0;
  for (let i = 0; i < toCreate.length; i++) {
    const t = toCreate[i];
    await prisma.teamMember.create({
      data: {
        restaurantId: t.id,
        name,
        email: emailNorm,
        role: validRole,
        status: siblingActive ? "ACTIVE" : "PENDING",
        passwordHash: siblingActive?.passwordHash ?? null,
        inviteToken: siblingActive ? null : (i === 0 ? firstToken : crypto.randomUUID()),
        inviteExpiresAt: siblingActive ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    createdCount++;
  }

  // Un solo email de invitación (salvo que ya tuviera contraseña).
  if (!siblingActive) {
    try {
      const { sendAdminEmail, adminEmailTemplate } = await import("@/lib/email/sendAdminEmail");
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";
      const brandName = toCreate[0].name;
      const branchNames = toCreate.map(branchLabel).join(", ");
      await sendAdminEmail({
        to: emailNorm,
        subject: `Te invitaron al equipo de ${brandName} · QuieroComer`,
        html: adminEmailTemplate(`
          <h2 style="color:#FFD600;font-size:20px;margin:0 0 16px">${name}, te invitaron a ${brandName}</h2>
          <p style="color:#c0a060;font-size:15px;line-height:1.6;margin:0 0 24px">
            Tendrás acceso como <strong>${validRole === "ADMIN" ? "Administrador" : "Visor"}</strong> a: <strong>${branchNames}</strong>.
          </p>
          <div style="text-align:center">
            <a href="${baseUrl}/panel/invite?token=${firstToken}" style="display:inline-block;background:#F4A623;color:#0D0D0D;font-size:15px;font-weight:bold;padding:12px 28px;border-radius:10px;text-decoration:none">
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
  }

  return NextResponse.json({ ok: true, created: createdCount, branches: toCreate.length, activated: !!siblingActive });
}

// PUT /api/panel/team — update member role/status/weeklyEmail or reset password
export async function PUT(req: NextRequest) {
  const { memberId, role, status, weeklyEmailEnabled, resetPassword, restaurantId, newPassword } = await req.json();
  if (!memberId) return NextResponse.json({ error: "Missing memberId" }, { status: 400 });

  // Direct password change by owner
  if (newPassword && typeof newPassword === "string" && newPassword.length >= 8) {
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.teamMember.update({ where: { id: memberId }, data: { passwordHash } });
    return NextResponse.json({ ok: true });
  }

  // Resend invite email for PENDING members
  if (req.nextUrl.searchParams.get("action") === "resend-invite") {
    const m = await prisma.teamMember.findUnique({
      where: { id: memberId },
      select: { name: true, email: true, status: true, inviteToken: true, restaurant: { select: { name: true } } },
    });
    if (!m) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    if (m.status !== "PENDING") return NextResponse.json({ error: "Solo se puede reenviar a usuarios pendientes" }, { status: 400 });

    // Regenerate token and extend expiry
    const inviteToken = m.inviteToken || crypto.randomUUID();
    await prisma.teamMember.update({
      where: { id: memberId },
      data: { inviteToken, inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });
    try {
      const { sendAdminEmail, adminEmailTemplate } = await import("@/lib/email/sendAdminEmail");
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";
      await sendAdminEmail({
        to: m.email,
        subject: `Te invitaron al equipo de ${m.restaurant.name} · QuieroComer`,
        html: adminEmailTemplate(`
          <h2 style="color:#FFD600;font-size:20px;margin:0 0 16px">${m.name}, te invitaron a ${m.restaurant.name}</h2>
          <p style="color:#c0a060;font-size:15px;line-height:1.6;margin:0 0 24px">
            Ahora puedes acceder al panel de <strong>${m.restaurant.name}</strong>.
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
    } catch (e) { console.error("[team] resend invite email error:", e); }
    return NextResponse.json({ ok: true });
  }

  // Reset password: generate new invite token and send email
  if (resetPassword) {
    const inviteToken = crypto.randomUUID();
    const m = await prisma.teamMember.update({
      where: { id: memberId },
      data: { inviteToken, inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), status: "PENDING", passwordHash: null },
      select: { name: true, email: true, restaurant: { select: { name: true } } },
    });
    try {
      const { sendAdminEmail, adminEmailTemplate } = await import("@/lib/email/sendAdminEmail");
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";
      await sendAdminEmail({
        to: m.email,
        subject: `Restablece tu contraseña · ${m.restaurant.name}`,
        html: adminEmailTemplate(`
          <h2 style="color:#FFD600;font-size:20px;margin:0 0 16px">${m.name}, restablece tu contraseña</h2>
          <p style="color:#c0a060;font-size:15px;line-height:1.6;margin:0 0 24px">
            El administrador de <strong>${m.restaurant.name}</strong> solicitó restablecer tu contraseña.
          </p>
          <div style="text-align:center">
            <a href="${baseUrl}/panel/invite?token=${inviteToken}" style="display:inline-block;background:#F4A623;color:#0D0D0D;font-size:15px;font-weight:bold;padding:12px 28px;border-radius:10px;text-decoration:none">
              Crear nueva contraseña
            </a>
          </div>
        `),
        purpose: "team_reset_password",
      });
    } catch (e) { console.error("[team] reset password email error:", e); }
    return NextResponse.json({ ok: true });
  }

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
