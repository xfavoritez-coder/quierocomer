import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("qr_user_id")?.value;
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json();
  const user = await prisma.qRUser.update({
    where: { id: userId },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.birthDate !== undefined && { birthDate: body.birthDate ? new Date(body.birthDate) : null }),
      ...(body.dietType !== undefined && { dietType: body.dietType }),
      ...(body.restrictions !== undefined && { restrictions: body.restrictions }),
    },
  });

  return NextResponse.json({ user });
}
