import { NextResponse } from "next/server";
import { recordConversion } from "@/lib/qr/utils/bannerVariants";

export async function POST(request: Request) {
  try {
    const { variantId } = await request.json();
    if (!variantId) return NextResponse.json({ error: "Missing variantId" }, { status: 400 });

    await recordConversion(variantId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Banner convert error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
