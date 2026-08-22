import { NextRequest, NextResponse } from "next/server";
import { confirmFlowPayment } from "@/lib/payments/flowConfirm";

export const runtime = "nodejs";

/**
 * Confirmación servidor-a-servidor de Flow (urlConfirmation). Flow envía el
 * token por POST; confirmamos el pago. Debe responder 200.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const token = (form?.get("token") as string) || req.nextUrl.searchParams.get("token");
  await confirmFlowPayment(token).catch((e) => console.error("[ecommerce/flow/confirm]", e));
  return NextResponse.json({ ok: true });
}
