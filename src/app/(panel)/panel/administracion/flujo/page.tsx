"use client";
import { useState, useEffect, useMemo } from "react";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import { ChevronLeft, ChevronRight, Plus, X, Download } from "lucide-react";

const F = "var(--font-display, system-ui)";
const FB = "var(--font-body, system-ui)";
const FM = "'Courier New', 'Menlo', monospace";

type FinancialType = "INCOME" | "EXPENSE";
type Category = {
  id: string; name: string; type: FinancialType;
  group: string | null; color: string | null; icon: string | null; position: number;
};
type EntrySource = "MANUAL" | "BANK_CSV" | "FLUJO";

type Entry = {
  id: string; categoryId: string; amount: number; type: FinancialType;
  date: string; description: string | null; source: EntrySource;
  category: Category;
};

const GROUP_ORDER = ["Proveedores", "Operaciones", "Administración", "Marketing", "RRHH", "Inversiones", "Dinero temporal", "Impuestos", "Amortizaciones"];
const GROUP_ICONS: Record<string, string> = {
  Proveedores: "🛒", Operaciones: "⚙️", Administración: "📋",
  Marketing: "📣", RRHH: "👥", Inversiones: "🏗️",
  "Dinero temporal": "💸", Impuestos: "🏛️", Amortizaciones: "📉",
};

