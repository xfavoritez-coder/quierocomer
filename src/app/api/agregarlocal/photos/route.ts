import { NextRequest, NextResponse } from "next/server";
import { canSetupRestaurant } from "@/lib/restaurantClaim";
import { readAdminSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { searchUnsplashPhoto, triggerUnsplashDownload, type UnsplashPhoto, type PhotoCredit } from "@/lib/unsplash";

export const maxDuration = 120;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6";

// Unsplash photo search disabled — dishes display without photos until owner uploads their own
export async function POST(request: Request) {
  return NextResponse.json({ results: [], total: 0, message: "Fotos desactivadas — el dueño las sube desde su panel" });
}

// Apply selected photos to dishes — supports both dishId and name-based matching
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { photos, photosByName, restaurantId, claimToken } = body;
    const isSuper = readAdminSession(request)?.role === "SUPERADMIN";

    // Name-based matching
    if (photosByName?.length && restaurantId) {
      // Solo superadmin, o quien acaba de crear ESTE local en /agregarlocal.
      if (!canSetupRestaurant(request, String(restaurantId), claimToken)) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
      let applied = 0;
      for (const p of photosByName) {
        if (!p.name || !p.url) continue;
        const dish = await prisma.dish.findFirst({ where: { restaurantId, name: p.name } });
        if (dish) {
          await prisma.dish.update({ where: { id: dish.id }, data: { photos: [p.url] } });
          applied++;
        }
      }
      return NextResponse.json({ ok: true, applied });
    }

    if (!photos?.length) return NextResponse.json({ error: "No photos" }, { status: 400 });

    // Modo por dishId (ninguna pantalla lo usa hoy): solo superadmin, o con permiso
    // del local y todos los platos de ese local.
    if (!isSuper) {
      if (!restaurantId || !canSetupRestaurant(request, String(restaurantId), claimToken)) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
      const ids = photos.map((p: { dishId?: string }) => p?.dishId).filter(Boolean) as string[];
      const foreign = await prisma.dish.count({ where: { id: { in: ids }, NOT: { restaurantId: String(restaurantId) } } });
      if (foreign > 0) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    let applied = 0;
    for (const p of photos) {
      if (!p.dishId || !p.photoUrl) continue;
      const data: any = { photos: [p.photoUrl] };
      if (p.credit) data.photoCredits = [p.credit];
      await prisma.dish.update({ where: { id: p.dishId }, data });
      // Trigger Unsplash download (required by API guidelines)
      if (p.downloadLocation) triggerUnsplashDownload(p.downloadLocation).catch(() => {});
      applied++;
    }

    return NextResponse.json({ ok: true, applied });
  } catch (e: any) {
    console.error("[agregarlocal photos PUT]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
