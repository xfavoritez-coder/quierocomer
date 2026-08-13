"use client";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Landmark, Upload, CheckCircle, AlertCircle, X, ChevronLeft, ChevronRight,
  Check, SplitSquareHorizontal, RefreshCw, EyeOff, Undo2, Trash2, User,
} from "lucide-react";
import { usePanelSession } from "@/lib/admin/usePanelSession";

const F = "var(--font-display, system-ui)";
const FB = "var(--font-body, system-ui)";

// ─── Types ────────────────────────────────────────────────────────────────────

type MovementStatus = "PENDING" | "SUGGESTED" | "RECONCILED" | "IGNORED";

type Category = {
  id: string; name: string; type: string;
  color: string | null; icon: string | null;
};

type Entry = {
  id: string; amount: number;
  category: { id: string; name: string; color: string | null; icon: string | null; type: string };
};

type Movement = {
  id: string;
  date: string;
  description: string;
  debit: number | null;
  credit: number | null;
  balance: number | null;
  status: MovementStatus;
  agent: { id: string; name: string } | null;
  entries: Entry[];
  suggestedCategory: { id: string; name: string; color: string | null; icon: string | null; type: string } | null;
};

type CashAgent = { id: string; name: string; isActive: boolean };

// ─── Constants ────────────────────────────────────────────────────────────────

const GROUP_ORDER = ["Proveedores", "Operaciones", "Administración", "Marketing", "RRHH", "Inversiones", "Dinero temporal", "Impuestos", "Amortizaciones"];
const GROUP_ICONS: Record<string, string> = {
  Proveedores: "🛒", Operaciones: "⚙️", Administración: "📋",
  Marketing: "📣", RRHH: "👥", Inversiones: "🏗️",
  "Dinero temporal": "💸", Impuestos: "🏛️", Amortizaciones: "📉",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtClp(n: number) {
  return "$" + Math.abs(Math.round(n)).toLocaleString("es-CL");
}

function fmtDate(iso: string) {
  // Accepts full ISO ("2026-08-01T03:00:00.000Z") or date-only ("2026-08-01")
  const datePart = iso.length > 10 ? iso.slice(0, 10) : iso;
  const d = new Date(datePart + "T12:00:00");
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1).toLocaleDateString("es-CL", { month: "long", year: "numeric" });
}

function prevMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 2);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function movAmount(m: Movement): number {
  if (m.credit && m.credit > 0) return m.credit;
  if (m.debit && m.debit > 0) return -m.debit;
  return 0;
}

function statusColor(s: MovementStatus): string {
  switch (s) {
    case "PENDING": return "#9ca3af";
    case "SUGGESTED": return "#3b82f6";
    case "RECONCILED": return "#22c55e";
    case "IGNORED": return "#9ca3af";
  }
}

function statusLabel(s: MovementStatus): string {
  switch (s) {
    case "PENDING": return "Pendiente";
    case "SUGGESTED": return "Sugerido";
    case "RECONCILED": return "Conciliado";
    case "IGNORED": return "Ignorado";
  }
}

// ─── Category select for inline panels ───────────────────────────────────────

function CategorySelect({
  categories, value, onChange, isExpense,
}: {
  categories: Category[]; value: string; onChange: (v: string) => void; isExpense: boolean;
}) {
  const type = isExpense ? "EXPENSE" : "INCOME";
  const cats = categories.filter(c => c.type === type);
  const byGroup: Record<string, Category[]> = {};
  for (const c of cats) {
    const g = (c as Category & { group?: string }).group || "Otros";
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g].push(c);
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "8px 10px", borderRadius: 8,
    border: "1px solid var(--adm-card-border,#e5e7eb)",
    background: "var(--adm-input,#f9fafb)", color: "var(--adm-text,#111)",
    fontFamily: FB, fontSize: "0.85rem", outline: "none", boxSizing: "border-box",
    appearance: "auto",
  };

  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={inp}>
      <option value="">Seleccionar categoría...</option>
      {isExpense
        ? Object.entries(byGroup)
            .sort(([a], [b]) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b))
            .map(([g, cs]) => (
              <optgroup key={g} label={`${GROUP_ICONS[g] || ""} ${g}`}>
                {cs.map(c => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>)}
              </optgroup>
            ))
        : cats.map(c => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>)
      }
    </select>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KPI({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{ padding: "14px 16px", background: "var(--adm-card,#fff)", border: "1px solid var(--adm-card-border,#f0f0f0)", borderRadius: 12 }}>
      <p style={{ fontFamily: F, fontSize: "0.62rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--adm-text3,#999)", margin: "0 0 4px" }}>{label}</p>
      <p style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 800, color, margin: "0 0 2px" }}>{value}</p>
      {sub && <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3,#aaa)", margin: 0 }}>{sub}</p>}
    </div>
  );
}

// ─── Movement Row ─────────────────────────────────────────────────────────────

type PanelMode = "simple" | "split";

