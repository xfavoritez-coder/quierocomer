"use client";
import { useState, useEffect, useMemo } from "react";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import { ChevronLeft, ChevronRight, Plus, X, TrendingUp, TrendingDown, Minus } from "lucide-react";

const F = "var(--font-display, system-ui)";
const FB = "var(--font-body, system-ui)";

type FinancialType = "INCOME" | "EXPENSE";
type Category = { id: string; name: string; type: FinancialType; color: string | null; icon: string | null; position: number };
type Entry = { id: string; categoryId: string; amount: number; type: FinancialType; date: string; description: string | null; category: Category };

function formatCLP(n: number) { return "$" + Math.round(n).toLocaleString("es-CL"); }
function toDateStr(date: Date) { return date.toISOString().split("T")[0]; }
function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("es-CL", { month: "long", year: "numeric" });
}

// ── Entry Form Modal ──────────────────────────────────────────────────────────
function EntryModal({
  categories, restaurantId, defaultDate, onClose, onSaved,
}: { categories: Category[]; restaurantId: string; defaultDate: string; onClose: () => void; onSaved: (e: Entry) => void }) {
  const [type, setType] = useState<FinancialType>("EXPENSE");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const cats = categories.filter(c => c.type === type);

  async function handleSave() {
    if (!categoryId || !amount || !date) { setError("Completa todos los campos requeridos."); return; }
    const amountNum = parseInt(amount.replace(/\D/g, ""), 10);
    if (!amountNum || amountNum <= 0) { setError("Ingresa un monto válido."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/financial/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, categoryId, amount: amountNum, type, date, description: description.trim() || null }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Error al guardar"); setSaving(false); return; }
      const entry = await res.json();
      onSaved(entry);
    } catch { setError("Error de conexión"); }
    setSaving(false);
  }

  const inputS: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--adm-card-border, #e5e7eb)",
    background: "var(--adm-input, #f9fafb)", color: "var(--adm-text, #111)", fontFamily: FB, fontSize: "0.9rem",
    outline: "none", boxSizing: "border-box",
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--adm-bg, #fff)", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 520, padding: "24px 20px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "var(--adm-text, #111)", margin: 0 }}>Nuevo movimiento</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--adm-text3, #999)", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {/* Tipo */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {(["INCOME", "EXPENSE"] as FinancialType[]).map(t => (
            <button key={t} onClick={() => { setType(t); setCategoryId(""); }}
              style={{ padding: "10px 0", borderRadius: 8, border: `2px solid ${type === t ? (t === "INCOME" ? "#22c55e" : "#ef4444") : "var(--adm-card-border, #e5e7eb)"}`, background: type === t ? (t === "INCOME" ? "#f0fdf4" : "#fef2f2") : "transparent", fontFamily: F, fontSize: "0.85rem", fontWeight: 700, color: type === t ? (t === "INCOME" ? "#16a34a" : "#dc2626") : "var(--adm-text2, #888)", cursor: "pointer" }}>
              {t === "INCOME" ? "↑ Ingreso" : "↓ Egreso"}
            </button>
          ))}
        </div>

        {/* Categoría */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3, #999)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Categoría *</label>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)} style={{ ...inputS, appearance: "none" }}>
            <option value="">Seleccionar...</option>
            {cats.map(c => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>)}
          </select>
        </div>

        {/* Monto */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3, #999)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Monto *</label>
          <input inputMode="numeric" placeholder="$0" value={amount ? formatCLP(parseInt(amount, 10)) : ""}
            onChange={e => setAmount(e.target.value.replace(/\D/g, ""))} style={{ ...inputS, fontSize: "1.4rem", fontWeight: 700, color: type === "INCOME" ? "#16a34a" : "#dc2626" }} />
        </div>

        {/* Fecha */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3, #999)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Fecha *</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputS} />
        </div>

        {/* Descripción */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3, #999)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Descripción</label>
          <input placeholder="Detalle del movimiento..." value={description} onChange={e => setDescription(e.target.value)} style={inputS} />
        </div>

        {error && <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "#ef4444", margin: "0 0 12px" }}>{error}</p>}

        <button onClick={handleSave} disabled={saving}
          style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", background: type === "INCOME" ? "#22c55e" : "#ef4444", color: "#fff", fontFamily: F, fontSize: "0.9rem", fontWeight: 700, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Guardando..." : "Guardar movimiento"}
        </button>
      </div>
    </div>
  );
}

