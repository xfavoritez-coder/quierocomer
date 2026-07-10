import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PASSWORD = "joan";

const ACTION_LABELS: Record<string, string> = {
  panel_login: "Inició sesión en el panel",
  login: "Inició sesión en el panel",
  panel_visit: "Visitó sección", // label gets section appended below
  dish_create: "Creó un plato",
  dish_edit: "Editó un plato",
  dish_delete: "Eliminó un plato",
  dish_show: "Activó plato",
  dish_hide: "Ocultó plato",
  dish_photo_upload: "Subió foto de plato",
  category_create: "Creó una categoría",
  category_edit: "Editó una categoría",
  category_delete: "Eliminó una categoría",
  category_show: "Activó categoría",
  category_hide: "Ocultó categoría",
  photo_upload: "Subió foto de plato",
  profile_edit: "Editó perfil del local",
  logo_upload: "Subió logo del local",
  promo_create: "Creó una promoción",
  promo_edit: "Editó una promoción",
  qr_download: "Descargó código QR",
  exportar_carta_viewed: "Abrió exportar carta en PDF",
  carta_export: "Exportó carta en PDF",
  plan_upgrade: "Subió de plan",
  plan_subscribe_clicked: "Hizo clic en suscribirse",
  plan_tab_viewed: "Vio tab de planes",
  plan_modal_opened: "Abrió modal de planes",
  happy_hour_add: "Configuró Happy Hour",
  happy_hour_edit: "Editó Happy Hour",
  announcement_create: "Creó un anuncio",
  announcement_edit: "Editó un anuncio",
  menu_import: "Importó menú",
  menu_import_failed: "Fallo al importar menú",
  modifier_create: "Creó opciones/modificadores",
  modifier_edit: "Editó opciones/modificadores",
  modifier_delete: "Eliminó opciones/modificadores",
  nurturing_trial_reminder: "Camila envió mensaje por WhatsApp (recordatorio trial)",
  nurturing_activation: "Camila envió mensaje por WhatsApp (activación)",
  nurturing_engagement: "Camila envió mensaje por WhatsApp (seguimiento)",
  nurturing_welcome: "Camila envió mensaje por WhatsApp (bienvenida)",
  nurturing_inactive: "Camila envió mensaje por WhatsApp (inactivo)",
  nurturing_: "Camila envió mensaje por WhatsApp",
};

const SECTION_LABELS: Record<string, string> = {
  carta: "Carta",
  dashboard: "Dashboard",
  clientes: "Clientes",
  suscripcion: "Suscripción / Planes",
  configuracion: "Configuración",
  config: "Configuración",
  exportar: "Exportar carta",
  promociones: "Promociones",
  promos: "Promociones",
  "happy-hour": "Happy Hour",
  happyhour: "Happy Hour",
  anuncios: "Anuncios",
  estadisticas: "Estadísticas",
  stats: "Estadísticas",
  control: "Control / Inventario",
  qr: "Mi QR",
  perfil: "Perfil",
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
        const details = a.details as Record<string, any> | null;

        // panel_visit: show which section
        if (a.action === "panel_visit") {
          const rawSection = details?.section as string | undefined;
          const sectionLabel = rawSection
            ? (SECTION_LABELS[rawSection.toLowerCase()] || rawSection)
            : null;
          extra.push({
            label: sectionLabel ? `Visitó: ${sectionLabel}` : "Visitó el panel",
            ts: a.createdAt.toISOString(),
          });
          continue;
        }

        const baseLabel = ACTION_LABELS[a.action]
          || (a.action.startsWith("nurturing_") ? "Camila envió mensaje por WhatsApp" : null)
          || a.action.replace(/_/g, " ");
        const sub = details?.dishName || details?.name || details?.title || null;
        // For plan actions, show plan name
        const planSub = details?.plan || details?.initialTab || null;
        const finalSub = sub || planSub;
        extra.push({ label: finalSub ? `${baseLabel}: ${finalSub}` : baseLabel, ts: a.createdAt.toISOString() });
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
