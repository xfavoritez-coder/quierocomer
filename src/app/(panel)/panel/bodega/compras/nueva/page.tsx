"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useSessionContext } from "@/lib/admin/SessionContext";
import { F, FB, CompraHeaderForm } from "../_shared";

export default function NuevaCompraPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const router = useRouter();

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "8px 4px 96px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <button onClick={() => router.push("/panel/bodega/compras")} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text)", cursor: "pointer", flexShrink: 0 }}><ArrowLeft size={18} /></button>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Nueva compra</h1>
          <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>Datos del documento (factura, boleta o nota)</p>
        </div>
      </div>
      {restaurantId && (
        <CompraHeaderForm
          restaurantId={restaurantId}
          existing={null}
          onCreated={(c) => router.replace(`/panel/bodega/compras/${c.id}/insumos`)}
        />
      )}
    </div>
  );
}
