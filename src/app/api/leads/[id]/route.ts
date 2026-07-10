import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PASSWORD = "joan";

const ACTION_LABELS: Record<string, string> = {
  login: "Ingresó al panel",
  dish_add: "Agregó un plato",
  dish_edit: "Editó un plato",
  dish_delete: "Eliminó un plato",
  dish_photo_upload: "Subió foto de plato",
  category_add: "Agregó una categoría",
  category_edit: "Editó una categoría",
  category_delete: "Eliminó una categoría",
  photo_upload: "Subió una foto",
  profile_edit: "Editó perfil del local",
  logo_upload: "Subió logo del local",
  promo_add: "Creó una promoción",
  promo_edit: "Editó una promoción",
  qr_download: "Descargó código QR",
  carta_export: "Exportó carta en PDF",
  plan_upgrade: "Subió de plan",
  happy_hour_add: "Configuró Happy Hour",
  happy_hour_edit: "Editó Happy Hour",
  announcement_add: "Creó un anuncio",
  announcement_edit: "Editó un anuncio",
  nurturing_trial_reminder: "Email de recordatorio trial enviado",
  nurturing_activation: "Email de activación enviado",
  nurturing_engagement: "Email de engagement enviado",
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = req.headers.get("x-leads-auth");
  if (auth !== PASSWORD) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { generatedSlug: true, whatsappClickedAt: true },
  });
  if (!lead) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const extra: { label: string; ts: string; color?: string }[] = [];

  if (lead.whatsappClickedAt) {
    extra.push({ label: "Hizo clic en enlace WhatsApp", ts: lead.whatsappClickedAt.toISOString(), color: "#25d366" });
  }

  if (lead.generatedSlug) {
    const restaurant = await prisma.restaurant.findFirst({
      where: { slug: lead.generatedSlug },
      select: { id: true },
    });
    if (restaurant) {
      const activity = await prisma.panelActivity.findMany({
        where: { restaurantId: restaurant.id },
        orderBy: { createdAt: "asc" },
        take: 100,
        select: { action: true, details: true, createdAt: true },
      });
      for (const a of activity) {
        const label = ACTION_LABELS[a.action] || a.action.replace(/_/g, " ");
        const details = a.details as Record<string, any> | null;
        const sub = details?.name || details?.title || details?.dishName || null;
        extra.push({ label: sub ? `${label}: ${sub}` : label, ts: a.createdAt.toISOString() });
      }
    }
  }

  return NextResponse.json({ activity: extra });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = req.headers.get("x-leads-auth");
  if (auth !== PASSWORD) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { crmStatus, crmFollowUpAt, note } = body;

  const current = await prisma.lead.findUnique({ where: { id }, select: { crmNotes: true } });
  if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const existingNotes = Array.isArray(current.crmNotes) ? current.crmNotes : [];
  const updatedNotes = note
    ? [...existingNotes, { text: note, ts: new Date().toISOString() }]
    : existingNotes;

  const updated = await prisma.lead.update({
    where: { id },
    data: {
      ...(crmStatus !== undefined && { crmStatus }),
      ...(crmFollowUpAt !== undefined && { crmFollowUpAt: crmFollowUpAt ? new Date(crmFollowUpAt) : null }),
      ...(note && { crmNotes: updatedNotes }),
    },
    select: {
      id: true,
      crmStatus: true,
      crmNotes: true,
      crmFollowUpAt: true,
    },
  });

  return NextResponse.json(updated);
}
