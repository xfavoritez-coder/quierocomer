import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";

export const maxDuration = 300;

/**
 * POST /api/admin/broadcast
 * Sends a WhatsApp template blast to all restaurant owners with a WA number.
 *
 * Auth: ?key=SEED_SECRET or admin cookie.
 *
 * Body: { campaignId: string, dry?: boolean }
 *   campaignId: key of CAMPAIGNS below
 *   dry: if true, returns the list without sending
 *
 * ── Template submission ──
 * To submit a new template for Meta approval, POST to /api/admin/create-wa-template with:
 * {
 *   templates: [{
 *     name: "nueva_funcion_pedidos_online",
 *     body: "Hola {{1}} 👋 Tenemos una novedad en QuieroComer.\n\nAhora tus clientes pueden ver tu carta y hacerte pedidos *en línea*, directo a tu WhatsApp. Sin comisiones ni apps de terceros.\n\n👉 Ve el demo: quierocomer.cl/pedir/el-menu-de-la-esquina\n🔧 Actívalo en tu panel: quierocomer.cl/panel",
 *     variables: { "1": "nombre" }
 *   }]
 * }
 * Once Meta approves (minutes to hours), Twilio returns the SID.
 * Replace TEMPLATE_SID_PEDIDOS_ONLINE below with that SID.
 */

// ── Fill after Meta approval ─────────────────────────────────────────────────
const TEMPLATE_SID_PEDIDOS_ONLINE = "HX0d3df4efdc6aeb027d3ef60383f8c34c"; // nueva_funcion_pedidos_online — pendiente aprobación Meta

const CAMPAIGNS: Record<string, {
  sid: string;
  vars: (name: string) => Record<string, string>;
  text: (name: string) => string;
  category: "MARKETING" | "UTILITY";
}> = {
  pedidos_online: {
    sid: TEMPLATE_SID_PEDIDOS_ONLINE,
    vars: (name) => ({ "1": name }),
    text: (name) =>
      `Hola ${name}, desde ahora puedes recibir pedidos online con tu nueva página de pedidos. Tus clientes podrán pedir para retiro o delivery y el pedido te llegará a tu Whatsapp. Sin comisiones ni app de terceros.\n\n👉 Ve el demo: quierocomer.cl/pedir/el-menu-de-la-esquina\n🔧 Actívalo en tu panel: quierocomer.cl/panel`,
    category: "MARKETING",
  },
};

const BLACKLIST = new Set([
  "+56976485972", "+56977940643", "+56971204150",
]);

export async function POST(req: NextRequest) {
  // Auth
  const seedSecret = process.env.SEED_SECRET;
  const queryKey = req.nextUrl.searchParams.get("key");
  const adminToken = req.cookies.get("admin_token")?.value;
  const adminId = req.cookies.get("admin_id")?.value;
  const hasAdminAuth = !!(adminToken && adminId);
  const hasSeedAuth = !!(seedSecret && queryKey === seedSecret);
  if (!hasAdminAuth && !hasSeedAuth) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { campaignId, dry = false } = body as { campaignId?: string; dry?: boolean };

  if (!campaignId || !CAMPAIGNS[campaignId]) {
    return NextResponse.json(
      { error: "campaignId inválido", valid: Object.keys(CAMPAIGNS) },
      { status: 400 },
    );
  }

  const campaign = CAMPAIGNS[campaignId];

  if (campaign.sid === "PENDING_APPROVAL") {
    return NextResponse.json(
      { error: "Template aún no aprobado. Reemplaza TEMPLATE_SID_PEDIDOS_ONLINE en broadcast/route.ts con el SID de Twilio." },
      { status: 400 },
    );
  }

  // Fetch all owners with WhatsApp, exclude import@ and blacklist
  const owners = await prisma.restaurantOwner.findMany({
    where: {
      whatsapp: { not: null },
      email: { not: { startsWith: "import@" } },
    },
    select: {
      id: true,
      name: true,
      whatsapp: true,
      restaurants: { select: { id: true, name: true }, take: 1 },
    },
  });

  const eligible = owners.filter(
    (o) => o.whatsapp && !BLACKLIST.has(o.whatsapp),
  );

  if (dry) {
    return NextResponse.json({
      dry: true,
      total: eligible.length,
      recipients: eligible.map((o) => ({
        name: o.name,
        whatsapp: o.whatsapp,
        restaurant: o.restaurants[0]?.name,
      })),
    });
  }

  // Send with throttle (100ms between messages)
  const results: { name: string; whatsapp: string; ok: boolean; sid?: string; error?: string }[] = [];

  for (const owner of eligible) {
    const firstName = owner.name.split(" ")[0];
    try {
      const sid = await sendWhatsApp({
        to: owner.whatsapp!,
        body: "",
        contentSid: campaign.sid,
        contentVariables: campaign.vars(firstName),
      });

      // Log in DB
      const restaurantId = owner.restaurants[0]?.id;
      if (restaurantId) {
        const msgBody = campaign.text(firstName);
        await prisma.whatsAppMessage.create({
          data: {
            phone: owner.whatsapp!,
            direction: "OUTBOUND",
            body: msgBody,
            twilioSid: sid || "",
            status: "sent",
            restaurantId,
          },
        }).catch(() => {});

        await prisma.panelActivity.create({
          data: {
            restaurantId,
            action: `broadcast_${campaignId}`,
            details: { sid, whatsapp: owner.whatsapp, ownerName: firstName },
          },
        }).catch(() => {});
      }

      results.push({ name: owner.name, whatsapp: owner.whatsapp!, ok: true, sid: sid || undefined });
    } catch (e: any) {
      results.push({ name: owner.name, whatsapp: owner.whatsapp!, ok: false, error: e.message });
    }

    // Throttle: 100ms between sends
    await new Promise((r) => setTimeout(r, 100));
  }

  const sent = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  return NextResponse.json({ ok: true, campaignId, sent, failed, results });
}
