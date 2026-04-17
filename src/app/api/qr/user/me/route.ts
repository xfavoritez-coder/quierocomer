import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("qr_user_id")?.value;

  if (!userId) {
    return NextResponse.json({ user: null });
  }

  const user = await prisma.qRUser.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, birthDate: true, dietType: true, restrictions: true },
  });

  return NextResponse.json({ user: user || null });
}
