"use client";
import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import Link from "next/link";

const F = "var(--font-display)";
const I: React.CSSProperties = { width: "100%", padding: "10px 14px", background: "#111", border: "1px solid #2A2A2A", borderRadius: 8, color: "white", fontFamily: F, fontSize: "0.85rem", outline: "none", marginBottom: 10, boxSizing: "border-box" };

const CONF_COLORS: Record<string, string> = { exact: "#4ade80", probable: "#7fbfdc", approximate: "#F4A623", none: "#ff6b6b" };

export default function TicketsPage() {
  const { restaurants } = useAdminSession();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [formRestaurant, setFormRestaurant] = useState("");
  const [formMesa, setFormMesa] = useState("");
  const [formTotal, setFormTotal] = useState("");
  const [formItems, setFormItems] = useState("");
  const [formPaidAt, setFormPaidAt] = useState(new Date().toISOString().slice(0, 16));
  const [formNotes, setFormNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filterConf, setFilterConf] = useState("");

  const loadTickets = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterConf) params.set("confidence", filterConf);
    fetch(`/api/admin/analytics/tickets?${params}`).then((r) => r.json()).then((d) => setTickets(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { loadTickets(); }, [filterConf]);

  const handleSubmit = async () => {
    if (!formRestaurant || !formTotal) return;
    setSaving(true);
    await fetch("/api/admin/analytics/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId: formRestaurant, mesaId: formMesa || null, ticketTotal: parseFloat(formTotal), ticketCountItems: formItems ? parseInt(formItems) : null, paidAt: formPaidAt, notes: formNotes || null }),
    });
    setSaving(false);
    setShowForm(false);
    setFormTotal(""); setFormItems(""); setFormNotes(""); setFormMesa("");
    loadTickets();
  };

  const handleCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split("\n").slice(1).filter(Boolean);
    const items = lines.map((line) => {
      const [slug, mesa, total, items, paid, notes] = line.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
      return { restaurantSlug: slug, mesaId: mesa || null, ticketTotal: parseFloat(total), ticketCountItems: items ? parseInt(items) : null, paidAt: paid, notes: notes || null };
    }).filter((i) => i.ticketTotal > 0);

    setSaving(true);
    await fetch("/api/admin/analytics/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(items) });
    setSaving(false);
    loadTickets();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/admin/analytics/tickets?id=${id}`, { method: "DELETE" });
    setTickets((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <div className="adm-flex-wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 10 }}>
        <div>
          <Link href="/admin/analytics" style={{ fontFamily: F, fontSize: "0.78rem", color: "#888", textDecoration: "none" }}>← Analytics</Link>
          <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: "#F4A623", margin: "8px 0 0" }}>Tickets POS</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowForm(!showForm)} style={{ padding: "8px 16px", background: "#F4A623", color: "#0a0a0a", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>
            {showForm ? "Cancelar" : "+ Agregar"}
          </button>
          <label style={{ padding: "8px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 8, color: "#888", fontFamily: F, fontSize: "0.82rem", cursor: "pointer" }}>
            CSV
            <input type="file" accept=".csv" onChange={handleCSV} style={{ display: "none" }} />
          </label>
        </div>
      </div>

      {showForm && (
        <div style={{ background: "#1A1A1A", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <select value={formRestaurant} onChange={(e) => setFormRestaurant(e.target.value)} style={I}>
            <option value="">Seleccionar local</option>
            {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <div style={{ display: "flex", gap: 10 }}>
            <input placeholder="Mesa (opcional)" value={formMesa} onChange={(e) => setFormMesa(e.target.value)} style={{ ...I, flex: 1 }} />
            <input type="number" placeholder="Total $" value={formTotal} onChange={(e) => setFormTotal(e.target.value)} style={{ ...I, flex: 1 }} />
            <input type="number" placeholder="Items" value={formItems} onChange={(e) => setFormItems(e.target.value)} style={{ ...I, flex: 1 }} />
          </div>
          <input type="datetime-local" value={formPaidAt} onChange={(e) => setFormPaidAt(e.target.value)} style={I} />
          <input placeholder="Notas (opcional)" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} style={I} />
          <button onClick={handleSubmit} disabled={saving || !formRestaurant || !formTotal} style={{ padding: "10px 20px", background: "#F4A623", color: "#0a0a0a", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", opacity: saving ? 0.5 : 1 }}>
            {saving ? "Guardando..." : "Guardar y matchear"}
          </button>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
        {["", "exact", "probable", "approximate", "none"].map((c) => (
          <button key={c} onClick={() => setFilterConf(c)} style={{ padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.72rem", fontWeight: 600, background: filterConf === c ? "#F4A623" : "rgba(255,255,255,0.05)", color: filterConf === c ? "#0a0a0a" : "#888" }}>
            {c || "Todos"}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: "#F4A623", fontFamily: F, textAlign: "center", padding: 40 }}>Cargando...</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {tickets.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: F, fontSize: "1rem", color: "white", fontWeight: 700 }}>${Number(t.ticketTotal).toLocaleString("es-CL")}</span>
                  <span style={{ fontSize: "0.65rem", padding: "2px 8px", borderRadius: 4, background: `${CONF_COLORS[t.matchConfidence || "none"]}20`, color: CONF_COLORS[t.matchConfidence || "none"], fontWeight: 600, fontFamily: F }}>{t.matchConfidence || "none"}</span>
                </div>
                <p style={{ fontFamily: F, fontSize: "0.72rem", color: "#888", margin: "2px 0 0" }}>
                  {t.restaurant?.name} {t.mesaId ? `· Mesa ${t.mesaId}` : ""} · {new Date(t.paidAt).toLocaleString("es-CL")} {t.ticketCountItems ? `· ${t.ticketCountItems} items` : ""}
                </p>
              </div>
              <button onClick={() => handleDelete(t.id)} style={{ background: "none", border: "none", color: "#ff6b6b", cursor: "pointer", fontFamily: F, fontSize: "0.72rem" }}>×</button>
            </div>
          ))}
          {tickets.length === 0 && <p style={{ color: "#666", fontFamily: F, textAlign: "center", padding: 40 }}>No hay tickets</p>}
        </div>
      )}
    </div>
  );
}
