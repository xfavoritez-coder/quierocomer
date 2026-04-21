import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendCampaign } from "@/lib/campaigns/sender";
import {
  checkAdminAuth,
  assertOwnsRestaurant,
  authErrorResponse,
} from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const restaurantId = req.nextUrl.searchParams.get("restaurantId");
    if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });
    await assertOwnsRestaurant(req, restaurantId);

    const campaigns = await prisma.campaign.findMany({
      where: { restaurantId },
      include: { segment: { select: { id: true, name: true, cachedCount: true } } },
      orderBy: { createdAt: "desc" },
    });

    const sentIds = campaigns.filter((c) => c.status === "SENT").map((c) => c.id);
    const recipientStats = sentIds.length
      ? await prisma.campaignRecipient.groupBy({
          by: ["campaignId"],
          where: { campaignId: { in: sentIds } },
          _count: { id: true },
        })
      : [];

    const openStats = sentIds.length
      ? await prisma.campaignRecipient.groupBy({
          by: ["campaignId"],
          where: { campaignId: { in: sentIds }, openedAt: { not: null } },
          _count: { id: true },
        })
      : [];

    const clickStats = sentIds.length
      ? await prisma.campaignRecipient.groupBy({
          by: ["campaignId"],
          where: { campaignId: { in: sentIds }, clickedAt: { not: null } },
          _count: { id: true },
        })
      : [];

    const statsMap: Record<string, { sent: number; opened: number; clicked: number }> = {};
    recipientStats.forEach((r: any) => { statsMap[r.campaignId] = { sent: r._count.id, opened: 0, clicked: 0 }; });
    openStats.forEach((r: any) => { if (statsMap[r.campaignId]) statsMap[r.campaignId].opened = r._count.id; });
    clickStats.forEach((r: any) => { if (statsMap[r.campaignId]) statsMap[r.campaignId].clicked = r._count.id; });

    return NextResponse.json({ campaigns, recipientStats: statsMap });
  } catch (e: any) {
    if (e.status === 403) return authErrorResponse(e);
    console.error("Campaigns GET error:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { restaurantId, name, segmentId, subject, bodyHtml, action } = body;

    if (action === "send" && body.campaignId) {
      // Verify ownership of the campaign being sent
      const campaign = await prisma.campaign.findUnique({ where: { id: body.campaignId }, select: { restaurantId: true } });
      if (!campaign) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
      await assertOwnsRestaurant(req, campaign.restaurantId);

      const result = await sendCampaign(body.campaignId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (!restaurantId || !name) {
      return NextResponse.json({ error: "restaurantId and name required" }, { status: 400 });
    }

    await assertOwnsRestaurant(req, restaurantId);

    const campaign = await prisma.campaign.create({
      data: {
        restaurantId,
        name,
        segmentId: segmentId || null,
        subject: subject || null,
        bodyHtml: bodyHtml || null,
        status: "DRAFT",
      },
      include: { segment: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ campaign });
  } catch (e: any) {
    if (e.status === 403) return authErrorResponse(e);
    console.error("Campaign error:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    // Ownership check
    const existing = await prisma.campaign.findUnique({ where: { id }, select: { restaurantId: true } });
    if (!existing) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    await assertOwnsRestaurant(req, existing.restaurantId);

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.segmentId !== undefined && { segmentId: data.segmentId || null }),
        ...(data.subject !== undefined && { subject: data.subject }),
        ...(data.bodyHtml !== undefined && { bodyHtml: data.bodyHtml }),
        ...(data.status !== undefined && { status: data.status }),
      },
      include: { segment: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ campaign });
  } catch (e: any) {
    if (e.status === 403) return authErrorResponse(e);
    console.error("Campaign update error:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
