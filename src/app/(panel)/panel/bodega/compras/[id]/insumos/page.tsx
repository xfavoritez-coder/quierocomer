"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useSessionContext } from "@/lib/admin/SessionContext";
import { clp } from "@/lib/bodega/labels";
import { F, FB, ACCENT, btnPrimary, LineasEditor, type Compra } from "../../_shared";

export default function InsumosCompraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const router = useRouter();
  const [compra, setCompra] = useState<Compra | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    fetch(`/api/panel/bodega/compras/${id}?restaurantId=${restaurantId}`)
      .then((r) => r.ok ? r.json() : null).then((d) => { if (d?.compra) setCompra(d.compra); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [restaurantId, id]);

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "8px 4px 96px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <button onClick={() => router.push(`/panel/bodega/compras/${id}`)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text)", cursor: "pointer", flexShrink: 0 }}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Insumos de la factura</h1>
          <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>
            {compra?.proveedorNombre || ""}{compra?.totalDeclarado != null ? ` · Total ${clp(compra.totalDeclarado)}` : ""}
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 50, textAlign: "center", fontFamily: FB, color: "var(--adm-text3)" }}>Cargando…</div>
      ) : restaurantId ? (
        <>
          <LineasEditor restaurantId={restaurantId} compraId={id} totalDoc={compra?.totalDeclarado ?? null} />
          <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "12px 0", textAlign: "center" }}>Cada insumo agregado suma su stock y actualiza su último precio.</p>
          <button onClick={() => router.push("/panel/bodega/compras")} style={btnPrimary}>Listo</button>
        </>
      ) : null}
    </div>
  );
}
