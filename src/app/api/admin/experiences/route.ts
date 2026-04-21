import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  checkAdminAuth,
  isSuperAdmin,
  assertOwnsRestaurant,
  getOwnedRestaurantIds,
  authErrorResponse,
} from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const isSuper = isSuperAdmin(req);

    // Templates: all users can see published templates
    const templates = await prisma.experienceTemplate.findMany({
      include: { _count: { select: { results: true, instances: true } } },
      orderBy: { createdAt: "desc" },
    });

    // Instances: filter by owner's restaurants if not superadmin
    let instanceFilter: any = {};
    if (!isSuper) {
      const ownedIds = await getOwnedRestaurantIds(req);
      if (!ownedIds || ownedIds.length === 0) {
        return NextResponse.json({ templates, instances: [], submissions: [] });
      }
      instanceFilter = { restaurantId: { in: ownedIds } };
    }

    const instances = await prisma.experience.findMany({
      where: instanceFilter,
      include: {
        restaurant: { select: { id: true, name: true, slug: true } },
        template: { select: { name: true, slug: true, iconEmoji: true } },
        _count: { select: { submissions: true } },
      },
    });

    const instanceIds = instances.map((i) => i.id);
    const submissions = instanceIds.length
      ? await prisma.experienceSubmission.groupBy({
          by: ["experienceId", "status"],
          where: { experienceId: { in: instanceIds } },
          _count: { id: true },
        })
      : [];

    return NextResponse.json({ templates, instances, submissions });
  } catch (e: any) {
    console.error("Experiences GET error:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

/** Assign template to restaurant or toggle */
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { action, restaurantId, templateId, experienceId } = await req.json();

    if (action === "assign") {
      // Only superadmin can assign templates
      if (!isSuperAdmin(req)) {
        return NextResponse.json({ error: "Solo superadmin puede asignar experiencias" }, { status: 403 });
      }
      const exp = await prisma.experience.upsert({
        where: { restaurantId },
        create: { restaurantId, templateId },
        update: { templateId, isActive: true },
      });
      return NextResponse.json({ ok: true, experience: exp });
    }

    if (action === "toggle") {
      const exp = await prisma.experience.findUnique({ where: { id: experienceId } });
      if (!exp) return NextResponse.json({ error: "Not found" }, { status: 404 });
      // Owner can toggle their own experience
      await assertOwnsRestaurant(req, exp.restaurantId);
      await prisma.experience.update({ where: { id: experienceId }, data: { isActive: !exp.isActive } });
      return NextResponse.json({ ok: true });
    }

    if (action === "remove") {
      // Only superadmin can remove experience assignments
      if (!isSuperAdmin(req)) {
        return NextResponse.json({ error: "Solo superadmin puede eliminar experiencias" }, { status: 403 });
      }
      await prisma.experience.delete({ where: { id: experienceId } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    if (e.status === 403) return authErrorResponse(e);
    console.error("Experiences POST error:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
