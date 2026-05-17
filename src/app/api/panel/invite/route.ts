import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// GET /api/panel/invite?token=xxx — validate token and return member info
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const member = await prisma.teamMember.findUnique({
    where: { inviteToken: token },
    select: { id: true, name: true, email: true, status: true, inviteExpiresAt: true, restaurant: { select: { name: true } } },
  });

  if (!member) return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  if (member.status !== "PENDING") return NextResponse.json({ error: "Already activated" }, { status: 409 });
  if (member.inviteExpiresAt && member.inviteExpiresAt < new Date()) return NextResponse.json({ error: "Token expired" }, { status: 410 });

  return NextResponse.json({ name: member.name, email: member.email, restaurantName: member.restaurant.name });
}

// POST /api/panel/invite — accept invitation and set password
export async function POST(req: NextRequest) {
  const { token, password } = await req.json();
  if (!token || !password) return NextResponse.json({ error: "Missing data" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password too short" }, { status: 400 });

  const member = await prisma.teamMember.findUnique({
    where: { inviteToken: token },
    select: { id: true, status: true, inviteExpiresAt: true },
  });

  if (!member) return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  if (member.status !== "PENDING") return NextResponse.json({ error: "Already activated" }, { status: 409 });
  if (member.inviteExpiresAt && member.inviteExpiresAt < new Date()) return NextResponse.json({ error: "Token expired" }, { status: 410 });

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.teamMember.update({
    where: { id: member.id },
    data: {
      passwordHash,
      status: "ACTIVE",
      inviteToken: null,
      inviteExpiresAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}