// ── P&L Table ──────────────────────────────────────────────────────────────────
function PLTable({ type, categories, entries, days }: { type: FinancialType; categories: Category[]; entries: Entry[]; days: number[] }) {
  const cats = categories.filter(c => c.type === type);
  const color = type === "INCOME" ? "#16a34a" : "#dc2626";

  const byDay = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const e of entries) {
      if (e.type !== type) continue;
      const d = new Date(e.date).getDate();
      const key = String(d);
      if (!map[e.categoryId]) map[e.categoryId] = {};
      map[e.categoryId][key] = (map[e.categoryId][key] || 0) + e.amount;
    }
    return map;
  }, [entries, type]);

  const catTotals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const c of cats) t[c.id] = Object.values(byDay[c.id] || {}).reduce((a, b) => a + b, 0);
    return t;
  }, [cats, byDay]);

  const grandTotal = Object.values(catTotals).reduce((a, b) => a + b, 0);

  // Mobile: solo mostrar total por categoría, sin días
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 700, color, margin: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {type === "INCOME" ? "↑ Ingresos" : "↓ Egresos"}
        </h3>
        <span style={{ fontFamily: F, fontSize: "1rem", fontWeight: 800, color }}>{formatCLP(grandTotal)}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {cats.map(cat => {
          const total = catTotals[cat.id] || 0;
          if (total === 0) return null;
          return (
            <div key={cat.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "var(--adm-input, #f9fafb)", border: "1px solid var(--adm-card-border, #f0f0f0)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {cat.icon && <span style={{ fontSize: 16 }}>{cat.icon}</span>}
                <span style={{ fontFamily: FB, fontSize: "0.88rem", color: "var(--adm-text, #333)" }}>{cat.name}</span>
              </div>
              <span style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: cat.color || color }}>{formatCLP(total)}</span>
            </div>
          );
        })}
        {cats.every(c => !catTotals[c.id]) && (
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3, #999)", textAlign: "center", padding: "16px 0" }}>Sin movimientos este mes</p>
        )}
      </div>
    </div>
  );
}