function clp(n: number) {
  return "$" + Math.abs(Math.round(n)).toLocaleString("es-CL");
}
function pct(part: number, total: number) {
  if (!total || !part) return "—";
  const v = (part / total) * 100;
  return (v < 0.1 ? "0.0" : v.toFixed(1)) + "%";
}
function toDateStr(d: Date) { return d.toISOString().split("T")[0]; }
function monthLabel(y: number, m: number) {
  return new Date(y, m - 1).toLocaleDateString("es-CL", { month: "long", year: "numeric" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry Modal
// ─────────────────────────────────────────────────────────────────────────────
function EntryModal({ categories, restaurantId, defaultDate, onClose, onSaved }: {
  categories: Category[]; restaurantId: string; defaultDate: string;
  onClose: () => void; onSaved: (e: Entry) => void;
}) {
  const [type, setType] = useState<FinancialType>("EXPENSE");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const cats = categories.filter(c => c.type === type);
  const byGroup: Record<string, Category[]> = {};
  for (const c of cats) {
    const g = c.group || "Otros"; if (!byGroup[g]) byGroup[g] = []; byGroup[g].push(c);
  }

  async function save() {
    if (!categoryId || !amount || !date) { setError("Completa todos los campos."); return; }
    const n = parseInt(amount.replace(/\D/g, ""), 10);
    if (!n || n <= 0) { setError("Monto inválido."); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/financial/entries", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, categoryId, amount: n, type, date, description: description.trim() || null }),
      });
      if (!r.ok) { const d = await r.json(); setError(d.error || "Error"); setSaving(false); return; }
      onSaved(await r.json());
    } catch { setError("Error de conexión"); }
    setSaving(false);
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: "1px solid var(--adm-card-border,#e5e7eb)",
    background: "var(--adm-input,#f9fafb)", color: "var(--adm-text,#111)",
    fontFamily: FB, fontSize: "0.9rem", outline: "none", boxSizing: "border-box",
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--adm-bg,#fff)", borderRadius: 20, width: "100%", maxWidth: 520, padding: "24px 20px 28px", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "var(--adm-text,#111)", margin: 0 }}>Nuevo movimiento</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--adm-text3,#999)", fontSize: 20 }}>×</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {(["INCOME", "EXPENSE"] as FinancialType[]).map(t => (
            <button key={t} onClick={() => { setType(t); setCategoryId(""); }}
              style={{ padding: "10px", borderRadius: 8, border: `2px solid ${type === t ? (t === "INCOME" ? "#22c55e" : "#ef4444") : "var(--adm-card-border,#e5e7eb)"}`, background: type === t ? (t === "INCOME" ? "#f0fdf4" : "#fef2f2") : "transparent", fontFamily: F, fontSize: "0.85rem", fontWeight: 700, color: type === t ? (t === "INCOME" ? "#16a34a" : "#dc2626") : "var(--adm-text2,#888)", cursor: "pointer" }}>
              {t === "INCOME" ? "↑ Ingreso" : "↓ Egreso"}
            </button>
          ))}
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3,#999)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Categoría *</label>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)} style={{ ...inp, appearance: "auto" }}>
            <option value="">Seleccionar...</option>
            {type === "EXPENSE"
              ? Object.entries(byGroup).sort(([a], [b]) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b)).map(([g, cs]) => (
                  <optgroup key={g} label={`${GROUP_ICONS[g] || ""} ${g}`}>
                    {cs.map(c => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>)}
                  </optgroup>
                ))
              : cats.map(c => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>)
            }
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3,#999)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Monto *</label>
          <input inputMode="numeric" placeholder="$0"
            value={amount ? clp(parseInt(amount, 10)) : ""}
            onChange={e => setAmount(e.target.value.replace(/\D/g, ""))}
            style={{ ...inp, fontSize: "1.4rem", fontWeight: 700, color: type === "INCOME" ? "#16a34a" : "#dc2626" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
          <div>
            <label style={{ display: "block", fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3,#999)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Fecha *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={{ display: "block", fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3,#999)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Descripción</label>
            <input placeholder="Detalle opcional..." value={description} onChange={e => setDescription(e.target.value)} style={inp} />
          </div>
        </div>
        {error && <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "#ef4444", margin: "0 0 12px" }}>{error}</p>}
        <button onClick={save} disabled={saving}
          style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", background: type === "INCOME" ? "#22c55e" : "#ef4444", color: "#fff", fontFamily: F, fontSize: "0.9rem", fontWeight: 700, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Guardando..." : "Guardar movimiento"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// P&L Statement — formato estado de resultados contable
// ─────────────────────────────────────────────────────────────────────────────
function PLStatement({ categories, entries, monthStr }: {
  categories: Category[]; entries: Entry[]; monthStr: string;
}) {
  const catTotals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const e of entries) t[e.categoryId] = (t[e.categoryId] || 0) + e.amount;
    return t;
  }, [entries]);

  const incomeCats = categories.filter(c => c.type === "INCOME");
  const expenseCats = categories.filter(c => c.type === "EXPENSE");

  const totalIncome = incomeCats.reduce((s, c) => s + (catTotals[c.id] || 0), 0);
  const totalExpense = expenseCats.reduce((s, c) => s + (catTotals[c.id] || 0), 0);
  const resultado = totalIncome - totalExpense;
  const margen = totalIncome > 0 ? Math.round((resultado / totalIncome) * 100) : 0;

  // Agrupar egresos
  const groups: [string, Category[]][] = useMemo(() => {
    const map: Record<string, Category[]> = {};
    for (const c of expenseCats) {
      const g = c.group || "Otros"; if (!map[g]) map[g] = []; map[g].push(c);
    }
    const ordered: [string, Category[]][] = GROUP_ORDER.filter(g => map[g]).map(g => [g, map[g]]);
    for (const [g, cs] of Object.entries(map)) if (!GROUP_ORDER.includes(g)) ordered.push([g, cs]);
    return ordered;
  }, [expenseCats]);

  if (!totalIncome && !totalExpense) return (
    <p style={{ fontFamily: FB, fontSize: "0.88rem", color: "var(--adm-text3,#999)", textAlign: "center", padding: "32px 0", margin: 0 }}>Sin movimientos registrados este mes.</p>
  );

  return (
    <div>
      {/* Título del estado */}
      <div style={{ textAlign: "center", marginBottom: 20, paddingBottom: 16, borderBottom: "2px solid var(--adm-card-border,#e5e7eb)" }}>
        <p style={{ fontFamily: F, fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--adm-text3,#aaa)", margin: "0 0 4px" }}>Flujo de Caja</p>
        <p style={{ fontFamily: F, fontSize: "1rem", fontWeight: 800, color: "var(--adm-text,#111)", textTransform: "capitalize", margin: 0 }}>{monthStr}</p>
      </div>

      {/* Cabecera columnas */}
      <ColHeader />

      {/* ── INGRESOS ─────────────────────────────────────── */}
      <SectionHead label="Ingresos" color="#16a34a" />
      {incomeCats.map(c => {
        const v = catTotals[c.id] || 0;
        if (!v) return null;
        return <DataRow key={c.id} label={c.name} icon={c.icon} value={v} base={totalIncome} isIncome indent />;
      })}
      <TotalRow label="Total ingresos" value={totalIncome} base={totalIncome} color="#16a34a" thick />

      <Spacer />

      {/* ── EGRESOS ──────────────────────────────────────── */}
      <SectionHead label="Egresos" color="#dc2626" />

      {groups.map(([groupName, cats]) => {
        const groupTotal = cats.reduce((s, c) => s + (catTotals[c.id] || 0), 0);
        if (!groupTotal) return null;
        return (
          <div key={groupName}>
            <GroupHead label={groupName} icon={GROUP_ICONS[groupName]} value={groupTotal} base={totalIncome} />
            {cats.map(c => {
              const v = catTotals[c.id] || 0;
              if (!v) return null;
              return <DataRow key={c.id} label={c.name} icon={c.icon} value={v} base={totalIncome} indent deep />;
            })}
          </div>
        );
      })}
      <TotalRow label="Total egresos" value={totalExpense} base={totalIncome} color="#dc2626" thick />

      <Spacer />

      {/* ── RESULTADO ────────────────────────────────────── */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr auto auto", gap: 0,
        padding: "14px 12px", borderRadius: 10,
        background: resultado >= 0 ? "rgba(22,163,74,0.06)" : "rgba(220,38,38,0.06)",
        border: `1px solid ${resultado >= 0 ? "#bbf7d0" : "#fecaca"}`,
        marginTop: 4,
      }}>
        <div>
          <p style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 800, color: "var(--adm-text,#111)", margin: "0 0 2px" }}>
            {resultado >= 0 ? "Utilidad neta" : "Pérdida neta"}
          </p>
          <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3,#999)", margin: 0 }}>
            Margen {margen}% sobre ingresos
          </p>
        </div>
        <span style={{ fontFamily: FM, fontSize: "0.78rem", color: "var(--adm-text3,#bbb)", alignSelf: "center", paddingRight: 16 }}>
          {pct(Math.abs(resultado), totalIncome)}
        </span>
        <span style={{ fontFamily: F, fontSize: "1.1rem", fontWeight: 800, color: resultado >= 0 ? "#16a34a" : "#dc2626", alignSelf: "center" }}>
          {resultado >= 0 ? "+" : "-"}{clp(resultado)}
        </span>
      </div>
    </div>
  );
}

