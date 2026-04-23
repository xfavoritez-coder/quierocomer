import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }

    await prisma.emailLog.create({
      data: {
        to: email,
        subject: "Landing — Solicitud de demo",
        purpose: "landing_lead",
        status: "pending",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Landing contact error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
