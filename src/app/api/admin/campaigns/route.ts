import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sendCampaign } from "@/lib/campaigns/sender";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  if (!cookieStore.get("admin_token")?.value) return NextResponse.json({ error: "Not auth" }, { status: 401 });

  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  const campaigns = await prisma.campaign.findMany({
    where: { restaurantId },
    include: { segment: { select: { id: true, name: true, cachedCount: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Get recipient stats for sent campaigns
  const sentIds = campaigns.filter(c => c.status === "SENT").map(c => c.id);
  const recipientStats = sentIds.length ? await prisma.campaignRecipient.groupBy({
    by: ["campaignId"],
    where: { campaignId: { in: sentIds } },
    _count: { id: true },
  }) : [];

  const openStats = sentIds.length ? await prisma.campaignRecipient.groupBy({
    by: ["campaignId"],
    where: { campaignId: { in: sentIds }, openedAt: { not: null } },
    _count: { id: true },
  }) : [];

  const statsMap: Record<string, { sent: number; opened: number }> = {};
  recipientStats.forEach((r: any) => { statsMap[r.campaignId] = { sent: r._count.id, opened: 0 }; });
  openStats.forEach((r: any) => { if (statsMap[r.campaignId]) statsMap[r.campaignId].opened = r._count.id; });

  return NextResponse.json({ campaigns, recipientStats: statsMap });
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  if (!cookieStore.get("admin_token")?.value) return NextResponse.json({ error: "Not auth" }, { status: 401 });

  try {
    const body = await req.json();
    const { restaurantId, name, segmentId, subject, bodyHtml, action } = body;

    if (action === "send" && body.campaignId) {
      const result = await sendCampaign(body.campaignId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (!restaurantId || !name) {
      return NextResponse.json({ error: "restaurantId and name required" }, { status: 400 });
    }

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
  } catch (error) {
    console.error("Campaign error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const cookieStore = await cookies();
  if (!cookieStore.get("admin_token")?.value) return NextResponse.json({ error: "Not auth" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

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
  } catch (error) {
    console.error("Campaign update error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
