import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const campaigns = await prisma.platformCampaign.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      contacts: {
        select: {
          email: true,
          openedAt: true,
          clickedAt: true,
          unsubscribedAt: true,
          errorMsg: true,
          sentAt: true,
        },
      },
    },
  });

  const result = campaigns.map((c) => {
    const sent = c.contacts.filter((x) => x.sentAt).length;
    const opened = c.contacts.filter((x) => x.openedAt).length;
    const clicked = c.contacts.filter((x) => x.clickedAt).length;
    const unsubs = c.contacts.filter((x) => x.unsubscribedAt).length;
    const errors = c.contacts.filter((x) => x.errorMsg).length;

    return {
      id: c.id,
      subject: c.subject,
      status: c.status,
      totalContacts: c.totalContacts,
      sentAt: c.sentAt,
      createdAt: c.createdAt,
      stats: { sent, opened, clicked, unsubs, errors },
      contacts: c.contacts,
    };
  });

  // Demo leads from landing form
  const demoLeads = await prisma.emailLog.findMany({
    where: { purpose: "landing_lead" },
    orderBy: { createdAt: "desc" },
    select: { to: true, subject: true, createdAt: true },
  });

  return NextResponse.json({ campaigns: result, demoLeads });
}
