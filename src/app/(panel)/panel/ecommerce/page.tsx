"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Rocket, CreditCard, Wallet, Truck, Bike, ClipboardList, ShoppingBag, Settings, CheckCircle2, Circle, ChevronRight, Store, Map as MapIcon, Ticket, ConciergeBell } from "lucide-react";
import { useSessionContext } from "@/lib/admin/SessionContext";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#F4A623";

type Status = {
  enabled: boolean;
  integrations: { webpay: boolean; flow: boolean; uberDirect: boolean; pedidosya: boolean; googleMaps: boolean; pos: boolean };
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

      {/* Integraciones */}
      <h2 style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 700, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: 0.5, margin: "26px 0 12px" }}>
        Integraciones
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        <IntegrationCard icon={CreditCard} name="Webpay" kind="Pago online (Transbank)" ok={!!ints?.webpay} note={status ? (status.webpayEnv === "production" ? "producción" : "modo prueba") : undefined} />
        <IntegrationCard icon={Wallet} name="Flow" kind="Pago online (flow.cl)" ok={!!ints?.flow} />
        <IntegrationCard icon={Truck} name="Uber Direct" kind="Delivery con courier" ok={!!ints?.uberDirect} />
        <IntegrationCard icon={Bike} name="PedidosYa" kind="Delivery con courier" ok={!!ints?.pedidosya} />
        <IntegrationCard icon={MapIcon} name="Google Maps" kind="Direcciones y geocoding" ok={!!ints?.googleMaps} />
        <IntegrationCard icon={Store} name="POS" kind="Envío de pedidos al punto de venta" ok={!!ints?.pos} note={status ? POS_LABELS[status.posProvider] || status.posProvider : undefined} />
      </div>
      <p style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text3)", margin: "10px 2px 0", lineHeight: 1.5 }}>
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
