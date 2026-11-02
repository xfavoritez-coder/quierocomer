import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const r = await prisma.restaurant.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true, logoUrl: true, posEnabled: true, ecommerceStoreConfig: true },
  });
  if (!r) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { ecommerceStoreConfig, ...rest } = r;
  const branchName = parseStoreConfig(ecommerceStoreConfig).branchName;
  return NextResponse.json({ ...rest, branchName });
}
