import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, requireRestaurantForOwner, authErrorResponse } from "@/lib/adminAuth";

interface RewardTier {
  stamp: number;
  reward: string;
}

// Valida y sanea la lista de niveles de recompensa contra la meta de sellos.
function sanitizeRewards(raw: unknown, stampGoal: number): RewardTier[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const tiers: RewardTier[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const stamp = Math.round(Number((item as any).stamp));
    const reward = typeof (item as any).reward === "string" ? (item as any).reward.trim().slice(0, 120) : "";
    if (!Number.isFinite(stamp) || stamp < 1 || stamp > stampGoal) continue;
    if (!reward) continue;
    if (seen.has(stamp)) continue;
    seen.add(stamp);
    tiers.push({ stamp, reward });
  }
  tiers.sort((a, b) => a.stamp - b.stamp);
  return tiers;
}

// GET /api/loyalty/program?restaurantId=xxx
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const restaurantId = req.nextUrl.searchParams.get("restaurantId");
    if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });
    await requireRestaurantForOwner(req, restaurantId);

    const program = await prisma.loyaltyProgram.findUnique({ where: { restaurantId } });
    return NextResponse.json({ program });
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[Loyalty program GET]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

// POST /api/loyalty/program  → crea o actualiza (upsert) la configuración.
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const restaurantId = body.restaurantId as string | undefined;
    if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });
    await requireRestaurantForOwner(req, restaurantId);

    const data: Record<string, unknown> = {};

    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 80);
    if (typeof body.active === "boolean") data.active = body.active;
    if (typeof body.description === "string") data.description = body.description.trim().slice(0, 300);
    if (typeof body.stampIcon === "string" && body.stampIcon.trim()) {
      const raw = body.stampIcon.trim();
      // "logo" = usar el logo del restaurante; si no, un solo carácter/emoji
      data.stampIcon = raw === "logo" ? "logo" : [...raw][0] ?? "★";
    }

    // Meta de sellos (1..50). Necesaria para validar los niveles.
    let stampGoal: number | undefined;
    if (body.stampGoal != null) {
      const n = Math.round(Number(body.stampGoal));
      if (!Number.isFinite(n) || n < 1 || n > 50) {
        return NextResponse.json({ error: "La cantidad de sellos debe estar entre 1 y 50" }, { status: 400 });
      }
      stampGoal = n;
      data.stampGoal = n;
    }

    if (typeof body.cardColorHex === "string") {
      const hex = body.cardColorHex.trim();
      if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
        return NextResponse.json({ error: "Color inválido (usa formato #RRGGBB)" }, { status: 400 });
      }
      data.cardColorHex = hex;
    }

    if (typeof body.stampColorHex === "string") {
      const hex = body.stampColorHex.trim();
      if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
        return NextResponse.json({ error: "Color de sello inválido (usa formato #RRGGBB)" }, { status: 400 });
      }
      data.stampColorHex = hex;
    }

    if (body.bgImageUrl !== undefined) {
      data.bgImageUrl =
        typeof body.bgImageUrl === "string" && body.bgImageUrl.trim() ? body.bgImageUrl.trim().slice(0, 500) : null;
    }

    if (typeof body.logoUrl === "string") data.logoUrl = body.logoUrl.trim().slice(0, 500) || null;

    // Niveles de recompensa. Si no viene stampGoal en el body, usamos el guardado.
    if (body.rewards !== undefined) {
      const existing = stampGoal == null
        ? await prisma.loyaltyProgram.findUnique({ where: { restaurantId }, select: { stampGoal: true } })
        : null;
      const goal = stampGoal ?? existing?.stampGoal ?? 8;
      data.rewards = sanitizeRewards(body.rewards, goal);
    }

    const program = await prisma.loyaltyProgram.upsert({
      where: { restaurantId },
      create: { restaurantId, ...data },
      update: data,
    });

    return NextResponse.json({ program });
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[Loyalty program POST]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
