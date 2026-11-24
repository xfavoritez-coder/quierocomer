"use client";

import type { StoreTenant, StoreCategory, StoreProduct } from "@/lib/ecommerce/storefront-data";
import type { DayHours } from "@/lib/ecommerce/hours";

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function BranchDetail({ tenant, categories, products }: { tenant: StoreTenant; categories: StoreCategory[]; products: StoreProduct[] }) {
  const fullName = tenant.branchName ? `${tenant.name} ${tenant.branchName}` : tenant.name;
  const accent = tenant.primaryColor || "#e63946";
  const heroProducts = products.filter(p => p.image_url && !p.is_sold_out).slice(0, 4);
  const storeUrl = tenant.customDomain ? `https://${tenant.customDomain}` : `/ecommerce/${tenant.slug}`;
  const mapsUrl = tenant.googleMapsUrl || (tenant.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tenant.address)}` : null);

  const today = (() => { try { return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" })).getDay(); } catch { return -1; } })();

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f5f7", fontFamily: "'Segoe UI',system-ui,-apple-system,sans-serif" }}>
      {/* Hero */}
      <div style={{ background: accent, padding: "32px 20px 24px", textAlign: "center", color: "#fff" }}>
        {tenant.logoUrl && (
          <img src={tenant.logoUrl} alt={fullName} style={{ width: 72, height: 72, borderRadius: 18, objectFit: "cover", border: "3px solid rgba(255,255,255,.25)", margin: "0 auto 14px", display: "block" }} />
        )}
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: "0 0 4px", letterSpacing: "-0.5px" }}>{fullName}</h1>
        {tenant.primaryCategory && <p style={{ fontSize: 13, opacity: 0.8, margin: 0, fontWeight: 600 }}>{tenant.primaryCategory}</p>}
        {/* Badges de modalidad */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          {tenant.deliveryEnabled && <Badge label="Delivery" icon="🛵" time={tenant.waitTimeDelivery} />}
          {tenant.pickupEnabled && <Badge label="Retiro" icon="🏃" time={tenant.waitTimePickup} />}
          {tenant.showTableMenu && <Badge label="Mesa" icon="🍽️" />}
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "20px 16px 40px" }}>
        {/* CTA */}
        <a href={storeUrl} style={{ display: "block", background: accent, color: "#fff", fontWeight: 800, fontSize: 16, textAlign: "center", padding: "14px 24px", borderRadius: 14, textDecoration: "none", marginBottom: 20, boxShadow: "0 4px 14px rgba(0,0,0,.12)" }}>
          Ver carta y pedir online →
        </a>

        {/* Fotos */}
        {heroProducts.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: heroProducts.length >= 3 ? "1fr 1fr 1fr" : `repeat(${heroProducts.length}, 1fr)`, gap: 8, marginBottom: 20, borderRadius: 14, overflow: "hidden" }}>
            {heroProducts.slice(0, 3).map(p => (
              <img key={p.id} src={p.image_url!} alt={p.name} style={{ width: "100%", aspectRatio: "1", objectFit: "cover" }} />
            ))}
          </div>
        )}

        {/* Info cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Dirección */}
          {tenant.address && (
            <InfoCard title="Dirección" icon="📍">
              <p style={{ fontSize: 14, color: "#333", margin: "0 0 8px", lineHeight: 1.5 }}>{tenant.address}</p>
              {mapsUrl && (
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 700, color: accent, textDecoration: "none" }}>
                  Ver en Google Maps →
                </a>
              )}
            </InfoCard>
          )}

          {/* Horarios */}
          {tenant.weeklyHours && (
            <InfoCard title="Horarios" icon="🕐">
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {tenant.weeklyHours.map((d: DayHours, i: number) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, fontWeight: i === today ? 800 : 500, color: i === today ? "#111" : "#666", padding: "3px 0", borderRadius: 6, background: i === today ? `${accent}10` : "transparent", paddingLeft: i === today ? 8 : 0, paddingRight: i === today ? 8 : 0 }}>
                    <span>{DAY_LABELS[i]}{i === today ? " (hoy)" : ""}</span>
                    <span style={{ color: d.open ? (i === today ? accent : "#333") : "#bbb" }}>
                      {d.open ? `${d.from} – ${d.to}` : "Cerrado"}
                    </span>
                  </div>
                ))}
              </div>
            </InfoCard>
          )}

          {/* Estado actual */}
          <InfoCard title="Estado" icon={tenant.openStatus.open ? "🟢" : "🔴"}>
            <p style={{ fontSize: 15, fontWeight: 700, color: tenant.openStatus.open ? "#16a34a" : "#dc2626", margin: 0 }}>
              {tenant.openStatus.open ? "Abierto ahora" : tenant.openStatus.opensAt ? `Cerrado · abre a las ${tenant.openStatus.opensAt}` : "Cerrado"}
            </p>
          </InfoCard>

          {/* Contacto */}
          {(tenant.whatsapp || tenant.phone || tenant.instagram) && (
            <InfoCard title="Contacto" icon="💬">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {tenant.whatsapp && (
                  <a href={`https://wa.me/${tenant.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: "#333", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>📱</span> WhatsApp: {tenant.whatsapp}
                  </a>
                )}
                {tenant.phone && tenant.phone !== tenant.whatsapp && (
                  <a href={`tel:${tenant.phone}`} style={{ fontSize: 14, color: "#333", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>📞</span> {tenant.phone}
                  </a>
                )}
                {tenant.instagram && (
                  <a href={`https://www.instagram.com/${tenant.instagram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: "#333", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>📸</span> @{tenant.instagram.replace(/^@/, "")}
                  </a>
                )}
              </div>
            </InfoCard>
          )}

          {/* Modalidades detalle */}
          <InfoCard title="Formas de pedir" icon="🛒">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {tenant.deliveryEnabled && (
                <div style={{ fontSize: 14, color: "#333" }}>
                  <strong>🛵 Delivery</strong>
                  {tenant.waitTimeDelivery && <span style={{ color: "#666" }}> · {tenant.waitTimeDelivery} min</span>}
                  {tenant.minOrderDelivery > 0 && <span style={{ color: "#666" }}> · mín. ${tenant.minOrderDelivery.toLocaleString("es-CL")}</span>}
                </div>
              )}
              {tenant.pickupEnabled && (
                <div style={{ fontSize: 14, color: "#333" }}>
                  <strong>🏃 Retiro en local</strong>
                  {tenant.waitTimePickup && <span style={{ color: "#666" }}> · {tenant.waitTimePickup} min</span>}
                  {tenant.minOrderPickup > 0 && <span style={{ color: "#666" }}> · mín. ${tenant.minOrderPickup.toLocaleString("es-CL")}</span>}
                </div>
              )}
              {tenant.showTableMenu && (
                <div style={{ fontSize: 14, color: "#333" }}>
                  <strong>🍽️ Pedido en mesa</strong>
                </div>
              )}
              {tenant.paymentMethods.length > 0 && (
                <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
                  Medios de pago: {tenant.paymentMethods.join(", ")}
                </div>
              )}
            </div>
          </InfoCard>

          {/* Categorías del menú */}
          {categories.length > 0 && (
            <InfoCard title={`Carta (${products.length} productos)`} icon="📋">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {categories.map(c => {
                  const count = products.filter(p => p.category_id === c.id).length;
                  return (
                    <a key={c.id} href={`${storeUrl}/tags/${encodeURIComponent(c.name.toLowerCase().replace(/\s+/g, "-"))}`} style={{ fontSize: 12.5, fontWeight: 600, padding: "5px 12px", borderRadius: 8, background: "#f0f0f2", color: "#444", textDecoration: "none" }}>
                      {c.name} ({count})
                    </a>
                  );
                })}
              </div>
            </InfoCard>
          )}
        </div>

        {/* Footer CTA */}
        <a href={storeUrl} style={{ display: "block", background: accent, color: "#fff", fontWeight: 800, fontSize: 16, textAlign: "center", padding: "14px 24px", borderRadius: 14, textDecoration: "none", marginTop: 20 }}>
          Pedir ahora →
        </a>

        <p style={{ textAlign: "center", fontSize: 11, color: "#aaa", marginTop: 16 }}>
          Powered by <a href="https://quierocomer.com" style={{ color: "#999", fontWeight: 700, textDecoration: "none" }}>QuieroComer</a>
        </p>
      </div>
    </div>
  );
}

function Badge({ label, icon, time }: { label: string; icon: string; time?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 12px", borderRadius: 20, background: "rgba(255,255,255,.18)", fontSize: 12.5, fontWeight: 700 }}>
      {icon} {label}{time ? ` · ${time} min` : ""}
    </span>
  );
}

function InfoCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #ececef", padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: "#111" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}
