import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const lid = req.nextUrl.searchParams.get("lid");
  const url = req.nextUrl.searchParams.get("url");

  if (lid) {
    prisma.lead.update({
      where: { id: lid },
      data: { emailClickedAt: new Date() },
    }).catch(() => {});
  }

  const destination = url || "https://quierocomer.cl";
  return NextResponse.redirect(destination);
}
