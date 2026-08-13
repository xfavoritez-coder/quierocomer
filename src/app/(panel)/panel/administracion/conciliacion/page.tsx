"use client";
import { useState, useRef, useCallback } from "react";
import { Landmark, Upload, CheckCircle, AlertCircle, X, ChevronLeft, ChevronRight } from "lucide-react";
import { usePanelSession } from "@/lib/admin/usePanelSession";

const F = "var(--font-display, system-ui)";
const FB = "var(--font-body, system-ui)";

type Category = { id: string; name: string; type: string; color: string | null; icon: string | null };
type Movement = {
  id: string;
  date: string;
  description: string;
  amount: number;
  balance: number | null;
  reference: string | null;
  reconciledAt: string | null;
  entry?: { category: { name: string; color: string | null; icon: string | null } | null } | null;
};

function fmtClp(n: number) {
  const abs = Math.abs(n);
  return "$" + abs.toLocaleString("es-CL");
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  const d = new Date(Number(y), Number(mo) - 1);
  return d.toLocaleDateString("es-CL", { month: "long", year: "numeric" });
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

export default function ConciliacionPage() {
  const { selectedRestaurantId: restaurantId } = usePanelSession();

  const [month, setMonth] = useState(currentMonth);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null); // movementId being assigned
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (rid: string, m: string) => {
    const [movRes, catRes] = await Promise.all([
      fetch(`/api/admin/financial/movements?restaurantId=${rid}&month=${m}`),
      fetch(`/api/admin/financial/categories?restaurantId=${rid}`),
    ]);
    if (movRes.ok) setMovements(await movRes.json());
    if (catRes.ok) setCategories(await catRes.json());
    setLoaded(true);
  }, []);

  const handleMonthChange = (m: string) => {
    setMonth(m);
    if (restaurantId) load(restaurantId, m);
  };

  // Load on first render when session ready
  if (restaurantId && !loaded) {
    load(restaurantId, month);
  }

  const handleFile = async (file: File) => {
    if (!restaurantId) return;
    setImporting(true);
    setImportResult(null);
    setImportError(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/admin/financial/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, csv: text }),
      });
      const data = await res.json();
      if (!res.ok) { setImportError(data.error || "Error al importar"); return; }
      setImportResult(data);
      await load(restaurantId, month);
    } catch {
      setImportError("Error al procesar el archivo");
    } finally {
      setImporting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const assign = async (movementId: string, categoryId: string | null) => {
    if (!restaurantId) return;
    setAssigning(movementId);
    await fetch("/api/admin/financial/movements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movementId, restaurantId, categoryId }),
    });
    await load(restaurantId, month);
    setAssigning(null);
  };

  const deleteMovement = async (id: string) => {
    if (!restaurantId) return;
    await fetch("/api/admin/financial/movements", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, restaurantId }),
    });
    setMovements((prev) => prev.filter((m) => m.id !== id));
  };

  const reconciled = movements.filter((m) => m.reconciledAt);
  const pending = movements.filter((m) => !m.reconciledAt);

  const totalAbonos = movements.filter(m => m.amount > 0).reduce((s, m) => s + m.amount, 0);
  const totalCargos = movements.filter(m => m.amount < 0).reduce((s, m) => s + Math.abs(m.amount), 0);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <p style={{ fontFamily: F, fontSize: "0.68rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--adm-text3,#999)", margin: "0 0 2px" }}>Administración</p>
      <h1 style={{ fontFamily: F, fontSize: "1.5rem", fontWeight: 800, color: "var(--adm-text,#111)", margin: "0 0 24px" }}>Conciliación Bancaria</h1>

      {/* Month nav */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={() => handleMonthChange(prevMonth(month))} style={{ background: "none", border: "1px solid var(--adm-card-border,#eee)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "var(--adm-text,#111)", display: "flex", alignItems: "center" }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontFamily: F, fontWeight: 700, fontSize: "1rem", color: "var(--adm-text,#111)", minWidth: 160, textAlign: "center", textTransform: "capitalize" }}>{monthLabel(month)}</span>
        <button onClick={() => handleMonthChange(nextMonth(month))} style={{ background: "none", border: "1px solid var(--adm-card-border,#eee)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "var(--adm-text,#111)", display: "flex", alignItems: "center" }}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* KPIs */}
      {movements.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
          <KPI label="Abonos" value={fmtClp(totalAbonos)} color="#22c55e" />
          <KPI label="Cargos" value={fmtClp(totalCargos)} color="#ef4444" />
          <KPI label="Pendientes" value={`${pending.length}`} color="#f59e0b" sub={`de ${movements.length}`} />
          <KPI label="Conciliados" value={`${reconciled.length}`} color="#6366f1" sub={`${movements.length > 0 ? Math.round(reconciled.length / movements.length * 100) : 0}%`} />
        </div>
      )}

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? "#6366f1" : "var(--adm-card-border,#e5e7eb)"}`,
          borderRadius: 14,
          padding: "28px 20px",
          textAlign: "center",
          cursor: "pointer",
          marginBottom: 24,
          background: dragging ? "rgba(99,102,241,0.04)" : "var(--adm-card,#fff)",
          transition: "all 0.15s",
        }}
      >
        <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#f5f3ff", border: "1px solid #ddd6fe", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
          <Upload size={20} color="#7c3aed" />
        </div>
        <p style={{ fontFamily: F, fontWeight: 700, fontSize: "0.92rem", color: "var(--adm-text,#111)", margin: "0 0 4px" }}>
          {importing ? "Importando..." : "Subir CSV de BCI"}
        </p>
        <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text3,#999)", margin: 0 }}>
          Desde BCI web → Cartola → Descargar CSV. Arrastra o haz clic.
        </p>
      </div>

      {/* Import feedback */}
      {importResult && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, marginBottom: 16 }}>
          <CheckCircle size={18} color="#22c55e" />
          <span style={{ fontFamily: FB, fontSize: "0.88rem", color: "#15803d" }}>
            {importResult.created} movimientos importados{importResult.skipped > 0 ? `, ${importResult.skipped} ya existían` : ""}
          </span>
        </div>
      )}
      {importError && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 10, marginBottom: 16 }}>
          <AlertCircle size={18} color="#ef4444" />
          <span style={{ fontFamily: FB, fontSize: "0.88rem", color: "#dc2626" }}>{importError}</span>
        </div>
      )}

      {/* Movements table */}
      {movements.length === 0 && loaded && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--adm-text3,#999)", fontFamily: FB, fontSize: "0.88rem" }}>
          <Landmark size={32} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
          Sin movimientos para este mes. Sube el CSV de BCI.
        </div>
      )}

      {pending.length > 0 && (
        <Section title={`Sin categorizar (${pending.length})`}>
          {pending.map((m) => (
            <MovRow key={m.id} m={m} categories={categories} assigning={assigning} onAssign={assign} onDelete={deleteMovement} />
          ))}
        </Section>
      )}

      {reconciled.length > 0 && (
        <Section title={`Conciliados (${reconciled.length})`} dimTitle>
          {reconciled.map((m) => (
            <MovRow key={m.id} m={m} categories={categories} assigning={assigning} onAssign={assign} onDelete={deleteMovement} />
          ))}
        </Section>
      )}
    </div>
  );
}

function KPI({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{ padding: "14px 16px", background: "var(--adm-card,#fff)", border: "1px solid var(--adm-card-border,#f0f0f0)", borderRadius: 14 }}>
      <p style={{ fontFamily: "var(--font-display,system-ui)", fontSize: "0.65rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--adm-text3,#999)", margin: "0 0 4px" }}>{label}</p>
      <p style={{ fontFamily: "var(--font-display,system-ui)", fontSize: "1.3rem", fontWeight: 800, color, margin: "0 0 2px" }}>{value}</p>
      {sub && <p style={{ fontFamily: "var(--font-body,system-ui)", fontSize: "0.75rem", color: "var(--adm-text3,#aaa)", margin: 0 }}>{sub}</p>}
    </div>
  );
}

function Section({ title, children, dimTitle }: { title: string; children: React.ReactNode; dimTitle?: boolean }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ fontFamily: "var(--font-display,system-ui)", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: dimTitle ? "var(--adm-text3,#aaa)" : "var(--adm-text2,#666)", margin: "0 0 10px" }}>{title}</p>
      <div style={{ background: "var(--adm-card,#fff)", border: "1px solid var(--adm-card-border,#f0f0f0)", borderRadius: 14, overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

function MovRow({ m, categories, assigning, onAssign, onDelete }: {
  m: Movement;
  categories: Category[];
  assigning: string | null;
  onAssign: (id: string, catId: string | null) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const cat = m.entry?.category;
  const isExpense = m.amount < 0;
  const relevant = categories.filter(c => c.type === (isExpense ? "EXPENSE" : "INCOME"));

  return (
    <div style={{ borderBottom: "1px solid var(--adm-card-border,#f0f0f0)", padding: "10px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Date */}
        <span style={{ fontFamily: "var(--font-body,system-ui)", fontSize: "0.78rem", color: "var(--adm-text3,#999)", minWidth: 44, flexShrink: 0 }}>{fmtDate(m.date)}</span>

        {/* Description */}
        <span style={{ fontFamily: "var(--font-body,system-ui)", fontSize: "0.82rem", color: "var(--adm-text,#111)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.description}</span>

        {/* Amount */}
        <span style={{ fontFamily: "var(--font-display,system-ui)", fontWeight: 700, fontSize: "0.88rem", color: isExpense ? "#ef4444" : "#22c55e", minWidth: 90, textAlign: "right", flexShrink: 0 }}>
          {isExpense ? "-" : "+"}{fmtClp(m.amount)}
        </span>

        {/* Category badge / assign button */}
        {cat ? (
          <button
            onClick={() => onAssign(m.id, null)}
            style={{ fontFamily: "var(--font-body,system-ui)", fontSize: "0.74rem", padding: "3px 8px", borderRadius: 20, background: cat.color ? cat.color + "22" : "#f3f4f6", border: `1px solid ${cat.color || "#ddd"}`, color: cat.color || "#333", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}
            title="Click para quitar categoría"
          >
            {cat.icon} {cat.name}
          </button>
        ) : (
          <button
            onClick={() => setOpen(!open)}
            style={{ fontFamily: "var(--font-body,system-ui)", fontSize: "0.74rem", padding: "3px 10px", borderRadius: 20, background: "var(--adm-bg,#f9fafb)", border: "1px dashed var(--adm-card-border,#ddd)", color: "var(--adm-text3,#999)", cursor: "pointer", flexShrink: 0 }}
          >
            + categoría
          </button>
        )}

        {/* Delete */}
        <button onClick={() => onDelete(m.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--adm-text3,#ccc)", padding: 2, flexShrink: 0 }}>
          <X size={14} />
        </button>
      </div>

      {/* Category selector dropdown */}
      {open && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--adm-card-border,#f0f0f0)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {relevant.map((c) => (
              <button
                key={c.id}
                disabled={assigning === m.id}
                onClick={() => { onAssign(m.id, c.id); setOpen(false); }}
                style={{ fontFamily: "var(--font-body,system-ui)", fontSize: "0.78rem", padding: "4px 10px", borderRadius: 20, background: c.color ? c.color + "18" : "#f3f4f6", border: `1px solid ${c.color || "#ddd"}`, color: c.color || "#333", cursor: "pointer" }}
              >
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
