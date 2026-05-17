import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: check if onboarding is done for a restaurant
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ done: false });
  const r = await prisma.restaurant.findUnique({ where: { slug }, select: { demoOnboardingDone: true } });
  return NextResponse.json({ done: r?.demoOnboardingDone ?? false });
}

// POST: mark onboarding as done
export async function POST(req: NextRequest) {
  const { slug } = await req.json();
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
  await prisma.restaurant.update({ where: { slug }, data: { demoOnboardingDone: true } });
  return NextResponse.json({ done: true });
}
