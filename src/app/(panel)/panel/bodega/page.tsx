"use client";
import { Warehouse, Boxes, ClipboardList, TrendingDown } from "lucide-react";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#2dd4bf"; // teal del pilar Bodega

const CARD: React.CSSProperties = {
  background: "var(--adm-card)",
  border: "1px solid var(--adm-card-border)",
  borderRadius: 16,
  padding: 18,
};

function FeatureCard({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div style={{ ...CARD, display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(45,212,191,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={20} color={ACCENT} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)", margin: "2px 0 4px" }}>{title}</p>
        <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>{desc}</p>
      </div>
    </div>
  );
}

export default function BodegaHome() {
  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "8px 4px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(45,212,191,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Warehouse size={24} color={ACCENT} />
        </div>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.4rem", fontWeight: 800, color: "var(--adm-text)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            Bodega
            <span style={{ fontSize: "0.6rem", fontWeight: 800, color: ACCENT, background: "rgba(45,212,191,0.18)", padding: "2px 8px", borderRadius: 999 }}>BETA</span>
          </h1>
          <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>
            Controla tus insumos, stock y mermas en un solo lugar.
          </p>
        </div>
      </div>

      <div style={{ ...CARD, marginTop: 18, background: "rgba(45,212,191,0.05)", borderColor: "rgba(45,212,191,0.28)" }}>
        <p style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 6px" }}>Módulo en construcción</p>
        <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.6 }}>
          Estamos empezando a construir Bodega. Aquí vas a poder llevar el inventario de tus insumos,
          registrar compras, descontar stock automáticamente con cada venta y ver alertas de bajo stock.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginTop: 16 }}>
        <FeatureCard icon={Boxes} title="Insumos y stock" desc="Lista de insumos con su stock actual, unidad de medida y costo." />
        <FeatureCard icon={ClipboardList} title="Compras y entradas" desc="Registra compras a proveedores y suma stock a la bodega." />
        <FeatureCard icon={TrendingDown} title="Mermas y salidas" desc="Descuenta stock por consumo, mermas o ajustes de inventario." />
      </div>
    </div>
  );
}
