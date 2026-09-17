"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Receipt, Plus, ChevronRight } from "lucide-react";
import { useSessionContext } from "@/lib/admin/SessionContext";
import { clp } from "@/lib/bodega/labels";
import { F, FB, ACCENT, TIPO_DOC, ESTADO_PAGO, type Compra } from "./_shared";

export default function ComprasPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const router = useRouter();
  const [compras, setCompras] = useState<Compra[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    fetch(`/api/panel/bodega/compras?restaurantId=${restaurantId}`)
      .then((r) => r.ok ? r.json() : null).then((d) => { if (d?.compras) setCompras(d.compras); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [restaurantId]);

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "8px 4px 96px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(45,212,191,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}><Receipt size={22} color={ACCENT} /></div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: F, fontSize: "1.35rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Compras</h1>
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>{compras.length} documento{compras.length === 1 ? "" : "s"} registrado{compras.length === 1 ? "" : "s"}</p>
        </div>
        <button onClick={() => router.push("/panel/bodega/compras/nueva")} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 15px", borderRadius: 11, border: "none", background: ACCENT, color: "#0b3b36", fontFamily: F, fontSize: "0.86rem", fontWeight: 800, cursor: "pointer" }}>
          <Plus size={17} /> Registrar compra
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 50, textAlign: "center", fontFamily: FB, color: "var(--adm-text3)" }}>Cargando compras…</div>
      ) : compras.length === 0 ? (
        <div style={{ maxWidth: 420, margin: "40px auto", textAlign: "center" }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: "var(--adm-hover)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><Receipt size={28} color="var(--adm-text3)" /></div>
          <p style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 6px" }}>Aún no hay compras</p>
          <p style={{ fontFamily: FB, fontSize: "0.86rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>Registra una factura, boleta o nota de venta con el botón <strong>Registrar compra</strong>.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {compras.map((c) => (
            <button key={c.id} onClick={() => router.push(`/panel/bodega/compras/${c.id}`)} style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: 14, cursor: "pointer" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)" }}>{c.proveedorNombre || "Sin proveedor"}</span>
                  <span style={{ fontFamily: FB, fontSize: "0.66rem", fontWeight: 700, color: c.estadoPago === "pagada" ? "#16a34a" : "#f59e0b", background: c.estadoPago === "pagada" ? "rgba(22,163,74,0.14)" : "rgba(245,158,11,0.14)", padding: "1px 7px", borderRadius: 999 }}>{ESTADO_PAGO[c.estadoPago || ""] || "—"}</span>
                </div>
                <p style={{ fontFamily: FB, fontSize: "0.76rem", color: "var(--adm-text2)", margin: 0 }}>{TIPO_DOC[c.documentoTipo || ""] || "Doc"} {c.documentoFolio || ""} · {new Date(c.fecha).toLocaleDateString("es-CL")} · {c._count.lineas} insumo{c._count.lineas === 1 ? "" : "s"}</p>
              </div>
              <span style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 800, color: "var(--adm-text)" }}>{c.totalDeclarado != null ? clp(c.totalDeclarado) : "—"}</span>
              <ChevronRight size={18} color="var(--adm-text3)" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
