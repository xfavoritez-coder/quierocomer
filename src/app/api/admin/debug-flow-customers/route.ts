import { NextRequest, NextResponse } from "next/server";
import { flowGet } from "@/lib/billing/flow";

const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.CRON_SECRET;

/**
 * GET /api/admin/debug-flow-customers?email=xxx
 * Lista clientes de Flow para diagnóstico.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!ADMIN_SECRET || auth !== `Bearer ${ADMIN_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const filter = searchParams.get("filter") || "";

  try {
    const result = await flowGet("/customer/getList", {
      ...(filter ? { filter } : {}),
      start: 0,
      limit: 50,
    });
    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message, data: (err as any)?.data });
  }
}