// ── Recent Entries List ────────────────────────────────────────────────────────
function RecentEntries({ entries, onDelete }: { entries: Entry[]; onDelete: (id: string) => void }) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const recent = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);

  async function handleDelete(id: string, restaurantId: string) {
    setDeletingId(id);
    await fetch("/api/admin/financial/entries", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, restaurantId }) });
    onDelete(id);
    setDeletingId(null);
  }

  if (recent.length === 0) return null;
  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 700, color: "var(--adm-text3, #999)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 10px" }}>Últimos movimientos</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {recent.map(e => (
          <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: "var(--adm-card, #fff)", border: "1px solid var(--adm-card-border, #f0f0f0)" }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{e.category.icon || (e.type === "INCOME" ? "↑" : "↓")}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text, #111)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.category.name}{e.description ? ` — ${e.description}` : ""}</p>
              <p style={{ margin: "2px 0 0", fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3, #999)" }}>{new Date(e.date).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}</p>
            </div>
            <span style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 800, color: e.type === "INCOME" ? "#16a34a" : "#dc2626", flexShrink: 0 }}>
              {e.type === "INCOME" ? "+" : "-"}{formatCLP(e.amount)}
            </span>
            <button onClick={() => handleDelete(e.id, e.category.id)} disabled={deletingId === e.id}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--adm-text3, #ccc)", padding: 4, flexShrink: 0 }}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function FlujoFinancieroPage() {
  const { selectedRestaurantId } = usePanelSession();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  useEffect(() => {
    if (!selectedRestaurantId) return;
    fetch(`/api/admin/financial/categories?restaurantId=${selectedRestaurantId}`)
      .then(r => r.json()).then(setCategories).catch(() => {});
  }, [selectedRestaurantId]);

  useEffect(() => {
    if (!selectedRestaurantId) return;
    setLoadingEntries(true);
    fetch(`/api/admin/financial/entries?restaurantId=${selectedRestaurantId}&month=${year}-${String(month).padStart(2, "0")}`)
      .then(r => r.json()).then(d => { setEntries(d); setLoadingEntries(false); }).catch(() => setLoadingEntries(false));
  }, [selectedRestaurantId, year, month]);

  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }

  const totalIncome = useMemo(() => entries.filter(e => e.type === "INCOME").reduce((s, e) => s + e.amount, 0), [entries]);
  const totalExpense = useMemo(() => entries.filter(e => e.type === "EXPENSE").reduce((s, e) => s + e.amount, 0), [entries]);
  const rentabilidad = totalIncome - totalExpense;

  const defaultDate = toDateStr(new Date(year, month - 1, Math.min(now.getDate(), daysInMonth)));

  if (!selectedRestaurantId) return <p style={{ fontFamily: FB, color: "var(--adm-text3,#999)", padding: 24 }}>Selecciona un restaurante.</p>;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <p style={{ fontFamily: F, fontSize: "0.68rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--adm-text3,#999)", margin: "0 0 2px" }}>Administración</p>
          <h1 style={{ fontFamily: F, fontSize: "1.5rem", fontWeight: 800, color: "var(--adm-text,#111)", margin: 0 }}>Flujo Financiero</h1>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 10, border: "none", background: "#F4A623", color: "#fff", fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>
          <Plus size={16} /> Nuevo movimiento
        </button>
      </div>

      {/* Month nav */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={prevMonth} style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid var(--adm-card-border,#e5e7eb)", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronLeft size={16} /></button>
        <span style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "var(--adm-text,#111)", textTransform: "capitalize", minWidth: 160, textAlign: "center" }}>{monthLabel(year, month)}</span>
        <button onClick={nextMonth} style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid var(--adm-card-border,#e5e7eb)", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronRight size={16} /></button>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 24 }}>
        <div style={{ padding: "14px 16px", borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
          <p style={{ fontFamily: F, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#16a34a", margin: "0 0 4px" }}>Ingresos</p>
          <p style={{ fontFamily: F, fontSize: "1.1rem", fontWeight: 800, color: "#15803d", margin: 0 }}>{formatCLP(totalIncome)}</p>
        </div>
        <div style={{ padding: "14px 16px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca" }}>
          <p style={{ fontFamily: F, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#dc2626", margin: "0 0 4px" }}>Egresos</p>
          <p style={{ fontFamily: F, fontSize: "1.1rem", fontWeight: 800, color: "#dc2626", margin: 0 }}>{formatCLP(totalExpense)}</p>
        </div>
        <div style={{ padding: "14px 16px", borderRadius: 12, background: rentabilidad >= 0 ? "#f0fdf4" : "#fef2f2", border: `1px solid ${rentabilidad >= 0 ? "#bbf7d0" : "#fecaca"}` }}>
          <p style={{ fontFamily: F, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em", color: rentabilidad >= 0 ? "#16a34a" : "#dc2626", margin: "0 0 4px" }}>Rentabilidad</p>
          <p style={{ fontFamily: F, fontSize: "1.1rem", fontWeight: 800, color: rentabilidad >= 0 ? "#15803d" : "#dc2626", margin: 0 }}>{rentabilidad >= 0 ? "+" : ""}{formatCLP(rentabilidad)}</p>
        </div>
      </div>

      {loadingEntries ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3,#999)", textAlign: "center", padding: "40px 0" }}>Cargando...</p>
      ) : (
        <>
          {/* P&L — dos columnas en desktop, una en mobile */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 8 }}>
            <div style={{ padding: 16, borderRadius: 14, background: "var(--adm-card,#fff)", border: "1px solid var(--adm-card-border,#f0f0f0)" }}>
              <PLTable type="INCOME" categories={categories} entries={entries} days={days} />
            </div>
            <div style={{ padding: 16, borderRadius: 14, background: "var(--adm-card,#fff)", border: "1px solid var(--adm-card-border,#f0f0f0)" }}>
              <PLTable type="EXPENSE" categories={categories} entries={entries} days={days} />
            </div>
          </div>

          <RecentEntries entries={entries} onDelete={id => setEntries(prev => prev.filter(e => e.id !== id))} />
        </>
      )}

      {showModal && (
        <EntryModal
          categories={categories}
          restaurantId={selectedRestaurantId}
          defaultDate={defaultDate}
          onClose={() => setShowModal(false)}
          onSaved={entry => { setEntries(prev => [...prev, entry]); setShowModal(false); }}
        />
      )}
    </div>
  );
}
