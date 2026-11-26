import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSeller } from "@/lib/ventas/session";
import { getSellerLead, getLeadRestaurant, leadContact } from "@/lib/ventas/leads";
import { statusInfo } from "@/lib/ventas/status";
import DeleteLead from "./DeleteLead";
import VisitResult from "./VisitResult";

export const dynamic = "force-dynamic";


// Ficha del lead (versión inicial; el CRM completo llega en la Etapa 8).
export default async function VentasLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const seller = (await getCurrentSeller())!;
  const lead = await getSellerLead(seller, id);
  if (!lead) notFound();
  const restaurant = await getLeadRestaurant(lead);
  const dishCount = restaurant ? await prisma.dish.count({ where: { restaurantId: restaurant.id, deletedAt: null } }) : 0;
  const reg = await prisma.leadRegistration.findUnique({ where: { leadId: id }, select: { sentTo: true, expiresAt: true, completedAt: true, remindedAt: true, createdAt: true } });
  const st = statusInfo(lead.crmStatus);
  const contact = leadContact(lead);
  const fmt = (d: Date) => d.toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" });

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 16 }}>
      <Link href="/ventas" style={{ color: "var(--ink-3)", fontSize: 14, textDecoration: "none" }}>← Inicio</Link>
      <div className="ventas-card" style={{ padding: 20, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {restaurant?.logoUrl && <img src={restaurant.logoUrl} alt="" style={{ width: 64, height: 64, objectFit: "contain", borderRadius: 16, background: "#fff", border: "1px solid var(--line)" }} />}
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{restaurant?.name ?? (lead.localName || "Local sin nombre")}</h1>
          <div style={{ color: "var(--ink-3)", fontSize: 14, marginTop: 2 }}>{[lead.cuisine, lead.commune, lead.ownerName && `Contacto: ${lead.ownerName}`].filter(Boolean).join(" · ") || "Sin datos"}</div>
          {(lead.whatsapp || contact.email || contact.address) && (
            <div style={{ color: "var(--ink-3)", fontSize: 13, marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
              {lead.whatsapp && <a href={`https://wa.me/${lead.whatsapp.replace(/\D/g, "").replace(/^(9\d{8})$/, "56$1")}`} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>📱 {lead.whatsapp}</a>}
              {contact.email && <a href={`mailto:${contact.email}`} style={{ color: "inherit" }}>✉️ {contact.email}</a>}
              {contact.address && <span>📍 {contact.address}</span>}
            </div>
          )}
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

      {!["registrado", "activo"].includes(lead.crmStatus || "") && !lead.convertedToOwnerId && (
        <div className="ventas-card" style={{ padding: 18, display: "grid", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800 }}>Resultado de la visita</div>
            <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 2 }}>Después de la demo, anota cómo terminó. “Aceptó” le envía el enlace de registro por correo y WhatsApp.</div>
          </div>
          <VisitResult leadId={id} color={restaurant?.cartaAccentColor && /^#[0-9a-fA-F]{6}$/.test(restaurant.cartaAccentColor) ? restaurant.cartaAccentColor : "#DE7C00"}
            email={contact.email} whatsapp={lead.whatsapp ?? ""} planId={lead.recommendedPlan ?? null} localName={restaurant?.name ?? (lead.localName || "este local")} />
        </div>
      )}

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

      {!lead.convertedToOwnerId && !["registrado", "activo"].includes(lead.crmStatus || "") && <DeleteLead id={id} name={restaurant?.name ?? (lead.localName || "este local")} />}
    </div>
  );
}
