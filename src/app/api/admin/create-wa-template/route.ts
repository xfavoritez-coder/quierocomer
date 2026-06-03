import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/admin/create-wa-template
 * Creates WhatsApp content templates in Twilio and submits for Meta approval.
 * Auth via SEED_SECRET query param.
 */
export async function GET(req: NextRequest) {
  return NextResponse.json({ error: "Use POST" }, { status: 405 });
}

export async function POST(req: NextRequest) {
  // Auth: admin cookies OR seed secret (query, header, or body)
  const seedSecret = process.env.SEED_SECRET;
  const queryKey = req.nextUrl.searchParams.get("key") || req.headers.get("x-seed-key");
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

  const body = await req.json().catch(() => null);
  if (!body?.templates || !Array.isArray(body.templates)) {
    return NextResponse.json({ error: "templates array required" }, { status: 400 });
  }

  const results: any[] = [];

  for (const t of body.templates) {
    try {
      // Create template
      const createRes = await fetch("https://content.twilio.com/v1/Content", {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          friendly_name: t.name,
          language: "es",
          variables: t.variables || { "1": "nombre", "2": "restaurante" },
          types: { "twilio/text": { body: t.body } },
        }),
      });
      const template = await createRes.json();

      if (!template.sid) {
        results.push({ name: t.name, error: template.message || "Failed to create" });
        continue;
      }

      // Submit for Meta approval
      const approvalRes = await fetch(`https://content.twilio.com/v1/Content/${template.sid}/ApprovalRequests/whatsapp`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({ name: t.name, category: "UTILITY" }),
      });
      const approval = await approvalRes.json();

      results.push({ name: t.name, sid: template.sid, approval: approval.status || "submitted" });
    } catch (e: any) {
      results.push({ name: t.name, error: e.message });
    }
  }

  return NextResponse.json({ results });
}
