import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/admin/broadcast/submit-template
 * Submits the "pedidos_online" WhatsApp template to Twilio → Meta for approval.
 * Auth: ?key=SEED_SECRET
 *
 * After calling this, Twilio returns a SID (HX...).
 * Copy that SID and replace TEMPLATE_SID_PEDIDOS_ONLINE in broadcast/route.ts.
 */
export async function POST(req: NextRequest) {
  const seedSecret = process.env.SEED_SECRET;
  const queryKey = req.nextUrl.searchParams.get("key");
  const adminToken = req.cookies.get("admin_token")?.value;
  const adminId = req.cookies.get("admin_id")?.value;
  const hasAdminAuth = !!(adminToken && adminId);
  const hasSeedAuth = !!(seedSecret && queryKey === seedSecret);
  if (!hasAdminAuth && !hasSeedAuth) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const SID = process.env.TWILIO_ACCOUNT_SID;
  const TOKEN = process.env.TWILIO_AUTH_TOKEN;
  if (!SID || !TOKEN) {
    return NextResponse.json({ error: "Missing Twilio credentials" }, { status: 500 });
  }
  const auth = "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64");

  const templateName = "nueva_funcion_pedidos_online";
  const templateBody =
    "Hola {{1}}, desde ahora puedes recibir pedidos online con tu nueva página de pedidos. Tus clientes podrán pedir para retiro o delivery y el pedido te llegará a tu Whatsapp. Sin comisiones ni app de terceros.\n\n👉 Ve el demo: quierocomer.cl/pedir/el-menu-de-la-esquina\n🔧 Actívalo en tu panel: quierocomer.cl/panel";

  // Create content template
  const createRes = await fetch("https://content.twilio.com/v1/Content", {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      friendly_name: templateName,
      language: "es",
      variables: { "1": "nombre" },
      types: { "twilio/text": { body: templateBody } },
    }),
  });
  const template = await createRes.json();

  if (!template.sid) {
    return NextResponse.json({ error: "Failed to create template", detail: template }, { status: 500 });
  }

  // Submit for Meta approval as MARKETING
  const approvalRes = await fetch(
    `https://content.twilio.com/v1/Content/${template.sid}/ApprovalRequests/whatsapp`,
    {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ name: templateName, category: "MARKETING" }),
    },
  );
  const approval = await approvalRes.json();

  return NextResponse.json({
    ok: true,
    sid: template.sid,
    approval_status: approval.status || approval,
    next_step: `Reemplaza TEMPLATE_SID_PEDIDOS_ONLINE en broadcast/route.ts con: ${template.sid}`,
  });
}
