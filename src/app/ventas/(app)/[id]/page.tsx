import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSeller } from "@/lib/ventas/session";
import { getSellerLead, getLeadRestaurant } from "@/lib/ventas/leads";
import { statusInfo } from "@/lib/ventas/status";

export const dynamic = "force-dynamic";

const EVENT_LABEL: Record<string, string> = {
  captured: "Local capturado", menu_extracted: "Carta lista", menu_failed: "No se pudo leer la carta", menu_reviewed: "Carta revisada",
  demo_started: "Demo iniciada", interest_updated: "Intereses marcados", registered: "Se registró", onboarding_task: "Tarea de onboarding creada", email_sent: "Correo enviado",
  waiter_called: "Llamó al garzón (demo)", loyalty_enrolled: "Se inscribió en la tarjeta (demo)", test_order: "Pedido de prueba", chapter_viewed: "Capítulo visto", link_opened: "El dueño abrió el link", status_changed: "Cambio de estado", note: "Nota",
};

// Ficha del lead (versión inicial; el CRM completo llega en la Etapa 8).
export default async function VentasLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const seller = (await getCurrentSeller())!;
  const lead = await getSellerLead(seller, id);
  if (!lead) notFound();
  const restaurant = await getLeadRestaurant(lead);
  const dishCount = restaurant ? await prisma.dish.count({ where: { restaurantId: restaurant.id, deletedAt: null } }) : 0;
  const events = await prisma.leadEvent.findMany({ where: { leadId: id }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, type: true, chapter: true, createdAt: true } });
  const reg = await prisma.leadRegistration.findUnique({ where: { leadId: id }, select: { sentTo: true, expiresAt: true, completedAt: true, remindedAt: true, createdAt: true } });
  const st = statusInfo(lead.crmStatus);
  const fmt = (d: Date) => d.toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" });

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 16 }}>
      <Link href="/ventas" style={{ color: "var(--ink-3)", fontSize: 14, textDecoration: "none" }}>← Inicio</Link>
      <div className="ventas-card" style={{ padding: 20, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {restaurant?.logoUrl && <img src={restaurant.logoUrl} alt="" style={{ width: 64, height: 64, objectFit: "contain", borderRadius: 16, background: "#fff", border: "1px solid var(--line)" }} />}
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{restaurant?.name ?? lead.localName}</h1>
          <div style={{ color: "var(--ink-3)", fontSize: 14, marginTop: 2 }}>{[lead.cuisine, lead.commune, lead.ownerName && `Contacto: ${lead.ownerName}`].filter(Boolean).join(" · ") || "Sin datos"}</div>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, padding: "5px 12px", borderRadius: 999, background: `${st.color}18`, color: st.color }}>{st.label}</span>
      </div>

      <div className="ventas-card" style={{ padding: 18, display: "grid", gap: 12 }}>
        {restaurant ? (
          <div style={{ fontSize: 15 }}>Carta lista: <b className="ventas-mono">{dishCount}</b> platos.</div>
        ) : lead.captureSource === "none" || lead.cartaStatus === "FAILED" ? (
          <div style={{ fontSize: 15, color: "var(--ink-2)" }}>Sin carta propia: la demo usará el local de ejemplo{lead.captureSource !== "none" ? " (no se pudo leer la carta)" : ""}.</div>
        ) : (
          <div style={{ fontSize: 15, color: "var(--ink-2)" }}>La carta se está armando… <Link href={`/ventas/${id}/armando`}>ver avance</Link></div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href={`/ventas/${id}/demo`} className="ventas-btn">▶ Abrir demo</Link>
          {restaurant?.isDemo && <Link href={`/ventas/${id}/revision`} className="ventas-btn ghost">🎨 Colores y carta</Link>}
          {restaurant && <a href={`/qr/${restaurant.slug}`} target="_blank" rel="noreferrer" className="ventas-btn ghost">Ver su carta QR ↗</a>}
        </div>
      </div>

      {reg && (
        <div className="ventas-card" style={{ padding: 18, display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 800 }}>Registro del dueño</div>
          {reg.completedAt ? (
            <div style={{ fontSize: 15, color: "#16a34a", fontWeight: 700 }}>✓ Registrado el {fmt(reg.completedAt)}</div>
          ) : reg.expiresAt < new Date() ? (
            <div style={{ fontSize: 15, color: "#dc2626" }}>El enlace venció el {fmt(reg.expiresAt)}. Abre la demo y usa “Aceptó” para enviar uno nuevo.</div>
          ) : (
            <div style={{ fontSize: 15, color: "var(--ink-2)" }}>
              Enlace enviado{reg.sentTo ? ` a ${reg.sentTo}` : ""} · vence el {fmt(reg.expiresAt)}{reg.remindedAt ? ` · recordatorio enviado el ${fmt(reg.remindedAt)}` : ""}.
              <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>Para reenviarlo: abre la demo → Cierre (C) → Aceptó.</div>
            </div>
          )}
        </div>
      )}

      <div className="ventas-card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Historial</div>
        {events.length === 0 ? <p style={{ margin: 0, color: "var(--ink-3)", fontSize: 14 }}>Sin actividad todavía.</p> : (
          <div style={{ display: "grid", gap: 8 }}>
            {events.map((e) => (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14 }}>
                <span>{EVENT_LABEL[e.type] ?? e.type}{e.chapter ? ` · ${e.chapter}` : ""}</span>
                <span className="ventas-mono" style={{ color: "var(--ink-3)", fontSize: 12, whiteSpace: "nowrap" }}>{fmt(e.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
