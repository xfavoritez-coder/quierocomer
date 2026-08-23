"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Settings, Save, Palette, CreditCard, StickyNote, ConciergeBell, Truck, Clock, UtensilsCrossed, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useSessionContext } from "@/lib/admin/SessionContext";
import { parseStoreConfig, type EcommerceStoreConfig } from "@/lib/ecommerce/store-config";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#F4A623";

const PAY_LABELS: Record<string, { label: string; hint: string }> = {
  webpay: { label: "Webpay", hint: "Pago online con tarjeta" },
  efectivo: { label: "Efectivo", hint: "Paga al recibir/retirar" },
  transferencia: { label: "Transferencia", hint: "Coordina la transferencia" },
  tarjeta: { label: "Tarjeta", hint: "Con tarjeta al recibir" },
};

export default function EcommerceConfiguracionPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const [cfg, setCfg] = useState<EcommerceStoreConfig>(() => parseStoreConfig(null));
  const [allMethods, setAllMethods] = useState<string[]>(["webpay", "efectivo", "transferencia", "tarjeta"]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    fetch(`/api/panel/ecommerce/settings?restaurantId=${restaurantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setCfg(d.config); if (d.allMethods) setAllMethods(d.allMethods); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [restaurantId]);

  const patch = (p: Partial<EcommerceStoreConfig>) => setCfg((c) => ({ ...c, ...p }));
  const togglePay = (m: string) => setCfg((c) => ({ ...c, paymentMethods: c.paymentMethods.includes(m) ? c.paymentMethods.filter((x) => x !== m) : [...c.paymentMethods, m] }));

  async function save() {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/panel/ecommerce/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, config: cfg }) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Error al guardar"); setSaving(false); return; }
      setCfg(data.config);
      toast.success("Configuración guardada");
    } catch { toast.error("Error de conexión"); }
    setSaving(false);
  }

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "8px 4px 40px" }}>
      <Link href="/panel/ecommerce" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", textDecoration: "none", marginBottom: 18 }}>
        <ArrowLeft size={15} /> Ecommerce
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${ACCENT}1a`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Settings size={20} color={ACCENT} />
        </div>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Configuración de la tienda</h1>
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>Colores de marca, métodos de pago y opciones del checkout.</p>
        </div>
      </div>

      {loading ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)", marginTop: 24 }}>Cargando…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 20 }}>
          {/* Colores de marca */}
          <section style={card}>
            <SectionTitle icon={Palette} title="Colores de marca" sub="Se aplican en tu tienda online (botones, precios, header y categorías)." />
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
              <ColorField label="Color principal" value={cfg.primaryColor} onChange={(v) => patch({ primaryColor: v })} />
              <ColorField label="Color del header (fondo del logo)" value={cfg.headerBgColor} onChange={(v) => patch({ headerBgColor: v })} />
              <ColorField label="Color de las categorías" value={cfg.categoryColor} onChange={(v) => patch({ categoryColor: v })} />
            </div>
            {/* Preview */}
            <div style={{ marginTop: 14, borderRadius: 12, overflow: "hidden", border: "1px solid var(--adm-card-border)" }}>
              <div style={{ background: cfg.headerBgColor, padding: "10px 14px", fontFamily: F, fontWeight: 900, color: "#111" }}>Tu Local</div>
              <div style={{ padding: "12px 14px", background: "#f7f7f8" }}>
                <p style={{ fontFamily: F, fontSize: "0.72rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: 1, color: cfg.categoryColor, margin: "0 0 6px" }}>Aperitivos</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", borderRadius: 10, padding: "8px 10px", border: "1px solid #eee" }}>
                  <span style={{ fontFamily: FB, fontSize: "0.8rem", color: "#111", fontWeight: 700 }}>Gyozas</span>
                  <span style={{ fontFamily: FB, fontSize: "0.8rem", fontWeight: 900, color: cfg.primaryColor }}>$5.900</span>
                </div>
                <button style={{ marginTop: 8, width: "100%", padding: "8px", borderRadius: 10, border: "none", background: cfg.primaryColor, color: "#fff", fontFamily: F, fontWeight: 800, fontSize: "0.8rem" }}>Continuar con mi pedido →</button>
              </div>
            </div>
          </section>

          {/* Métodos de pago */}
          <section style={card}>
            <SectionTitle icon={CreditCard} title="Métodos de pago" sub="Elige qué medios de pago ve el cliente en el checkout." />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              {allMethods.map((m) => {
                const meta = PAY_LABELS[m] || { label: m, hint: "" };
                const on = cfg.paymentMethods.includes(m);
                return (
                  <div key={m} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 12, background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)" }}>
                    <div>
                      <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>{meta.label}</p>
                      <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "1px 0 0" }}>{meta.hint}</p>
                    </div>
                    <Toggle on={on} onClick={() => togglePay(m)} />
                  </div>
                );
              })}
              {cfg.paymentMethods.length === 0 && <p style={{ fontFamily: FB, fontSize: "0.76rem", color: "#ef4444", margin: 0 }}>Debes dejar al menos un método de pago activo.</p>}
            </div>
          </section>

          {/* Notas */}
          <section style={card}>
            <SectionTitle icon={StickyNote} title="Notas del cliente" sub="Campo opcional en el checkout para instrucciones (ej: sin cebolla)." />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
              <span style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text2)" }}>Recibir notas del cliente</span>
              <Toggle on={cfg.notesEnabled} onClick={() => patch({ notesEnabled: !cfg.notesEnabled })} />
            </div>
          </section>

          {/* Tomar pedidos */}
          <section style={card}>
            <SectionTitle icon={ConciergeBell} title="Tomar pedidos" sub="Ajustes de la pantalla de mostrador (Tomar pedidos)." />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
              <span style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text2)" }}>Mostrar descripción de los productos</span>
              <Toggle on={cfg.posShowDescriptions} onClick={() => patch({ posShowDescriptions: !cfg.posShowDescriptions })} />
            </div>
          </section>

          {/* Más ajustes de la tienda (páginas propias) */}
          <section style={card}>
            <SectionTitle icon={Settings} title="Más ajustes de la tienda" sub="Delivery, horario de apertura y acompañamientos." />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              <NavRow href="/panel/ecommerce/delivery" icon={Truck} title="Delivery" desc="Zonas de reparto y despacho" />
              <NavRow href="/panel/ecommerce/horario" icon={Clock} title="Horario" desc="Cuándo la tienda está abierta" />
              <NavRow href="/panel/ecommerce/acompanamientos" icon={UtensilsCrossed} title="Acompañamientos" desc="Palitos, salsas y extras del checkout" />
            </div>
          </section>

          <button onClick={save} disabled={saving || cfg.paymentMethods.length === 0} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, padding: "11px 20px", background: ACCENT, border: "none", borderRadius: 10, color: "#1a1a1a", fontFamily: F, fontSize: "0.85rem", fontWeight: 800, cursor: saving ? "wait" : "pointer", opacity: saving || cfg.paymentMethods.length === 0 ? 0.5 : 1 }}>
            <Save size={16} /> {saving ? "Guardando…" : "Guardar configuración"}
          </button>
        </div>
      )}
    </div>
  );
}

