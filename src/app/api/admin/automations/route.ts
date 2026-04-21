import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EMAIL_TEMPLATES } from "@/lib/campaigns/templates";
import {
  checkAdminAuth,
  assertOwnsRestaurant,
  authErrorResponse,
} from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const restaurantId = req.nextUrl.searchParams.get("restaurantId");
    if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });
    await assertOwnsRestaurant(req, restaurantId);

    const rules = await prisma.automationRule.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ rules });
  } catch (e: any) {
    if (e.status === 403) return authErrorResponse(e);
    console.error("Automations GET error:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { restaurantId, name, trigger, triggerConfig, subject, bodyHtml, templateId } = await req.json();
    if (!restaurantId || !name || !trigger) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    await assertOwnsRestaurant(req, restaurantId);

    let finalSubject = subject;
    let finalBody = bodyHtml;
    if (templateId) {
      const t = EMAIL_TEMPLATES.find((t) => t.id === templateId);
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
  } catch (e: any) {
    if (e.status === 403) return authErrorResponse(e);
    console.error("Automation create error:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { id, isActive, ...data } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    // Ownership check
    const existing = await prisma.automationRule.findUnique({ where: { id }, select: { restaurantId: true } });
    if (!existing) return NextResponse.json({ error: "Regla no encontrada" }, { status: 404 });
    await assertOwnsRestaurant(req, existing.restaurantId);

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
  } catch (e: any) {
    if (e.status === 403) return authErrorResponse(e);
    console.error("Automation update error:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
