"use client";
import { Smartphone } from "lucide-react";
import { useSessionContext } from "@/lib/admin/SessionContext";

const F = "var(--font-display)";
const FB = "var(--font-body)";

/** Guard del módulo APP (notificaciones + KPIs de la app). Mismo gate que
 *  Ecommerce: solo locales con ecommerceEnabled (la app = storefront ecommerce). */
export default function AppModuleLayout({ children }: { children: React.ReactNode }) {
  const session = useSessionContext();
  const selected = session?.restaurants.find((r) => r.id === session.selectedRestaurantId);
  const enabled = !!(selected as any)?.appEnabled;

  if (!session || session.loading) {
    return <div style={{ padding: 40, textAlign: "center", fontFamily: FB, color: "var(--adm-text3)" }}>Cargando…</div>;
  }
  if (!enabled) {
    return (
      <div style={{ maxWidth: 520, margin: "60px auto", padding: "0 20px", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: "var(--adm-hover)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <Smartphone size={30} color="var(--adm-text3)" />
        </div>
        <h1 style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 10px" }}>APP no disponible</h1>
        <p style={{ fontFamily: FB, fontSize: "0.9rem", color: "var(--adm-text2)", lineHeight: 1.6, margin: 0 }}>Este módulo está en beta y aún no está habilitado para tu local. Contáctanos si quieres probarlo.</p>
      </div>
    );
  }
  return <>{children}</>;
}