const card: React.CSSProperties = { background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: 18 };

function SectionTitle({ icon: Icon, title, sub }: { icon: any; title: string; sub: string }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <Icon size={18} color={ACCENT} style={{ marginTop: 2, flexShrink: 0 }} />
      <div>
        <h2 style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>{title}</h2>
        <p style={{ fontFamily: FB, fontSize: "0.76rem", color: "var(--adm-text3)", margin: "2px 0 0", lineHeight: 1.4 }}>{sub}</p>
      </div>
    </div>
  );
}

function NavRow({ href, icon: Icon, title, desc }: { href: string; icon: any; title: string; desc: string }) {
  return (
    <Link href={href} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "var(--adm-hover)", textDecoration: "none" }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--adm-card)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={17} color={ACCENT} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 700, color: "var(--adm-text)" }}>{title}</div>
        <div style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}>{desc}</div>
      </div>
      <ChevronRight size={18} color="var(--adm-text3)" />
    </Link>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 42, height: 38, borderRadius: 9, border: "1px solid var(--adm-card-border)", background: "transparent", cursor: "pointer", padding: 2, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <label style={{ fontFamily: FB, fontSize: "0.7rem", fontWeight: 700, color: "var(--adm-text3)", display: "block", marginBottom: 3 }}>{label}</label>
        <input value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", padding: "7px 10px", background: "var(--adm-input, var(--adm-card))", border: "1px solid var(--adm-input-border, var(--adm-card-border))", borderRadius: 8, color: "var(--adm-text)", fontFamily: "monospace", fontSize: "0.82rem", outline: "none" }} />
      </div>
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: 46, height: 26, borderRadius: 13, border: "none", cursor: "pointer", position: "relative", background: on ? "#22c55e" : "var(--adm-toggle-off, #ccc)", transition: "background .2s", flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
    </button>
  );
}
