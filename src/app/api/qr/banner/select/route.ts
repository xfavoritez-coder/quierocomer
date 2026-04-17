import { NextResponse } from "next/server";
import { selectBannerVariant, recordImpression } from "@/lib/qr/utils/bannerVariants";

export async function GET() {
  try {
    const variant = await selectBannerVariant();
    if (!variant) return NextResponse.json({ variant: null });

    await recordImpression(variant.id);

    return NextResponse.json({ variant: { id: variant.id, text: variant.text } });
  } catch (error) {
    console.error("Banner select error:", error);
    return NextResponse.json({ variant: null });
  }
}
