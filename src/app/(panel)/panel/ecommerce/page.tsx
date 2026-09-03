"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Rocket, CreditCard, Wallet, Truck, Bike, ClipboardList, ShoppingBag, Settings, CheckCircle2, Circle, ChevronRight, Store, Map as MapIcon, Ticket, ConciergeBell, ExternalLink, Clock, Save, Package } from "lucide-react";
import { toast } from "sonner";
import { useSessionContext } from "@/lib/admin/SessionContext";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#F4A623";

type Status = {
  enabled: boolean;
  integrations: { webpay: boolean; flow: boolean; mercadopago: boolean; uberDirect: boolean; pedidosya: boolean; googleMaps: boolean; pos: boolean };
  webpayEnv: string;
  posProvider: string;
};

const POS_LABELS: Record<string, string> = { toteat: "Toteat", none: "Sin seleccionar" };

const CARD: React.CSSProperties = {
  background: "var(--adm-card)",
  border: "1px solid var(--adm-card-border)",
  borderRadius: 16,
  padding: 18,
};

const GRID: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 };

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily: F, fontSize: "0.72rem", fontWeight: 700, color: "var(--adm-text2)", margin: "16px 2px 8px" }}>{children}</p>;
}

function IntegrationCard({ icon: Icon, name, kind, ok, note }: { icon: any; name: string; kind: string; ok: boolean; note?: string }) {
  return (
    <div style={{ ...CARD, display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--adm-hover)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={20} color="var(--adm-text2)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: F, fontSize: "0.92rem", fontWeight: 700, color: "var(--adm-text)" }}>{name}</div>
        <div style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}>{kind}{note ? ` · ${note}` : ""}</div>
      </div>
      {ok ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: FB, fontSize: "0.72rem", fontWeight: 600, color: "#22c55e" }}>
          <CheckCircle2 size={15} /> Configurada
        </span>
      ) : (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: FB, fontSize: "0.72rem", fontWeight: 600, color: "var(--adm-text3)" }}>
          <Circle size={13} /> Sin configurar
        </span>
      )}
    </div>
  );
}

