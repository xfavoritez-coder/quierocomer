"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, PackagePlus } from "lucide-react";
import { useSessionContext } from "@/lib/admin/SessionContext";
import { F, FB, ACCENT, CompraHeaderForm, type Compra } from "../_shared";

export default function EditarCompraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const router = useRouter();
  const [compra, setCompra] = useState<Compra | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    fetch(`/api/panel/bodega/compras/${id}?restaurantId=${restaurantId}`)
      .then((r) => r.ok ? r.json() : null).then((d) => { if (d?.compra) setCompra(d.compra); else setNotFound(true); })
      .catch(() => setNotFound(true)).finally(() => setLoading(false));
  }, [restaurantId, id]);

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "8px 4px 96px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <button onClick={() => router.push("/panel/bodega/compras")} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text)", cursor: "pointer", flexShrink: 0 }}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>{compra?.proveedorNombre || "Factura"}</h1>
          <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>Editar datos de la factura</p>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 50, textAlign: "center", fontFamily: FB, color: "var(--adm-text3)" }}>Cargando…</div>
      ) : notFound || !compra ? (
        <div style={{ padding: 40, textAlign: "center", fontFamily: FB, color: "var(--adm-text2)" }}>No se encontró la factura.</div>
      ) : restaurantId ? (
        <>
          {/* Acceso a insumos */}
          <button onClick={() => router.push(`/panel/bodega/compras/${id}/insumos`)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: "rgba(45,212,191,0.08)", border: "1px solid rgba(45,212,191,0.3)", borderRadius: 12, padding: "13px 14px", cursor: "pointer", marginBottom: 16 }}>
            <PackagePlus size={20} color={ACCENT} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Insumos de la factura</p>
              <p style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text2)", margin: 0 }}>{compra._count.lineas} insumo{compra._count.lineas === 1 ? "" : "s"} · toca para ingresar o agregar más</p>
            </div>
            <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 800, color: ACCENT }}>Ingresar →</span>
          </button>

          <CompraHeaderForm restaurantId={restaurantId} existing={compra} onSaved={(c) => setCompra(c)} />
        </>
      ) : null}
    </div>
  );
}
