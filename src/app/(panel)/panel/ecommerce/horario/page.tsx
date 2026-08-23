"use client";
import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { useSessionContext } from "@/lib/admin/SessionContext";
import HorarioEditor from "@/components/ecommerce/HorarioEditor";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#F4A623";

export default function HoursPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "8px 4px 40px" }}>
      <Link href="/panel/ecommerce/configuracion" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", textDecoration: "none", marginBottom: 18 }}>
        <ArrowLeft size={15} /> Configuración
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${ACCENT}1a`, display: "flex", alignItems: "center", justifyContent: "center" }}><Clock size={20} color={ACCENT} /></div>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Horario de atención</h1>
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>Fuera de horario, la tienda aparece cerrada y no se pueden hacer pedidos.</p>
        </div>
      </div>

      <HorarioEditor restaurantId={restaurantId} />
    </div>
  );
}
