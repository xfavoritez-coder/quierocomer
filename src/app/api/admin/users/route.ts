import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const search = req.nextUrl.searchParams.get("search") || "";
    const page = Number(req.nextUrl.searchParams.get("page") || "1");
    const limit = 30;

    const where = search
      ? { OR: [
          { email: { contains: search, mode: "insensitive" as const } },
          { name: { contains: search, mode: "insensitive" as const } },
        ]}
      : {};

    const [users, total] = await Promise.all([
      prisma.qRUser.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          birthDate: true,
          dietType: true,
          restrictions: true,
          dislikes: true,
          verifiedAt: true,
          createdAt: true,
          unsubscribedAt: true,
          lastEmailAt: true,
          _count: {
            select: {
              sessions: true,
              dishFavorites: true,
              interactions: true,
              campaignRecipients: true,
            },
          },
        },
      }),
      prisma.qRUser.count({ where }),
    ]);

    return NextResponse.json({ users, total, pages: Math.ceil(total / limit) });
  } catch (e) {
    console.error("[Admin users]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
