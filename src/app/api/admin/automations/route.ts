import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { EMAIL_TEMPLATES } from "@/lib/campaigns/templates";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  if (!cookieStore.get("admin_token")?.value) return NextResponse.json({ error: "Not auth" }, { status: 401 });

  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  const rules = await prisma.automationRule.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  if (!cookieStore.get("admin_token")?.value) return NextResponse.json({ error: "Not auth" }, { status: 401 });

  try {
    const { restaurantId, name, trigger, triggerConfig, subject, bodyHtml, templateId } = await req.json();
    if (!restaurantId || !name || !trigger) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    // Apply template if selected
    let finalSubject = subject;
    let finalBody = bodyHtml;
    if (templateId) {
      const t = EMAIL_TEMPLATES.find(t => t.id === templateId);
      if (t) { finalSubject = finalSubject || t.subject; finalBody = finalBody || t.bodyHtml; }
    }

    const rule = await prisma.automationRule.create({
      data: {
        restaurantId, name, trigger,
        triggerConfig: triggerConfig || {},
        subject: finalSubject || null,
        bodyHtml: finalBody || null,
      },
    });

    return NextResponse.json({ rule });
  } catch (error) {
    console.error("Automation create error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const cookieStore = await cookies();
  if (!cookieStore.get("admin_token")?.value) return NextResponse.json({ error: "Not auth" }, { status: 401 });

  const { id, isActive, ...data } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const rule = await prisma.automationRule.update({
    where: { id },
    data: {
      ...(isActive !== undefined && { isActive }),
      ...(data.name && { name: data.name }),
      ...(data.subject !== undefined && { subject: data.subject }),
      ...(data.bodyHtml !== undefined && { bodyHtml: data.bodyHtml }),
      ...(data.triggerConfig && { triggerConfig: data.triggerConfig }),
    },
  });

  return NextResponse.json({ rule });
}
