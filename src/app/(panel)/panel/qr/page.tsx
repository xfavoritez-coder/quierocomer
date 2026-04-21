"use client";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import QRGeneratorModal from "@/components/admin/QRGeneratorModal";
import { QrCode, ArrowLeft } from "lucide-react";
import Link from "next/link";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

export default function PanelQRPage() {
  const { restaurants, selectedRestaurantId, loading } = useAdminSession();

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: GOLD, fontFamily: F }}>🧞 Cargando...</p></div>;

  const restaurant = restaurants.find(r => r.id === selectedRestaurantId);
  if (!restaurant) return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "var(--adm-text2)", fontFamily: F }}>Selecciona un restaurant</p></div>;

  const qrPageLink = `https://quierocomer.cl/qr/generar/${restaurant.slug}`;

  return (
    <div style={{ maxWidth: 480 }}>
      <Link href="/panel" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", color: "var(--adm-text2)", fontFamily: FB, fontSize: "0.78rem", marginBottom: 12 }}>
        <ArrowLeft size={16} /> Volver al inicio
      </Link>
      <h1 style={{ fontFamily: F, fontSize: "1.3rem", color: "var(--adm-text)", margin: "0 0 8px" }}>Código QR</h1>
      <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text2)", margin: "0 0 24px", lineHeight: 1.5 }}>
        Genera e imprime tu código QR para las mesas de <strong>{restaurant.name}</strong>.
      </p>

      {/* Card principal */}
      <div style={{ background: "linear-gradient(135deg, #FFF4E0, #FDEFC7)", border: "1px solid #E8D0A0", borderRadius: 16, padding: "32px 24px", textAlign: "center", marginBottom: 20 }}>
        <QrCode size={48} color={GOLD} style={{ marginBottom: 12, display: "block", marginLeft: "auto", marginRight: "auto" }} />
        <h2 style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "#1a1a1a", margin: "0 0 8px" }}>Imprime tu QR para las mesas</h2>
        <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "#8a7550", margin: "0 0 20px", lineHeight: 1.5 }}>
          Tus clientes escanean este código y acceden a tu carta digital. Elige el tamaño y la cantidad que necesites.
        </p>
        <a href={qrPageLink} target="_blank" rel="noopener noreferrer" style={{
          display: "inline-block", padding: "14px 32px", background: GOLD, color: "white",
          border: "none", borderRadius: 50, fontFamily: F, fontSize: "0.92rem", fontWeight: 700,
          textDecoration: "none", boxShadow: "0 4px 14px rgba(244,166,35,0.25)",
        }}>
          Generar e imprimir QR
        </a>
      </div>

      {/* Info */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "16px 20px", boxShadow: "var(--adm-card-shadow, none)" }}>
        <p style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 8px" }}>Consejos para imprimir</p>
        <ul style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          <li>Usa papel grueso o cartulina para mayor durabilidad</li>
          <li>El tamaño mediano (8×8 cm) es ideal para mesas</li>
          <li>Plastifica los QR si estarán expuestos al aire libre</li>
          <li>Prueba escanearlo antes de pegar en las mesas</li>
        </ul>
      </div>
    </div>
  );
}
