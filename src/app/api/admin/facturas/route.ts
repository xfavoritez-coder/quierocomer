import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { sendAdminEmail, facturaEmailHtml } from "@/lib/email/sendAdminEmail";
import { PLANS, grossOf, type PlanKey } from "@/lib/billing/plans-central";

function getCurrentPeriodo(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function netForRestaurant(plan: string, customPlanPriceNet: number | null): number {
  if (customPlanPriceNet && customPlanPriceNet > 0) return customPlanPriceNet;
  const p = PLANS[plan as PlanKey];
  return p?.priceMonthly ?? 0;
}

/**
 * GET /api/admin/facturas?periodo=2026-10
 * Returns all active restaurants with invoice status for that period.
 */
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const periodo = req.nextUrl.searchParams.get("periodo") || getCurrentPeriodo();

  const restaurants = await prisma.restaurant.findMany({
    where: {
      subscriptionStatus: "ACTIVE",
      billingExempt: false,
      plan: { not: "FREE" },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      billingRut: true,
      billingCompanyName: true,
      plan: true,
      customPlanPriceNet: true,
      owner: { select: { name: true, email: true } },
      invoices: {
        where: { periodo },
        select: { id: true, pdfUrl: true, emittedAt: true, emailSentAt: true },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  const result = restaurants.map(r => {
    const amountNet = netForRestaurant(r.plan, r.customPlanPriceNet);
    const invoice = r.invoices[0] ?? null;
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      billingRut: r.billingRut,
      billingCompanyName: r.billingCompanyName,
      ownerName: r.owner?.name ?? null,
      ownerEmail: r.owner?.email ?? null,
      plan: r.plan,
      amountNet,
      amountGross: grossOf(amountNet),
      invoice: invoice ? {
        id: invoice.id,
        pdfUrl: invoice.pdfUrl,
        emittedAt: invoice.emittedAt,
        emailSentAt: invoice.emailSentAt,
      } : null,
    };
  });

  return NextResponse.json({ restaurants: result, periodo });
}

/**
 * POST /api/admin/facturas
 * Upload a PDF invoice for a restaurant period, save to Supabase, create Invoice record, send email.
 * FormData: restaurantId, periodo, file (PDF)
 */
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const formData = await req.formData();
    const restaurantId = formData.get("restaurantId") as string | null;
    const periodo = (formData.get("periodo") as string | null) || getCurrentPeriodo();
    const file = formData.get("file") as File | null;

    if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
    if (!file) return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      return NextResponse.json({ error: "Solo se aceptan archivos PDF" }, { status: 400 });
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "Máximo 20MB" }, { status: 400 });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        customPlanPriceNet: true,
        owner: { select: { name: true, email: true } },
      },
    });
    if (!restaurant) return NextResponse.json({ error: "Local no encontrado" }, { status: 404 });

    const buffer = Buffer.from(await file.arrayBuffer());

    // Build filename: "facturas/{restaurantId}/{slug}-{periodo}.pdf"
    const safeSlug = (restaurant.slug || restaurant.name)
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);
    const fileName = `facturas/${restaurantId}/${safeSlug}-${periodo}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("fotos")
      .upload(fileName, buffer, { contentType: "application/pdf", upsert: true });

    if (uploadError) {
      console.error("[Facturas] Supabase upload error:", uploadError);
      return NextResponse.json({ error: `Error al subir: ${uploadError.message}` }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from("fotos").getPublicUrl(fileName);
    const pdfUrl = urlData.publicUrl;

    // Upsert Invoice record
    const existing = await prisma.invoice.findFirst({
      where: { restaurantId, periodo },
    });

    let invoiceId: string;
    if (existing) {
      await prisma.invoice.update({
        where: { id: existing.id },
        data: { pdfUrl, status: "EMITIDA", emittedAt: new Date() },
      });
      invoiceId = existing.id;
    } else {
      const created = await prisma.invoice.create({
        data: { restaurantId, periodo, pdfUrl, status: "EMITIDA" },
      });
      invoiceId = created.id;
    }

    // Send email to owner with PDF attachment
    const ownerEmail = restaurant.owner?.email;
    let emailSentAt: Date | null = null;
    if (ownerEmail) {
      const amountNet = netForRestaurant(restaurant.plan, restaurant.customPlanPriceNet);
      const amountGross = grossOf(amountNet);

      const [year, month] = periodo.split("-");
      const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
      const mesLabel = MONTHS[parseInt(month, 10) - 1] ?? month;

      await sendAdminEmail({
        to: ownerEmail,
        subject: `Tu factura de ${mesLabel} ${year} — ${restaurant.name}`,
        html: facturaEmailHtml({ restaurantName: restaurant.name, periodo, amountNet, amountGross }),
        purpose: "factura",
        attachments: [{
          filename: `factura-${safeSlug}-${periodo}.pdf`,
          content: buffer,
        }],
      });

      emailSentAt = new Date();
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { emailSentAt },
      });
    }

    return NextResponse.json({
      ok: true,
      invoiceId,
      pdfUrl,
      emailSentAt,
      emailTo: ownerEmail ?? null,
    });
  } catch (e: any) {
    console.error("[Facturas] Error:", e);
    return NextResponse.json({ error: e?.message || "Error interno" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/facturas?invoiceId=...
 * Remove a PDF invoice (deletes from storage + DB record)
 */
export async function DELETE(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const invoiceId = req.nextUrl.searchParams.get("invoiceId");
  if (!invoiceId) return NextResponse.json({ error: "Falta invoiceId" }, { status: 400 });

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });

  if (invoice.pdfUrl) {
    // Extract path from public URL
    const url = invoice.pdfUrl;
    const match = url.match(/\/fotos\/(.+)$/);
    if (match) {
      await supabase.storage.from("fotos").remove([match[1]]).catch(() => {});
    }
  }

  await prisma.invoice.delete({ where: { id: invoiceId } });

  return NextResponse.json({ ok: true });
}
