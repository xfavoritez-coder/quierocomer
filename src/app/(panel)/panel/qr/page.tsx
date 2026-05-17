"use client";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import QRGeneratorModal from "@/components/admin/QRGeneratorModal";
import { QrCode, ArrowLeft } from "lucide-react";
import Link from "next/link";
import SkeletonLoading from "@/components/admin/SkeletonLoading";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

export default function PanelQRPage() {
  const { restaurants, selectedRestaurantId, loading } = useAdminSession();

  if (loading) return <SkeletonLoading type="form" />;

  const restaurant = restaurants.find(r => r.id === selectedRestaurantId);
  if (!restaurant) return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "var(--adm-text2)", fontFamily: F }}>Selecciona un restaurant</p></div>;

  const qrPageLink = `https://quierocomer.cl/qr/generar/${restaurant.slug}`;

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
        <QrCode size={20} color="var(--adm-text3)" /> Código QR
      </h1>
      <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 24px" }}>
        Genera e imprime tu código QR para las mesas de {restaurant.name}.
      </p>

      {/* Card principal */}
      <div style={{
        position: "relative", overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.08)", borderRadius: 28,
        padding: "32px 24px", textAlign: "center", marginBottom: 20,
        background: "linear-gradient(135deg, rgba(255,173,24,0.10), rgba(255,173,24,0.02) 46%, rgba(255,255,255,0.02)), var(--adm-card)",
      }}>
        <div style={{ position: "absolute", width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,173,24,0.15), transparent 62%)", right: -60, top: -50, filter: "blur(2px)" }} />
        <div style={{ width: 64, height: 64, borderRadius: 20, background: "rgba(244,166,35,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", position: "relative", zIndex: 1 }}>
          <QrCode size={32} color={GOLD} />
        </div>
        <h2 style={{ fontFamily: F, fontSize: "1.1rem", fontWeight: 800, color: "var(--adm-text)", margin: "0 0 8px", position: "relative", zIndex: 1 }}>Imprime tu QR para las mesas</h2>
        <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "0 0 24px", lineHeight: 1.5, position: "relative", zIndex: 1 }}>
          Tus clientes escanean este código y acceden a tu carta digital.
        </p>
        <a href={qrPageLink} target="_blank" rel="noopener noreferrer" style={{
          display: "inline-block", padding: "14px 32px", background: GOLD, color: "#0a0a0a",
          border: "none", borderRadius: 50, fontFamily: F, fontSize: "0.92rem", fontWeight: 700,
          textDecoration: "none", boxShadow: "0 4px 14px rgba(244,166,35,0.25)", position: "relative", zIndex: 1,
        }}>
          Generar e imprimir QR
        </a>
      </div>

    </div>
  );
}
