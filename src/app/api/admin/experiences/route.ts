import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  if (!cookieStore.get("admin_token")?.value) return NextResponse.json({ error: "Not auth" }, { status: 401 });

  const [templates, instances, submissions] = await Promise.all([
    prisma.experienceTemplate.findMany({
      include: { _count: { select: { results: true, instances: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.experience.findMany({
      include: {
        restaurant: { select: { id: true, name: true, slug: true } },
        template: { select: { name: true, slug: true, iconEmoji: true } },
        _count: { select: { submissions: true } },
      },
    }),
    prisma.experienceSubmission.groupBy({
      by: ["experienceId", "status"],
      _count: { id: true },
    }),
  ]);

  return NextResponse.json({ templates, instances, submissions });
}

/** Assign template to restaurant or toggle */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  if (!cookieStore.get("admin_token")?.value) return NextResponse.json({ error: "Not auth" }, { status: 401 });

  const { action, restaurantId, templateId, experienceId } = await req.json();

  if (action === "assign") {
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
    await prisma.experience.update({ where: { id: experienceId }, data: { isActive: !exp.isActive } });
    return NextResponse.json({ ok: true });
  }

  if (action === "remove") {
    await prisma.experience.delete({ where: { id: experienceId } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
