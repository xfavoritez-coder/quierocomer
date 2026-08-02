"use client";
import { useState, useEffect, useCallback } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { Users, Download } from "lucide-react";
import SkeletonLoading from "@/components/admin/SkeletonLoading";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  orderType: string;
  paymentMethod: string;
  total: number;
  createdAt: string;
}

interface Client {
  phone: string;
  name: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string;
  orderTypes: string[];
  paymentMethods: string[];
}

function buildClients(orders: Order[]): Client[] {
  const map = new Map<string, Client>();
  for (const o of orders) {
    const key = o.customerPhone;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        phone: o.customerPhone,
        name: o.customerName,
        orderCount: 1,
        totalSpent: o.total,
        lastOrderAt: o.createdAt,
        orderTypes: [o.orderType],
        paymentMethods: [o.paymentMethod],
      });
    } else {
      existing.orderCount++;
      existing.totalSpent += o.total;
      if (new Date(o.createdAt) > new Date(existing.lastOrderAt)) {
        existing.lastOrderAt = o.createdAt;
        existing.name = o.customerName; // keep most recent name
      }
      if (!existing.orderTypes.includes(o.orderType)) existing.orderTypes.push(o.orderType);
      if (!existing.paymentMethods.includes(o.paymentMethod)) existing.paymentMethods.push(o.paymentMethod);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.orderCount - a.orderCount);
}

function exportCSV(clients: Client[]) {
  const header = ["Teléfono", "Nombre", "Pedidos", "Total gastado", "Último pedido", "Tipo", "Pago"];
  const rows = clients.map(c => [
    c.phone,
    c.name,
    c.orderCount,
    c.totalSpent,
    new Date(c.lastOrderAt).toLocaleDateString("es-CL"),
    c.orderTypes.join("/"),
    c.paymentMethods.join("/"),
  ]);
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `clientes-pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ClientesPage() {
  const { selectedRestaurantId } = useAdminSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    if (!selectedRestaurantId) return;
    setLoading(true);
    fetch(`/api/panel/orders?restaurantId=${selectedRestaurantId}`)
      .then(r => r.json())
      .then(d => setOrders(d.orders || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedRestaurantId]);

  useEffect(() => { load(); }, [load]);

  const clients = buildClients(orders);
  const filtered = search.trim()
    ? clients.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search)
      )
    : clients;

  if (loading) return <SkeletonLoading />;

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={20} color={GOLD} />
            <h2 style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>
              Clientes
            </h2>
          </div>
          {clients.length > 0 && (
            <button
              type="button"
              onClick={() => exportCSV(clients)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
                border: "1px solid var(--adm-card-border)", borderRadius: 8,
                background: "var(--adm-card)", color: "var(--adm-text2)",
                fontFamily: F, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
              }}
            >
              <Download size={14} /> Exportar CSV
            </button>
          )}
        </div>
        <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "4px 0 0" }}>
          {clients.length} cliente{clients.length !== 1 ? "s" : ""} únicos · {orders.length} pedidos en total
        </p>
      </div>

      {/* Search */}
      {clients.length > 0 && (
        <input
          type="text"
          placeholder="Buscar por nombre o teléfono…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: "100%", padding: "10px 14px", boxSizing: "border-box", marginBottom: 16,
            background: "var(--adm-card)", border: "1px solid var(--adm-card-border)",
            borderRadius: 8, color: "var(--adm-text)", fontFamily: FB, fontSize: "0.85rem", outline: "none",
          }}
        />
      )}

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--adm-text3)", fontFamily: FB, fontSize: "0.88rem" }}>
          {orders.length === 0
            ? "Aún no hay pedidos. Los clientes aparecerán aquí cuando hagan su primer pedido."
            : "Sin resultados para esa búsqueda."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(c => (
            <div
              key={c.phone}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 12,
                alignItems: "center",
                padding: "14px 16px",
                background: "var(--adm-card)",
                border: "1px solid var(--adm-card-border)",
                borderRadius: 12,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 700, color: "var(--adm-text)" }}>
                    {c.name}
                  </span>
                  {c.orderCount >= 3 && (
                    <span style={{ fontSize: "0.65rem", fontWeight: 700, fontFamily: F, padding: "2px 7px", borderRadius: 999, background: "rgba(244,166,35,0.15)", color: GOLD }}>
                      Frecuente
                    </span>
                  )}
                </div>
                <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text3)", margin: "3px 0 0" }}>
                  {c.phone}
                </p>
                <div style={{ display: "flex", gap: 14, marginTop: 4, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)" }}>
                    {c.orderTypes.map(t => t === "PICKUP" ? "Retiro" : "Delivery").join(" · ")}
                  </span>
                  <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)" }}>
                    Último: {new Date(c.lastOrderAt).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontFamily: F, fontSize: "1rem", fontWeight: 800, color: GOLD, margin: 0 }}>
                  ${c.totalSpent.toLocaleString("es-CL")}
                </p>
                <p style={{ fontFamily: F, fontSize: "0.72rem", fontWeight: 600, color: "var(--adm-text3)", margin: "2px 0 0" }}>
                  {c.orderCount} pedido{c.orderCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