// Sub-components para la tabla P&L
function ColHeader() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 56px 100px", gap: 0, padding: "0 12px 6px", borderBottom: "1px solid var(--adm-card-border,#f0f0f0)", marginBottom: 8 }}>
      <span style={{ fontFamily: F, fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--adm-text3,#bbb)" }}>Concepto</span>
      <span style={{ fontFamily: F, fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--adm-text3,#bbb)", textAlign: "right" }}>% ing.</span>
      <span style={{ fontFamily: F, fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--adm-text3,#bbb)", textAlign: "right" }}>Monto</span>
    </div>
  );
}

function SectionHead({ label, color }: { label: string; color: string }) {
  return (
    <p style={{ fontFamily: F, fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color, margin: "0 0 6px", padding: "2px 12px" }}>{label}</p>
  );
}

function GroupHead({ label, icon, value, base }: { label: string; icon?: string; value: number; base: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 56px 100px", gap: 0, padding: "6px 12px 4px", background: "var(--adm-input,#f9fafb)", borderRadius: 6, margin: "2px 0" }}>
      <span style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 700, color: "var(--adm-text2,#555)", display: "flex", alignItems: "center", gap: 5 }}>
        {icon && <span style={{ fontSize: 12 }}>{icon}</span>}{label}
      </span>
      <span style={{ fontFamily: FM, fontSize: "0.78rem", color: "var(--adm-text3,#bbb)", textAlign: "right", alignSelf: "center" }}>{pct(value, base)}</span>
      <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-text,#333)", textAlign: "right", alignSelf: "center" }}>{clp(value)}</span>
    </div>
  );
}

function DataRow({ label, icon, value, base, indent, deep, isIncome }: {
  label: string; icon?: string | null; value: number; base: number;
  indent?: boolean; deep?: boolean; isIncome?: boolean;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 56px 100px", gap: 0, padding: "5px 12px", paddingLeft: deep ? 28 : indent ? 20 : 12 }}>
      <span style={{ fontFamily: FB, fontSize: "0.845rem", color: "var(--adm-text2,#555)", display: "flex", alignItems: "center", gap: 5 }}>
        {icon && <span style={{ fontSize: 13, flexShrink: 0 }}>{icon}</span>}
        {label}
      </span>
      <span style={{ fontFamily: FM, fontSize: "0.78rem", color: "var(--adm-text3,#ccc)", textAlign: "right", alignSelf: "center" }}>{pct(value, base)}</span>
      <span style={{ fontFamily: FM, fontSize: "0.855rem", fontWeight: 600, color: isIncome ? "#16a34a" : "var(--adm-text,#333)", textAlign: "right", alignSelf: "center" }}>{clp(value)}</span>
    </div>
  );
}

function TotalRow({ label, value, base, color, thick }: { label: string; value: number; base: number; color: string; thick?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 56px 100px", gap: 0, padding: "8px 12px", borderTop: `${thick ? 2 : 1}px solid var(--adm-card-border,#e5e7eb)`, marginTop: 4 }}>
      <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-text,#111)" }}>{label}</span>
      <span style={{ fontFamily: FM, fontSize: "0.78rem", color: "var(--adm-text3,#bbb)", textAlign: "right", alignSelf: "center" }}>{pct(value, base)}</span>
      <span style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 800, color, textAlign: "right", alignSelf: "center" }}>{clp(value)}</span>
    </div>
  );
}

function Spacer() {
  return <div style={{ height: 16 }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Recent Entries
// ─────────────────────────────────────────────────────────────────────────────
const SOURCE_LABEL: Record<EntrySource, string> = {
  MANUAL: "Manual",
  BANK_CSV: "Banco",
  FLUJO: "/flujo",
};
const SOURCE_COLOR: Record<EntrySource, string> = {
  MANUAL: "#94a3b8",
  BANK_CSV: "#3b82f6",
  FLUJO: "#f59e0b",
};
const SOURCE_CONFIRM: Record<EntrySource, string | null> = {
  MANUAL: null, // sin confirmación
  BANK_CSV: "Este movimiento viene de la conciliación bancaria. Al eliminarlo, el movimiento del banco volverá a estar Pendiente en Conciliación. ¿Continuar?",
  FLUJO: "Este movimiento fue reportado por el agente en /flujo. Al eliminarlo, se reducirá el total justificado del mes. ¿Continuar?",
};

function RecentEntries({ entries, restaurantId, onDelete }: { entries: Entry[]; restaurantId: string; onDelete: (id: string) => void }) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const recent = [...entries]
    .filter(e => !e.description?.match(/^(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre) 2026$/))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20);

  async function del(e: Entry) {
    const msg = SOURCE_CONFIRM[e.source];
    if (msg && !confirm(msg)) return;
    setDeletingId(e.id);
    await fetch("/api/admin/financial/entries", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: e.id, restaurantId }) });
    onDelete(e.id);
    setDeletingId(null);
  }

  if (!recent.length) return null;

  return (
    <div style={{ marginTop: 24 }}>
      <p style={{ fontFamily: F, fontSize: "0.68rem", fontWeight: 700, color: "var(--adm-text3,#aaa)", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 10px" }}>
        Movimientos recientes
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {recent.map(e => (
          <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, background: "var(--adm-card,#fff)", border: "1px solid var(--adm-card-border,#f0f0f0)" }}>
            <span style={{ fontSize: 15, flexShrink: 0 }}>{e.category.icon || (e.type === "INCOME" ? "↑" : "↓")}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text,#111)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {e.category.name}{e.description ? ` — ${e.description}` : ""}
              </p>
              <p style={{ margin: "1px 0 0", fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3,#999)", display: "flex", alignItems: "center", gap: 6 }}>
                {new Date(e.date).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                {e.category.group && <span style={{ opacity: 0.6 }}>· {e.category.group}</span>}
                <span style={{ padding: "1px 5px", borderRadius: 4, background: SOURCE_COLOR[e.source] + "22", color: SOURCE_COLOR[e.source], fontWeight: 600, fontSize: "0.68rem" }}>
                  {SOURCE_LABEL[e.source]}
                </span>
              </p>
            </div>
            <span style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 800, color: e.type === "INCOME" ? "#16a34a" : "#dc2626", flexShrink: 0 }}>
              {e.type === "INCOME" ? "+" : "-"}{clp(e.amount)}
            </span>
            <button
              onClick={() => del(e)}
              disabled={deletingId === e.id}
              title={e.source === "BANK_CSV" ? "Eliminar (el movimiento bancario vuelve a Pendiente)" : e.source === "FLUJO" ? "Eliminar (reduce lo justificado por el agente)" : "Eliminar"}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--adm-text3,#ccc)", padding: 4, flexShrink: 0, opacity: deletingId === e.id ? 0.4 : 1 }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function FlujoFinancieroPage() {
  const { selectedRestaurantId } = usePanelSession();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const daysInMonth = new Date(year, month, 0).getDate();

  useEffect(() => {
    if (!selectedRestaurantId) return;
    fetch(`/api/admin/financial/categories?restaurantId=${selectedRestaurantId}`)
      .then(r => r.json()).then(setCategories).catch(() => {});
  }, [selectedRestaurantId]);

  useEffect(() => {
    if (!selectedRestaurantId) return;
    setLoading(true);
    fetch(`/api/admin/financial/entries?restaurantId=${selectedRestaurantId}&month=${year}-${String(month).padStart(2, "0")}`)
      .then(r => r.json()).then(d => { setEntries(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedRestaurantId, year, month]);

  function goPrev() { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function goNext() { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }

  const totalIncome = useMemo(() => entries.filter(e => e.type === "INCOME").reduce((s, e) => s + e.amount, 0), [entries]);
  const totalExpense = useMemo(() => entries.filter(e => e.type === "EXPENSE").reduce((s, e) => s + e.amount, 0), [entries]);
  const resultado = totalIncome - totalExpense;

  const defaultDate = toDateStr(new Date(year, month - 1, Math.min(now.getDate(), daysInMonth)));

  if (!selectedRestaurantId) return null;

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <p style={{ fontFamily: F, fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--adm-text3,#999)", margin: "0 0 2px" }}>Administración</p>
          <h1 style={{ fontFamily: F, fontSize: "1.5rem", fontWeight: 800, color: "var(--adm-text,#111)", margin: 0 }}>Flujo de Caja</h1>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10, border: "none", background: "#F4A623", color: "#fff", fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>
          <Plus size={15} /> Nuevo movimiento
        </button>
      </div>

      {/* Month navigation */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={goPrev} style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid var(--adm-card-border,#e5e7eb)", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--adm-text,#111)" }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "var(--adm-text,#111)", textTransform: "capitalize", minWidth: 160, textAlign: "center" }}>{monthLabel(year, month)}</span>
        <button onClick={goNext} style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid var(--adm-card-border,#e5e7eb)", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--adm-text,#111)" }}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 20 }}>
        <Kpi label="Ingresos" value={clp(totalIncome)} color="#16a34a" bg="#f0fdf4" border="#bbf7d0" />
        <Kpi label="Egresos" value={clp(totalExpense)} color="#dc2626" bg="#fef2f2" border="#fecaca" />
        <Kpi
          label={resultado >= 0 ? "Utilidad" : "Pérdida"}
          value={clp(resultado)}
          color={resultado >= 0 ? "#16a34a" : "#dc2626"}
          bg={resultado >= 0 ? "#f0fdf4" : "#fef2f2"}
          border={resultado >= 0 ? "#bbf7d0" : "#fecaca"}
          sub={totalIncome > 0 ? `margen ${Math.round(resultado / totalIncome * 100)}%` : undefined}
        />
      </div>

      {/* P&L Card */}
      <div style={{ padding: "20px", borderRadius: 16, background: "var(--adm-card,#fff)", border: "1px solid var(--adm-card-border,#f0f0f0)" }}>
        {loading
          ? <p style={{ fontFamily: FB, color: "var(--adm-text3,#999)", textAlign: "center", padding: "32px 0", margin: 0 }}>Cargando...</p>
          : <PLStatement categories={categories} entries={entries} monthStr={monthLabel(year, month)} />
        }
      </div>

      {!loading && (
        <RecentEntries entries={entries} restaurantId={selectedRestaurantId} onDelete={id => setEntries(p => p.filter(e => e.id !== id))} />
      )}

      {showModal && (
        <EntryModal categories={categories} restaurantId={selectedRestaurantId} defaultDate={defaultDate}
          onClose={() => setShowModal(false)} onSaved={e => { setEntries(p => [...p, e]); setShowModal(false); }} />
      )}
    </div>
  );
}

function Kpi({ label, value, color, bg, border, sub }: { label: string; value: string; color: string; bg: string; border: string; sub?: string }) {
  return (
    <div style={{ padding: "12px 14px", borderRadius: 12, background: bg, border: `1px solid ${border}` }}>
      <p style={{ fontFamily: F, fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.08em", color, margin: "0 0 3px" }}>{label}</p>
      <p style={{ fontFamily: F, fontSize: "1rem", fontWeight: 800, color, margin: 0 }}>{value}</p>
      {sub && <p style={{ fontFamily: FB, fontSize: "0.7rem", color, opacity: 0.7, margin: "2px 0 0" }}>{sub}</p>}
    </div>
  );
}
