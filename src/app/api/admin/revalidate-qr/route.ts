import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { checkAdminAuth } from "@/lib/adminAuth";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const slug = url.searchParams.get("slug");

  const hasKey = key === process.env.SEED_SECRET;
  const hasAdmin = !checkAdminAuth(request);
  if (!hasKey && !hasAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (slug) {
    revalidateTag(`qr-restaurant-${slug}`, { expire: 0 } as any);
    revalidateTag(`ecom-storefront-slug-${slug}`, { expire: 0 } as any);
  } else {
    revalidateTag("qr-restaurant", { expire: 0 } as any);
  }
  revalidateTag("ecom-storefront", { expire: 0 } as any);

  return NextResponse.json({ ok: true, slug: slug ?? "all", at: new Date().toISOString() });
}