function MovRow({
  m, categories, agents, onAction, onDelete,
}: {
  m: Movement;
  categories: Category[];
  agents: CashAgent[];
  onAction: (movementId: string, params: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PanelMode>("simple");
  const [saving, setSaving] = useState(false);

  // Agent assignment
  const [selAgent, setSelAgent] = useState("");

  // Simple categorize
  const [selCat, setSelCat] = useState("");

  // Split
  type SplitRow = { categoryId: string; amount: string; description: string };
  const [splits, setSplits] = useState<SplitRow[]>([
    { categoryId: "", amount: "", description: "" },
    { categoryId: "", amount: "", description: "" },
  ]);

  const amount = movAmount(m);
  const isExpense = amount < 0;
  const absAmount = Math.round(Math.abs(amount)); // redondear para evitar problemas de float

  const splitTotal = splits.reduce((s, r) => {
    const n = parseInt(r.amount.replace(/\D/g, ""), 10);
    return s + (isNaN(n) ? 0 : n);
  }, 0);
  const remaining = absAmount - splitTotal;

  async function doAssignAgent() {
    if (!selAgent) return;
    setSaving(true);
    await onAction(m.id, { action: "assign_agent", agentId: selAgent });
    setSaving(false);
    setOpen(false);
  }

  async function doSimple() {
    if (!selCat) return;
    setSaving(true);
    await onAction(m.id, { action: "categorize", categoryId: selCat });
    setSaving(false);
    setOpen(false);
  }

  async function doSplit() {
    const valid = splits.filter(s => s.categoryId && parseInt(s.amount.replace(/\D/g, ""), 10) > 0);
    if (valid.length < 2) return;
    if (remaining !== 0) return;
    setSaving(true);
    await onAction(m.id, {
      action: "split",
      splits: valid.map(s => ({
        categoryId: s.categoryId,
        amount: parseInt(s.amount.replace(/\D/g, ""), 10),
        description: s.description.trim() || undefined,
      })),
    });
    setSaving(false);
    setOpen(false);
  }

  async function doConfirmSuggested() {
    if (!m.suggestedCategory) return;
    setSaving(true);
    await onAction(m.id, { action: "categorize", categoryId: m.suggestedCategory.id });
    setSaving(false);
  }

  async function doIgnore() {
    setSaving(true);
    await onAction(m.id, { action: "ignore" });
    setSaving(false);
  }

  async function doUndo() {
    setSaving(true);
    await onAction(m.id, { action: "uncategorize" });
    setSaving(false);
  }

  const toggleOpen = () => {
    setOpen(v => !v);
    setMode("simple");
    setSelCat("");
    setSelAgent("");
  };

  const statusBadge = (
    <span style={{
      fontFamily: FB, fontSize: "0.68rem", padding: "2px 7px", borderRadius: 20,
      background: statusColor(m.status) + "22",
      color: statusColor(m.status),
      border: `1px solid ${statusColor(m.status)}55`,
      flexShrink: 0,
    }}>
      {statusLabel(m.status)}
    </span>
  );

  return (
    <div style={{ borderBottom: "1px solid var(--adm-card-border,#f0f0f0)" }}>
      {/* Main row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px" }}>
        {/* Date */}
        <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3,#999)", minWidth: 48, flexShrink: 0, textTransform: "capitalize" }}>
          {fmtDate(m.date)}
        </span>

        {/* Agent badge */}
        {m.agent && (
          <span style={{ display: "flex", alignItems: "center", gap: 3, fontFamily: FB, fontSize: "0.7rem", padding: "2px 7px", borderRadius: 20, background: "#f59e0b22", color: "#d97706", border: "1px solid #f59e0b44", flexShrink: 0 }}>
            <User size={10} /> {m.agent.name}
          </span>
        )}

        {/* Description */}
        <span style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text,#111)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {m.description}
        </span>

        {/* Amount */}
        <span style={{ fontFamily: F, fontWeight: 700, fontSize: "0.9rem", color: isExpense ? "#ef4444" : "#22c55e", minWidth: 90, textAlign: "right", flexShrink: 0 }}>
          {isExpense ? "- " : "+ "}{fmtClp(absAmount)}
        </span>

        {/* Status / actions */}
        {m.status === "RECONCILED" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {m.entries.map(e => (
              <span key={e.id} style={{ fontFamily: FB, fontSize: "0.7rem", padding: "2px 8px", borderRadius: 20, background: (e.category.color || "#6366f1") + "22", border: `1px solid ${e.category.color || "#6366f1"}55`, color: e.category.color || "#6366f1" }}>
                {e.category.icon ? `${e.category.icon} ` : ""}{e.category.name}
              </span>
            ))}
            <button onClick={doUndo} disabled={saving} title="Deshacer" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--adm-text3,#ccc)", padding: 2, flexShrink: 0, display: "flex" }}>
              <Undo2 size={13} />
            </button>
          </div>
        )}

        {m.status === "IGNORED" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <span style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3,#aaa)" }}>Ignorado</span>
            <button onClick={doUndo} disabled={saving} title="Deshacer" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--adm-text3,#ccc)", padding: 2, display: "flex" }}>
              <Undo2 size={13} />
            </button>
          </div>
        )}

        {m.status === "SUGGESTED" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {m.suggestedCategory && (
              <span style={{ fontFamily: FB, fontSize: "0.7rem", padding: "2px 8px", borderRadius: 20, background: (m.suggestedCategory.color || "#3b82f6") + "22", border: `1px solid ${m.suggestedCategory.color || "#3b82f6"}55`, color: m.suggestedCategory.color || "#3b82f6" }}>
                {m.suggestedCategory.icon ? `${m.suggestedCategory.icon} ` : ""}{m.suggestedCategory.name}
              </span>
            )}
            <button onClick={doConfirmSuggested} disabled={saving} title="Confirmar sugerencia" style={{ background: "#22c55e22", border: "1px solid #22c55e55", borderRadius: 6, cursor: "pointer", color: "#16a34a", padding: "3px 8px", fontFamily: FB, fontSize: "0.72rem", display: "flex", alignItems: "center", gap: 3 }}>
              <Check size={11} /> Confirmar
            </button>
            <button onClick={toggleOpen} disabled={saving} title="Cambiar categoría" style={{ background: "none", border: "1px solid var(--adm-card-border,#ddd)", borderRadius: 6, cursor: "pointer", color: "var(--adm-text2,#666)", padding: "3px 8px", fontFamily: FB, fontSize: "0.72rem" }}>
              Cambiar
            </button>
          </div>
        )}

        {m.status === "PENDING" && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <button onClick={toggleOpen} disabled={saving} style={{ background: "#F4A62322", border: "1px solid #F4A62355", borderRadius: 6, cursor: "pointer", color: "#b45309", padding: "3px 10px", fontFamily: FB, fontSize: "0.75rem", fontWeight: 600 }}>
              Categorizar
            </button>
            <button onClick={doIgnore} disabled={saving} title="Ignorar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--adm-text3,#ccc)", padding: 3, display: "flex" }}>
              <EyeOff size={13} />
            </button>
          </div>
        )}

        {/* Delete */}
        <button onClick={() => onDelete(m.id)} title="Eliminar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--adm-text3,#ccc)", padding: 2, flexShrink: 0, display: "flex" }}>
          <Trash2 size={13} />
        </button>
      </div>

      {/* Inline categorize panel */}
      {open && (
        <div style={{ margin: "0 14px 12px", padding: "14px", background: "var(--adm-bg,#f9fafb)", border: "1px solid var(--adm-card-border,#e5e7eb)", borderRadius: 10 }}>
          {/* Mode toggle */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button onClick={() => setMode("simple")} style={{ fontFamily: FB, fontSize: "0.78rem", padding: "4px 12px", borderRadius: 6, cursor: "pointer", border: `1px solid ${mode === "simple" ? "#F4A623" : "var(--adm-card-border,#ddd)"}`, background: mode === "simple" ? "#F4A62318" : "transparent", color: mode === "simple" ? "#b45309" : "var(--adm-text2,#666)", fontWeight: mode === "simple" ? 700 : 400, display: "flex", alignItems: "center", gap: 4 }}>
              <Check size={12} /> Simple
            </button>
            <button onClick={() => setMode("split")} style={{ fontFamily: FB, fontSize: "0.78rem", padding: "4px 12px", borderRadius: 6, cursor: "pointer", border: `1px solid ${mode === "split" ? "#F4A623" : "var(--adm-card-border,#ddd)"}`, background: mode === "split" ? "#F4A62318" : "transparent", color: mode === "split" ? "#b45309" : "var(--adm-text2,#666)", fontWeight: mode === "split" ? 700 : 400, display: "flex", alignItems: "center", gap: 4 }}>
              <SplitSquareHorizontal size={12} /> Split
            </button>
            <div style={{ flex: 1 }} />
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--adm-text3,#aaa)", display: "flex" }}>
              <X size={15} />
            </button>
          </div>

          {mode === "simple" && (
            <div>
              {/* Agente — si hay agentes activos, ofrecer asignar */}
              {agents.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontFamily: FB, fontSize: "0.72rem", fontWeight: 600, color: "var(--adm-text3,#aaa)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
                    ¿Es un retiro a agente?
                  </p>
                  <select
                    value={selAgent}
                    onChange={e => { setSelAgent(e.target.value); if (e.target.value) setSelCat(""); }}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${selAgent ? "#f59e0b" : "var(--adm-card-border,#e5e7eb)"}`, background: selAgent ? "#f59e0b11" : "var(--adm-input,#f9fafb)", color: "var(--adm-text,#111)", fontFamily: FB, fontSize: "0.85rem", outline: "none" }}
                  >
                    <option value="">Sin agente — categorizar normalmente</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  {selAgent && (
                    <button
                      onClick={doAssignAgent}
                      disabled={saving}
                      style={{ marginTop: 8, padding: "8px 20px", borderRadius: 8, border: "none", background: "#f59e0b", color: "#fff", fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}
                    >
                      {saving ? "Guardando..." : "Asignar a agente"}
                    </button>
                  )}
                  {!selAgent && <div style={{ margin: "10px 0", borderTop: "1px solid var(--adm-card-border,#e5e7eb)" }} />}
                </div>
              )}
              {!selAgent && (
                <>
                  <CategorySelect categories={categories} value={selCat} onChange={v => { setSelCat(v); setSelAgent(""); }} isExpense={isExpense} />
                  <button
                    onClick={doSimple}
                    disabled={!selCat || saving}
                    style={{ marginTop: 10, padding: "8px 20px", borderRadius: 8, border: "none", background: selCat ? "#F4A623" : "var(--adm-card-border,#e5e7eb)", color: selCat ? "#fff" : "var(--adm-text3,#aaa)", fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: selCat ? "pointer" : "default" }}
                  >
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                </>
              )}
            </div>
          )}

          {mode === "split" && (
            <div>
              <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2,#666)", margin: "0 0 10px" }}>
                Total: {fmtClp(absAmount)} · Distribuido: {fmtClp(splitTotal)} · <span style={{ color: remaining === 0 ? "#22c55e" : remaining < 0 ? "#ef4444" : "#f59e0b", fontWeight: 700 }}>Restante: {fmtClp(remaining)}</span>
              </p>
              {splits.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                  <div style={{ flex: 2 }}>
                    <CategorySelect categories={categories} value={s.categoryId} onChange={v => setSplits(prev => prev.map((r, j) => j === i ? { ...r, categoryId: v } : r))} isExpense={isExpense} />
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="$0"
                    value={s.amount ? fmtClp(parseInt(s.amount.replace(/\D/g, "") || "0", 10)) : ""}
                    onChange={e => {
                      const raw = e.target.value.replace(/\D/g, "");
                      setSplits(prev => prev.map((r, j) => j === i ? { ...r, amount: raw } : r));
                    }}
                    style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--adm-card-border,#e5e7eb)", background: "var(--adm-input,#f9fafb)", color: "var(--adm-text,#111)", fontFamily: FB, fontSize: "0.85rem", outline: "none" }}
                  />
                  <button
                    onClick={() => setSplits(prev => prev.length > 2 ? prev.filter((_, j) => j !== i) : prev)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--adm-text3,#ccc)", padding: "9px 4px", display: "flex" }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setSplits(prev => [...prev, { categoryId: "", amount: "", description: "" }])}
                style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2,#666)", background: "none", border: "1px dashed var(--adm-card-border,#ddd)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", marginBottom: 10 }}
              >
                + Agregar split
              </button>
              <br />
              <button
                onClick={doSplit}
                disabled={remaining !== 0 || saving || splits.filter(s => s.categoryId && parseInt(s.amount.replace(/\D/g, ""), 10) > 0).length < 2}
                style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: remaining === 0 ? "#F4A623" : "var(--adm-card-border,#e5e7eb)", color: remaining === 0 ? "#fff" : "var(--adm-text3,#aaa)", fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: remaining === 0 ? "pointer" : "default" }}
              >
                {saving ? "Guardando..." : "Guardar split"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Agent Timeline ───────────────────────────────────────────────────────────

type TLItem =
  | { kind: "transfer"; id: string; date: string; amount: number; description: string; status: string }
  | { kind: "purchase"; id: string; date: string; amount: number; description: string; category: string | null; categoryIcon: string | null };

type TLResponse = {
  items: TLItem[];
  runningBalance: number[];
  totalTransferred: number;
  totalSpent: number;
  balance: number;
};

function AgentTimeline({ agentId, restaurantId, month }: { agentId: string; restaurantId: string; month: string }) {
  const [data, setData] = useState<TLResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetch(`/api/admin/financial/agents/timeline?restaurantId=${restaurantId}&agentId=${agentId}&month=${month}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [agentId, restaurantId, month]);

  if (loading) {
    return <div style={{ padding: "12px 14px", fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text3,#aaa)" }}>Cargando timeline…</div>;
  }

  if (!data || data.items.length === 0) {
    return (
      <div style={{ padding: "12px 14px", fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3,#aaa)", fontStyle: "italic" }}>
        Sin gastos reportados en /flujo este mes.
      </div>
    );
  }

  return (
    <div>
      {/* Timeline rows */}
      <div style={{ padding: "8px 0" }}>
        {data.items.map((item, i) => {
          const bal = data.runningBalance[i];
          const isTransfer = item.kind === "transfer";
          return (
            <div
              key={item.id + i}
              style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "7px 14px",
                borderLeft: `3px solid ${isTransfer ? "#22c55e" : "#ef4444"}`,
                marginLeft: 14, marginBottom: 2,
                background: isTransfer ? "#22c55e08" : "#ef444408",
                borderRadius: "0 6px 6px 0",
              }}
            >
              {/* Icon */}
              <span style={{ fontSize: "0.85rem", marginTop: 1 }}>{isTransfer ? "🏦" : (item.categoryIcon || "🛒")}</span>
              {/* Date */}
              <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3,#aaa)", minWidth: 44, marginTop: 2 }}>
                {fmtDate(item.date)}
              </span>
              {/* Description */}
              <span style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text,#111)", flex: 1, lineHeight: 1.35 }}>
                {isTransfer ? item.description : (item.description || item.category || "Sin descripción")}
                {!isTransfer && item.category && (
                  <span style={{ marginLeft: 6, fontSize: "0.72rem", color: "var(--adm-text3,#aaa)", fontStyle: "italic" }}>{item.category}</span>
                )}
              </span>
              {/* Amount */}
              <span style={{ fontFamily: FB, fontSize: "0.82rem", fontWeight: 700, color: isTransfer ? "#22c55e" : "#ef4444", whiteSpace: "nowrap" }}>
                {isTransfer ? "+" : "-"}{fmtClp(item.amount)}
              </span>
              {/* Running balance */}
              <span style={{ fontFamily: FB, fontSize: "0.72rem", color: bal >= 0 ? "#22c55e" : "#ef4444", whiteSpace: "nowrap", minWidth: 68, textAlign: "right", marginTop: 2 }}>
                {bal >= 0 ? `tiene ${fmtClp(bal)}` : `debe ${fmtClp(Math.abs(bal))}`}
              </span>
            </div>
          );
        })}
      </div>

      {/* Summary bar */}
      <div style={{ display: "flex", gap: 16, padding: "10px 14px", borderTop: "1px solid var(--adm-card-border,#f0f0f0)", flexWrap: "wrap" }}>
        <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2,#666)" }}>
          Total recibido: <b style={{ color: "#22c55e" }}>{fmtClp(data.totalTransferred)}</b>
        </span>
        <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2,#666)" }}>
          Total gastado: <b style={{ color: "#ef4444" }}>{fmtClp(data.totalSpent)}</b>
        </span>
        <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2,#666)" }}>
          Balance: <b style={{ color: data.balance >= 0 ? "#22c55e" : "#ef4444" }}>
            {data.balance >= 0 ? `tiene ${fmtClp(data.balance)}` : `debe ${fmtClp(Math.abs(data.balance))}`}
          </b>
        </span>
      </div>

    </div>
  );
}

// ─── Agents tab content ───────────────────────────────────────────────────────

function AgentsTab({
  movements, agents, resumen, restaurantId, month,
}: {
  movements: Movement[]; agents: CashAgent[];
  resumen: { totalRetirado: number; totalReportado: number; sinJustificar: number } | null;
  restaurantId: string;
  month: string;
}) {

  const [openRetiros, setOpenRetiros] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => {
    const map: Record<string, { agent: CashAgent; movements: Movement[]; total: number }> = {};
    for (const ag of agents) {
      map[ag.id] = { agent: ag, movements: [], total: 0 };
    }
    for (const m of movements) {
      if (m.agent && map[m.agent.id]) {
        map[m.agent.id].movements.push(m);
        // Solo contar retiros aún no conciliados (RECONCILED = categorizado directamente, ej: sueldo)
        if (m.status !== "RECONCILED") {
          const amt = movAmount(m);
          map[m.agent.id].total += amt;
        }
      }
    }
    return Object.values(map).filter(g => g.movements.length > 0);
  }, [movements, agents]);

  if (grouped.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--adm-text3,#aaa)", fontFamily: FB, fontSize: "0.88rem" }}>
        <User size={28} style={{ margin: "0 auto 10px", display: "block", opacity: 0.3 }} />
        Sin movimientos de agentes en este mes.
      </div>
    );
  }

  return (
    <div>
      {grouped.map(({ agent, movements: ms, total }) => {
        const isOpen = openRetiros[agent.id] ?? false;
        return (
          <div key={agent.id} style={{ marginBottom: 20, background: "var(--adm-card,#fff)", border: "1px solid var(--adm-card-border,#f0f0f0)", borderRadius: 12, overflow: "hidden" }}>
            {/* Agent header */}
            <div style={{ padding: "10px 14px", background: "#f59e0b0a", borderBottom: "1px solid var(--adm-card-border,#f0f0f0)", display: "flex", alignItems: "center", gap: 10 }}>
              <User size={14} color="#d97706" />
              <span style={{ fontFamily: F, fontWeight: 700, fontSize: "0.88rem", color: "var(--adm-text,#111)", flex: 1 }}>{agent.name}</span>
              <div style={{ display: "flex", gap: 16 }}>
                <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2,#666)" }}>Retirado banco: <b style={{ color: "#ef4444" }}>{fmtClp(Math.abs(total))}</b></span>
                <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2,#666)" }}>Reportado /flujo: <b style={{ color: "#22c55e" }}>{resumen ? fmtClp(resumen.totalReportado) : "—"}</b></span>
                <span style={{ fontFamily: FB, fontSize: "0.78rem", color: resumen && resumen.sinJustificar > 0 ? "#ef4444" : "var(--adm-text3,#aaa)" }}>Sin justificar: <b>{resumen ? (resumen.sinJustificar > 0 ? fmtClp(resumen.sinJustificar) : "✓ OK") : "—"}</b></span>
              </div>
            </div>

            {/* Cash flow timeline */}
            <AgentTimeline agentId={agent.id} restaurantId={restaurantId} month={month} />

            {/* Collapsible retiros — solo informativo, sin acción de categorizar */}
            <div>
              <button
                onClick={() => setOpenRetiros(prev => ({ ...prev, [agent.id]: !prev[agent.id] }))}
                style={{
                  width: "100%", padding: "8px 14px", background: "none",
                  border: "none", borderTop: "1px solid var(--adm-card-border,#f0f0f0)",
                  textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                  fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3,#aaa)",
                }}
              >
                <span style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block", transition: "transform 0.15s" }}>▶</span>
                Ver retiros del banco ({ms.length})
              </button>
              {isOpen && (
                <div>
                  {ms.map(m => {
                    const amt = movAmount(m);
                    return (
                      <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderTop: "1px solid var(--adm-card-border,#f0f0f0)" }}>
                        <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3,#999)", minWidth: 48, flexShrink: 0, textTransform: "capitalize" }}>
                          {fmtDate(m.date)}
                        </span>
                        <span style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text,#111)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.description}
                        </span>
                        <span style={{ fontFamily: F, fontWeight: 700, fontSize: "0.88rem", color: amt < 0 ? "#ef4444" : "#22c55e", flexShrink: 0 }}>
                          {amt < 0 ? "- " : "+ "}{fmtClp(Math.abs(amt))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type TabKey = "PENDING" | "SUGGESTED" | "AGENTS" | "RECONCILED" | "IGNORED";

export default function ConciliacionPage() {
  const { selectedRestaurantId: restaurantId } = usePanelSession();

  const [month, setMonth] = useState(currentMonth);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [agents, setAgents] = useState<CashAgent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  type Resumen = { totalRetirado: number; totalReportado: number; sinJustificar: number };
  const [resumen, setResumen] = useState<Resumen | null>(null);

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; autoSuggested?: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  type PreviewData = {
    total: number; newCount: number; duplicateCount: number;
    agentCount: number; suggestedCount: number; pendingCount: number;
    rows: { date: string; description: string; debit: number | null; credit: number | null; isNew: boolean; agentName?: string; suggestedCategory?: string }[];
  };
  const [preview, setPreview] = useState<PreviewData | null>(null);

  const [tab, setTab] = useState<TabKey>("PENDING");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (rid: string, m: string) => {
    setLoading(true);
    try {
      const [movRes, catRes, agRes, resumenRes] = await Promise.all([
        fetch(`/api/admin/financial/movements?restaurantId=${rid}&month=${m}`),
        fetch(`/api/admin/financial/categories?restaurantId=${rid}`),
        fetch(`/api/admin/financial/agents?restaurantId=${rid}`),
        fetch(`/api/flujo/resumen?restaurantId=${rid}&month=${m}`),
      ]);
      if (movRes.ok) setMovements(await movRes.json());
      if (catRes.ok) setCategories(await catRes.json());
      if (agRes.ok) setAgents(await agRes.json());
      if (resumenRes.ok) setResumen(await resumenRes.json());
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (restaurantId) load(restaurantId, month);
  }, [restaurantId, month, load]);

  // Paso 1: previsualizar sin guardar
  const handleFile = async (file: File) => {
    if (!restaurantId) return;
    setImporting(true);
    setImportResult(null);
    setImportError(null);
    setPreview(null);
    try {
      const fd = new FormData();
      fd.append("restaurantId", restaurantId);
      fd.append("file", file);
      const res = await fetch("/api/admin/financial/movements/preview", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setImportError(data.error || "Error al analizar el archivo"); return; }
      setPendingFile(file);
      setPreview(data);
    } catch {
      setImportError("Error al procesar el archivo");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // Paso 2: confirmar importación
  const confirmImport = async () => {
    if (!restaurantId || !pendingFile) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("restaurantId", restaurantId);
      fd.append("file", pendingFile);
      const res = await fetch("/api/admin/financial/movements", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setImportError(data.error || "Error al importar"); return; }
      setImportResult(data);
      setPreview(null);
      setPendingFile(null);
      await load(restaurantId, month);
    } catch {
      setImportError("Error al importar");
    } finally {
      setImporting(false);
    }
  };

  const handleAction = useCallback(async (movementId: string, params: Record<string, unknown>) => {
    if (!restaurantId) return;
    await fetch("/api/admin/financial/movements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movementId, restaurantId, ...params }),
    });
    if (restaurantId) await load(restaurantId, month);
  }, [restaurantId, month, load]);

  const handleDelete = useCallback(async (id: string) => {
    if (!restaurantId) return;
    await fetch("/api/admin/financial/movements", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, restaurantId }),
    });
    setMovements(prev => prev.filter(m => m.id !== id));
  }, [restaurantId]);

  // KPI calculations
  // Movimientos de agentes viven solo en el tab Agentes — no en tabs generales ni KPIs
  const agentMovements = useMemo(() => movements.filter(m => m.agent !== null), [movements]);
  const nonAgentMovements = useMemo(() => movements.filter(m => m.agent === null), [movements]);

  const totalAbonos = useMemo(() => nonAgentMovements.filter(m => (m.credit ?? 0) > 0).reduce((s, m) => s + (m.credit ?? 0), 0), [nonAgentMovements]);
  const totalCargos = useMemo(() => nonAgentMovements.filter(m => (m.debit ?? 0) > 0).reduce((s, m) => s + (m.debit ?? 0), 0), [nonAgentMovements]);
  const pending = useMemo(() => nonAgentMovements.filter(m => m.status === "PENDING"), [nonAgentMovements]);
  const suggested = useMemo(() => nonAgentMovements.filter(m => m.status === "SUGGESTED"), [nonAgentMovements]);
  const reconciled = useMemo(() => nonAgentMovements.filter(m => m.status === "RECONCILED"), [nonAgentMovements]);
  const ignored = useMemo(() => nonAgentMovements.filter(m => m.status === "IGNORED"), [nonAgentMovements]);

  const pctReconciled = nonAgentMovements.length > 0 ? Math.round(reconciled.length / nonAgentMovements.length * 100) : 0;
  const pendingCount = pending.length + suggested.length;
  // Monto total aún sin categorizar (suma de débitos + créditos de PENDING y SUGGESTED)
  const pendingAmount = useMemo(() => {
    const uncategorized = [...pending, ...suggested];
    return uncategorized.reduce((s, m) => s + Math.abs(movAmount(m)), 0);
  }, [pending, suggested]);

  const tabMovements: Record<TabKey, Movement[]> = {
    PENDING: pending,
    SUGGESTED: suggested,
    AGENTS: agentMovements,
    RECONCILED: reconciled,
    IGNORED: ignored,
  };

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "PENDING", label: "Pendientes", count: pending.length },
    { key: "SUGGESTED", label: "Sugeridos", count: suggested.length },
    { key: "AGENTS", label: "Agentes", count: agentMovements.length },
    { key: "RECONCILED", label: "Conciliados", count: reconciled.length },
    { key: "IGNORED", label: "Ignorados", count: ignored.length },
  ];

  const activeMovements = tabMovements[tab];

  // Empty state messages
  const emptyMessages: Record<TabKey, string> = {
    PENDING: "Sin movimientos pendientes. ¡Todo al día!",
    SUGGESTED: "Sin sugerencias automáticas este mes.",
    AGENTS: "Sin movimientos de agentes en este mes.",
    RECONCILED: "Sin movimientos conciliados aún.",
    IGNORED: "Sin movimientos ignorados.",
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", paddingBottom: 48 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <p style={{ fontFamily: F, fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--adm-text3,#999)", margin: "0 0 2px" }}>Administración</p>
          <h1 style={{ fontFamily: F, fontSize: "1.5rem", fontWeight: 800, color: "var(--adm-text,#111)", margin: "0 0 2px" }}>Conciliación Bancaria</h1>
          <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text3,#aaa)", margin: 0 }}>Importa movimientos BCI y asígnalos a categorías financieras.</p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={importing || !restaurantId}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 10, border: "none", background: importing ? "var(--adm-card-border,#e5e7eb)" : "#F4A623", color: importing ? "var(--adm-text3,#aaa)" : "#fff", fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: importing ? "default" : "pointer", flexShrink: 0 }}
        >
          {importing ? <RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={15} />}
          {importing ? "Analizando..." : "Importar XLSX"}
        </button>
        <input ref={fileRef} type="file" accept=".xlsx" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
      </div>

      {/* Month navigation */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={() => setMonth(prevMonth(month))} style={{ background: "none", border: "1px solid var(--adm-card-border,#e5e7eb)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "var(--adm-text,#111)", display: "flex", alignItems: "center" }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontFamily: F, fontWeight: 700, fontSize: "1rem", color: "var(--adm-text,#111)", minWidth: 180, textAlign: "center", textTransform: "capitalize" }}>
          {monthLabel(month)}
        </span>
        <button onClick={() => setMonth(nextMonth(month))} style={{ background: "none", border: "1px solid var(--adm-card-border,#e5e7eb)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "var(--adm-text,#111)", display: "flex", alignItems: "center" }}>
          <ChevronRight size={16} />
        </button>
        {loading && (
          <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3,#aaa)", display: "flex", alignItems: "center", gap: 5 }}>
            <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Cargando...
          </span>
        )}
      </div>

      {/* ── PREVIEW MODAL ── */}
      {preview && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--adm-card)", borderRadius: 16, width: "100%", maxWidth: 600, maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid var(--adm-card-border)" }}>
            {/* Header */}
            <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--adm-card-border)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <h3 style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>Confirmar importación</h3>
                <button onClick={() => { setPreview(null); setPendingFile(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--adm-text3)" }}><X size={18} /></button>
              </div>
              {/* Resumen de stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 }}>
                {[
                  { label: "Total en archivo", value: preview.total, color: "var(--adm-text)" },
                  { label: "Nuevos", value: preview.newCount, color: "#16a34a" },
                  { label: "Ya existían", value: preview.duplicateCount, color: "var(--adm-text3)" },
                  { label: "→ Agente", value: preview.agentCount, color: "#f59e0b" },
                  { label: "→ Auto-sugeridos", value: preview.suggestedCount, color: "#3b82f6" },
                  { label: "→ Pendientes", value: preview.pendingCount, color: "#9ca3af" },
                ].map(item => (
                  <div key={item.label} style={{ background: "var(--adm-hover)", borderRadius: 8, padding: "8px 10px" }}>
                    <p style={{ fontFamily: FB, fontSize: "0.65rem", color: "var(--adm-text3)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{item.label}</p>
                    <p style={{ fontFamily: F, fontSize: "1.1rem", fontWeight: 700, color: item.color, margin: 0 }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
            {/* Lista de movimientos nuevos */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
              {preview.rows.filter(r => r.isNew).map((row, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 20px", borderBottom: "1px solid var(--adm-card-border)" }}>
                  <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", flexShrink: 0, minWidth: 50 }}>
                    {fmtDate(row.date)}
                  </span>
                  <span style={{ flex: 1, fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.description}
                  </span>
                  <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: row.debit ? "#ef4444" : "#22c55e", flexShrink: 0 }}>
                    {row.debit ? `-$${row.debit.toLocaleString("es-CL")}` : `+$${(row.credit ?? 0).toLocaleString("es-CL")}`}
                  </span>
                  {row.agentName && (
                    <span style={{ fontFamily: FB, fontSize: "0.68rem", background: "#fef3c7", color: "#92400e", padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}>👤 {row.agentName}</span>
                  )}
                  {row.suggestedCategory && !row.agentName && (
                    <span style={{ fontFamily: FB, fontSize: "0.68rem", background: "#eff6ff", color: "#1d4ed8", padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}>⚡ {row.suggestedCategory}</span>
                  )}
                  {!row.agentName && !row.suggestedCategory && (
                    <span style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text3)", flexShrink: 0 }}>·</span>
                  )}
                </div>
              ))}
              {preview.rows.filter(r => !r.isNew).length > 0 && (
                <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)", padding: "10px 20px", margin: 0 }}>
                  + {preview.rows.filter(r => !r.isNew).length} movimientos ya existentes (no se importarán de nuevo)
                </p>
              )}
            </div>
            {/* Footer con botones */}
            <div style={{ padding: "14px 20px", borderTop: "1px solid var(--adm-card-border)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setPreview(null); setPendingFile(null); }} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: "none", color: "var(--adm-text2)", fontFamily: FB, fontSize: "0.875rem", cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={confirmImport} disabled={importing} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#F4A623", color: "#fff", fontFamily: FB, fontSize: "0.875rem", fontWeight: 700, cursor: importing ? "wait" : "pointer", opacity: importing ? 0.7 : 1 }}>
                {importing ? "Importando..." : `Importar ${preview.newCount} movimientos`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import feedback */}
      {importResult && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, marginBottom: 14 }}>
          <CheckCircle size={16} color="#22c55e" />
          <span style={{ fontFamily: FB, fontSize: "0.85rem", color: "#15803d" }}>
            {importResult.created} movimientos importados
            {importResult.skipped > 0 ? `, ${importResult.skipped} ya existían` : ""}
            {importResult.autoSuggested ? `, ${importResult.autoSuggested} sugeridos automáticamente` : ""}
          </span>
          <button onClick={() => setImportResult(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#15803d" }}><X size={14} /></button>
        </div>
      )}
      {importError && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 10, marginBottom: 14 }}>
          <AlertCircle size={16} color="#ef4444" />
          <span style={{ fontFamily: FB, fontSize: "0.85rem", color: "#dc2626" }}>{importError}</span>
          <button onClick={() => setImportError(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#dc2626" }}><X size={14} /></button>
        </div>
      )}

      {/* KPI strip */}
      {loaded && movements.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
          <KPI label="Abonos" value={fmtClp(totalAbonos)} color="#22c55e" />
          <KPI label="Cargos" value={fmtClp(totalCargos)} color="#ef4444" />
          <KPI label="Por categorizar" value={fmtClp(pendingAmount)} color="#f59e0b" sub={`${pendingCount} movimientos`} />
          <KPI label="% Conciliado" value={`${pctReconciled}%`} color="#6366f1" sub={`${reconciled.length} de ${movements.length}`} />
        </div>
      )}

      {/* Agent strip */}
      {loaded && agents.some(a => a.isActive) && agentMovements.length > 0 && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          {agents.filter(a => a.isActive).map(ag => {
            const ms = agentMovements.filter(m => m.agent?.id === ag.id);
            if (!ms.length) return null;
            // Solo contar los no-conciliados (los RECONCILED son sueldos u otros categorizados directamente)
            const total = ms.filter(m => m.status !== "RECONCILED").reduce((s, m) => s + movAmount(m), 0);
            return (
              <div key={ag.id} style={{ padding: "10px 16px", background: "var(--adm-card,#fff)", border: "1px solid var(--adm-card-border,#f0f0f0)", borderRadius: 10, display: "flex", alignItems: "center", gap: 12 }}>
                <User size={14} color="#d97706" />
                <span style={{ fontFamily: F, fontWeight: 700, fontSize: "0.82rem", color: "var(--adm-text,#111)" }}>{ag.name}</span>
                <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2,#666)" }}>Retirado: <b style={{ color: "#ef4444" }}>{fmtClp(Math.abs(total))}</b></span>
                <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2,#666)" }}>Reportado: <b style={{ color: "#22c55e" }}>{resumen ? fmtClp(resumen.totalReportado) : "…"}</b></span>
                <span style={{ fontFamily: FB, fontSize: "0.78rem", color: resumen && resumen.sinJustificar > 0 ? "#ef4444" : "var(--adm-text3,#aaa)" }}>Sin justificar: <b>{resumen ? (resumen.sinJustificar > 0 ? fmtClp(resumen.sinJustificar) : "✓ OK") : "…"}</b></span>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state if no movements at all */}
      {loaded && !loading && movements.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--adm-text3,#aaa)" }}>
          <Landmark size={36} style={{ margin: "0 auto 14px", display: "block", opacity: 0.25 }} />
          <p style={{ fontFamily: F, fontWeight: 700, fontSize: "1rem", color: "var(--adm-text2,#888)", margin: "0 0 6px" }}>Sin movimientos para este mes</p>
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3,#aaa)", margin: 0 }}>Importa el XLSX de BCI para comenzar la conciliación.</p>
        </div>
      )}

      {/* Tabs */}
      {loaded && movements.length > 0 && (
        <>
          {/* Tab bar */}
          <div style={{ display: "flex", gap: 2, marginBottom: 16, borderBottom: "2px solid var(--adm-card-border,#f0f0f0)", overflowX: "auto" }}>
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  fontFamily: F, fontSize: "0.8rem", fontWeight: tab === t.key ? 700 : 400,
                  padding: "8px 14px", background: "none", border: "none",
                  borderBottom: tab === t.key ? "2px solid #F4A623" : "2px solid transparent",
                  marginBottom: -2,
                  color: tab === t.key ? "#b45309" : "var(--adm-text2,#888)",
                  cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6,
                }}
              >
                {t.label}
                {t.count > 0 && (
                  <span style={{ background: tab === t.key ? "#F4A62322" : "var(--adm-card-border,#f0f0f0)", color: tab === t.key ? "#b45309" : "var(--adm-text3,#aaa)", borderRadius: 20, padding: "1px 7px", fontSize: "0.7rem", fontWeight: 700 }}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === "AGENTS" ? (
            <AgentsTab
              movements={agentMovements} agents={agents.filter(a => a.isActive)}
              resumen={resumen}
              restaurantId={restaurantId ?? ""} month={month}
            />
          ) : activeMovements.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--adm-text3,#aaa)" }}>
              <Check size={28} style={{ margin: "0 auto 10px", display: "block", opacity: 0.25 }} />
              <p style={{ fontFamily: FB, fontSize: "0.88rem", margin: 0 }}>{emptyMessages[tab]}</p>
            </div>
          ) : (
            <div style={{ background: "var(--adm-card,#fff)", border: "1px solid var(--adm-card-border,#f0f0f0)", borderRadius: 12, overflow: "hidden" }}>
              {activeMovements.map(m => (
                <MovRow
                  key={m.id}
                  m={m}
                  categories={categories}
                  agents={agents.filter(a => a.isActive)}
                  onAction={handleAction}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Spinner animation */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