// Tiempo de entrega estimado (retiro / delivery). Edita el store config completo
// para no pisar el resto de la configuración al guardar.
function WaitTimeCard({ restaurantId }: { restaurantId: string }) {
  const [cfg, setCfg] = useState<Record<string, unknown> | null>(null);
  const [pickup, setPickup] = useState("");
  const [delivery, setDelivery] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/panel/ecommerce/settings?restaurantId=${restaurantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.config) { setCfg(d.config); setPickup(String(d.config.waitTimePickup ?? "")); setDelivery(String(d.config.waitTimeDelivery ?? "")); } })
      .catch(() => {});
  }, [restaurantId]);

  async function save() {
    if (!cfg) return;
    setSaving(true);
    try {
      const next = { ...cfg, waitTimePickup: pickup.trim(), waitTimeDelivery: delivery.trim() };
      const res = await fetch("/api/panel/ecommerce/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, config: next }) });
      if (!res.ok) { toast.error("No se pudo guardar"); setSaving(false); return; }
      setCfg(next);
      toast.success("Tiempo de entrega guardado");
    } catch { toast.error("Error de conexión"); }
    setSaving(false);
  }

  const field = (icon: React.ReactNode, label: string, value: string, onChange: (v: string) => void) => (
    <div style={{ flex: 1, minWidth: 150 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: F, fontSize: "0.74rem", fontWeight: 700, color: "var(--adm-text2)", marginBottom: 5 }}>{icon} {label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="ej: 20-30" style={{ flex: 1, minWidth: 0, padding: "8px 10px", background: "var(--adm-input, var(--adm-card))", border: "1px solid var(--adm-input-border, var(--adm-card-border))", borderRadius: 8, color: "var(--adm-text)", fontFamily: FB, fontSize: "0.84rem", outline: "none" }} />
        <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)" }}>min</span>
      </div>
    </div>
  );

  return (
    <div style={{ ...CARD, marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <Clock size={18} color={ACCENT} style={{ marginTop: 2, flexShrink: 0 }} />
        <div>
          <h2 style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Tiempo de entrega estimado</h2>
          <p style={{ fontFamily: FB, fontSize: "0.76rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>Lo que ve el cliente al pedir. Puedes usar un rango (ej: 20-30).</p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
        {field(<Package size={13} />, "Retiro", pickup, setPickup)}
        {field(<Bike size={13} />, "Delivery", delivery, setDelivery)}
      </div>
      <button onClick={save} disabled={saving || !cfg} style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", background: ACCENT, border: "none", borderRadius: 10, color: "#1a1a1a", fontFamily: F, fontSize: "0.83rem", fontWeight: 800, cursor: saving || !cfg ? "wait" : "pointer", opacity: saving || !cfg ? 0.6 : 1 }}>
        <Save size={15} /> {saving ? "Guardando…" : "Guardar tiempo"}
      </button>
    </div>
  );
}

function QuickLink({ href, icon: Icon, label, desc }: { href: string; icon: any; label: string; desc: string }) {
  return (
    <Link href={href} style={{ ...CARD, display: "flex", alignItems: "center", gap: 14, textDecoration: "none" }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--adm-hover)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={20} color={ACCENT} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: F, fontSize: "0.92rem", fontWeight: 700, color: "var(--adm-text)" }}>{label}</div>
        <div style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}>{desc}</div>
      </div>
      <ChevronRight size={18} color="var(--adm-text3)" />
    </Link>
  );
}

export default function EcommerceHomePage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const slug = session?.restaurants.find((r) => r.id === restaurantId)?.slug || null;
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    fetch(`/api/panel/ecommerce/status?restaurantId=${restaurantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStatus(d))
      .catch(() => {});
  }, [restaurantId]);

  const ints = status?.integrations;

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "8px 4px 40px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: `${ACCENT}1a`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Rocket size={22} color={ACCENT} />
        </div>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.4rem", fontWeight: 800, color: "var(--adm-text)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            Ecommerce
            <span style={{ fontFamily: FB, fontSize: "0.62rem", fontWeight: 700, color: ACCENT, background: `${ACCENT}22`, padding: "2px 8px", borderRadius: 999 }}>BETA</span>
          </h1>
          <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>
            Tu tienda online con pago real, delivery y punto de venta.
          </p>
        </div>
      </div>

      {/* Acceso a la tienda pública */}
      {slug && (
        <a href={`/ecommerce/${slug}`} target="_blank" rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 20, padding: 16, borderRadius: 16, textDecoration: "none", background: `${ACCENT}14`, border: `1px solid ${ACCENT}55` }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Store size={20} color="#1a1a1a" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 800, color: "var(--adm-text)" }}>Ver mi tienda online</div>
            <div style={{ fontFamily: FB, fontSize: "0.76rem", color: "var(--adm-text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>quierocomer.com/ecommerce/{slug}</div>
          </div>
          <ExternalLink size={18} color={ACCENT} style={{ flexShrink: 0 }} />
        </a>
      )}

      {/* Tiempo de entrega estimado */}
      {restaurantId && <WaitTimeCard restaurantId={restaurantId} />}

      {/* Integraciones */}
      <h2 style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 700, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: 0.5, margin: "26px 0 12px" }}>
        Integraciones
      </h2>

      <GroupLabel>Medios de pago</GroupLabel>
      <div style={GRID}>
        <IntegrationCard icon={CreditCard} name="Webpay" kind="Pago online (Transbank)" ok={!!ints?.webpay} note={status ? (status.webpayEnv === "production" ? "producción" : "modo prueba") : undefined} />
        <IntegrationCard icon={Wallet} name="Flow" kind="Pago online (flow.cl)" ok={!!ints?.flow} />
        <IntegrationCard icon={Wallet} name="MercadoPago" kind="Pago online (Checkout Pro)" ok={!!ints?.mercadopago} />
      </div>

      <GroupLabel>Delivery</GroupLabel>
      <div style={GRID}>
        <IntegrationCard icon={Bike} name="PedidosYa" kind="Delivery con courier" ok={!!ints?.pedidosya} />
        <IntegrationCard icon={Truck} name="Uber Direct" kind="Delivery con courier" ok={!!ints?.uberDirect} />
      </div>

      <GroupLabel>Configuración base</GroupLabel>
      <div style={GRID}>
        <IntegrationCard icon={MapIcon} name="Google Maps" kind="Direcciones y geocoding" ok={!!ints?.googleMaps} />
        <IntegrationCard icon={Store} name="POS" kind="Envío de pedidos al punto de venta" ok={!!ints?.pos} note={status ? POS_LABELS[status.posProvider] || status.posProvider : undefined} />
      </div>
      <p style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text3)", margin: "12px 2px 0", lineHeight: 1.5 }}>
        Las credenciales las configura el equipo de QuieroComer. Escríbenos para activar una pasarela o courier en tu local.
      </p>

      {/* Accesos */}
      <h2 style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 700, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: 0.5, margin: "28px 0 12px" }}>
        Gestión
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        <QuickLink href="/panel/ecommerce/tomar-pedidos" icon={ConciergeBell} label="Tomar pedidos" desc="Registra pedidos de mostrador / teléfono" />
        <QuickLink href="/panel/ecommerce/pedidos" icon={ClipboardList} label="Pedidos" desc="Recibe y gestiona pedidos online" />
        <QuickLink href="/panel/ecommerce/carta" icon={ShoppingBag} label="Catálogo" desc="Qué productos vender online" />
        <QuickLink href="/panel/ecommerce/cupones" icon={Ticket} label="Cupones" desc="Códigos de descuento" />
        <QuickLink href="/panel/ecommerce/configuracion" icon={Settings} label="Configuración" desc="Ajustes, delivery, horario y acompañamientos" />
      </div>
    </div>
  );
}
