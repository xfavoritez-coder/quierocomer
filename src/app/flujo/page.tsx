"use client";
import { useState, useEffect, useRef } from "react";

type Gasto = { id: string; monto: number; comentario: string; createdAt: string };
type Category = { id: string; name: string; type: string; color: string | null; icon: string | null; position: number };

const ACCENT = "#F4A623";
const BG = "#0a0500";
const CARD = "rgba(255,255,255,0.04)";
const BORDER = "rgba(232,168,76,0.18)";
const MUTED = "rgba(240,234,214,0.35)";
const TEXT = "rgba(240,234,214,0.9)";
const F_DISPLAY = "var(--font-display, 'Space Grotesk', sans-serif)";
const F_BODY = "var(--font-body, 'Inter', sans-serif)";
const HORUS_ID = "cmo31qnls0000k004o6ry1wgq";

const RECENT_KEY = "flujo_recent_cats";
const MAX_RECENT = 4;

function formatCLP(n: number) { return "$" + n.toLocaleString("es-CL"); }
function formatFecha(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" }) +
    " · " + d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}
function totalDelDia(gastos: Gasto[]) {
  const hoy = new Date().toDateString();
  return gastos.filter(g => new Date(g.createdAt).toDateString() === hoy).reduce((s, g) => s + g.monto, 0);
}
function getRecentCatIds(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
}
function pushRecentCat(id: string) {
  const prev = getRecentCatIds().filter(x => x !== id);
  localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...prev].slice(0, MAX_RECENT)));
}

export default function FlujoPage() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [monto, setMonto] = useState("");
  const [comentario, setComentario] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const montoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/flujo/gastos").then(r => r.json()).then(setGastos).catch(() => {});
    // Cargar categorías de Horus (EXPENSE primero, que es lo más común en /flujo)
    fetch(`/api/admin/financial/categories?restaurantId=${HORUS_ID}`)
      .then(r => r.json())
      .then((cats: Category[]) => {
        setCategories(cats);
        setRecentIds(getRecentCatIds());
      })
      .catch(() => {});
  }, []);

  // Ordenar categorías: recientes primero, luego por posición
  const sortedCats = [...categories].sort((a, b) => {
    const ai = recentIds.indexOf(a.id);
    const bi = recentIds.indexOf(b.id);
    if (ai !== -1 && bi === -1) return -1;
    if (bi !== -1 && ai === -1) return 1;
    if (ai !== -1 && bi !== -1) return ai - bi;
    return a.position - b.position;
  });
  const expenseCats = sortedCats.filter(c => c.type === "EXPENSE");
  const incomeCats = sortedCats.filter(c => c.type === "INCOME");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const montoNum = parseInt(monto.replace(/\D/g, ""), 10);
    if (!montoNum || montoNum <= 0) return setError("Ingresa un monto válido.");
    if (!comentario.trim()) return setError("Agrega un comentario.");
    setLoading(true);
    try {
      const res = await fetch("/api/flujo/gastos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monto: montoNum, comentario: comentario.trim(), categoryId: categoryId || null }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Error"); setLoading(false); return; }
      const nuevo = await res.json();
      setGastos(prev => [nuevo, ...prev]);
      if (categoryId) { pushRecentCat(categoryId); setRecentIds(getRecentCatIds()); }
      setMonto(""); setComentario(""); setCategoryId("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      montoRef.current?.focus();
    } catch { setError("Error de conexión"); }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await fetch("/api/flujo/gastos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setGastos(prev => prev.filter(g => g.id !== id));
    setDeletingId(null);
  }

  function handleMontoChange(e: React.ChangeEvent<HTMLInputElement>) {
    setMonto(e.target.value.replace(/\D/g, ""));
  }

  const montoDisplay = monto ? formatCLP(parseInt(monto, 10)) : "";
  const todayTotal = totalDelDia(gastos);
  const selectedCat = categories.find(c => c.id === categoryId);

  return (
    <main style={{ background: BG, minHeight: "100vh", padding: "0 0 80px", fontFamily: F_BODY }}>
      <style>{`
        .flujo-input::placeholder, .flujo-textarea::placeholder { color: rgba(240,234,214,0.2) !important; }
        .flujo-chip { transition: all 0.15s ease; }
        .flujo-chip:active { transform: scale(0.96); }
      `}</style>

      {/* Header */}
      <div style={{ background: "rgba(10,5,0,0.95)", borderBottom: `1px solid ${BORDER}`, padding: "20px 20px 16px", position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(12px)" }}>
        <p style={{ fontFamily: F_DISPLAY, fontSize: "0.65rem", letterSpacing: "0.25em", textTransform: "uppercase", color: MUTED, margin: "0 0 2px" }}>HORUS</p>
        <h1 style={{ fontFamily: F_DISPLAY, fontSize: "1.4rem", color: ACCENT, margin: 0, fontWeight: 700 }}>Flujo de Caja</h1>
        {todayTotal > 0 && (
          <p style={{ fontFamily: F_BODY, fontSize: "0.8rem", color: MUTED, margin: "6px 0 0" }}>
            Hoy: <span style={{ color: TEXT, fontWeight: 600 }}>{formatCLP(todayTotal)}</span>
          </p>
        )}
      </div>

      <div style={{ padding: "24px 20px 0", maxWidth: "480px", margin: "0 auto" }}>
        <form onSubmit={handleSubmit} style={cardS}>

          {/* Monto */}
          <label style={labelS}>Monto</label>
          <input
            ref={montoRef}
            inputMode="numeric"
            placeholder="$0"
            value={montoDisplay}
            onChange={handleMontoChange}
            onFocus={focusIn}
            onBlur={focusOut}
            className="flujo-input"
            style={montoInputS}
            autoFocus
          />

          {/* Categoría — chips */}
          {expenseCats.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <label style={labelS}>Categoría de gasto</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {expenseCats.map(cat => {
                  const isSelected = cat.id === categoryId;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      className="flujo-chip"
                      onClick={() => setCategoryId(isSelected ? "" : cat.id)}
                      style={{
                        padding: "6px 12px", borderRadius: 999, border: `1px solid ${isSelected ? (cat.color || ACCENT) : BORDER}`,
                        background: isSelected ? (cat.color ? `${cat.color}22` : "rgba(244,166,35,0.12)") : "rgba(255,255,255,0.04)",
                        color: isSelected ? (cat.color || ACCENT) : MUTED,
                        fontFamily: F_BODY, fontSize: "0.8rem", fontWeight: isSelected ? 700 : 400,
                        cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                      }}
                    >
                      {cat.icon && <span style={{ fontSize: 13 }}>{cat.icon}</span>}
                      {cat.name}
                    </button>
                  );
                })}
              </div>
              {/* Ingresos también disponibles */}
              {incomeCats.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <p style={{ fontFamily: F_DISPLAY, fontSize: "0.6rem", letterSpacing: "0.15em", textTransform: "uppercase", color: MUTED, margin: "0 0 7px", opacity: 0.6 }}>Ingresos</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {incomeCats.map(cat => {
                      const isSelected = cat.id === categoryId;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          className="flujo-chip"
                          onClick={() => setCategoryId(isSelected ? "" : cat.id)}
                          style={{
                            padding: "6px 12px", borderRadius: 999, border: `1px solid ${isSelected ? "#22c55e" : BORDER}`,
                            background: isSelected ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)",
                            color: isSelected ? "#22c55e" : MUTED,
                            fontFamily: F_BODY, fontSize: "0.8rem", fontWeight: isSelected ? 700 : 400,
                            cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                          }}
                        >
                          {cat.icon && <span style={{ fontSize: 13 }}>{cat.icon}</span>}
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Detalle */}
          <label style={{ ...labelS, marginTop: "18px" }}>Detalle del movimiento</label>
          <textarea
            placeholder={selectedCat ? `Detalle de ${selectedCat.name}... ej: proveedor, referencia` : "¿Qué fue? Ej: Ferretería — 2 llaves y cinta"}
            value={comentario}
            onChange={e => setComentario(e.target.value)}
            rows={3}
            onFocus={e => { e.target.style.borderColor = ACCENT; }}
            onBlur={e => { e.target.style.borderColor = BORDER; }}
            className="flujo-textarea"
            style={textareaS}
          />

          {error && <p style={{ fontFamily: F_BODY, fontSize: "0.82rem", color: "#ff6b6b", margin: "10px 0 0" }}>⚠️ {error}</p>}

          <button
            type="submit"
            disabled={loading || success}
            style={{ ...btnS, ...(success ? { background: "#2a9d6b" } : {}) }}
          >
            {success ? "✓ Guardado" : loading ? "Guardando..." : selectedCat ? `Registrar — ${selectedCat.icon || ""} ${selectedCat.name}` : "Registrar movimiento"}
          </button>
        </form>

        {/* Historial */}
        {gastos.length > 0 && (
          <div style={{ marginTop: "28px" }}>
            <p style={{ fontFamily: F_DISPLAY, fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase", color: MUTED, margin: "0 0 12px" }}>Historial</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {gastos.map(g => <GastoRow key={g.id} gasto={g} onDelete={handleDelete} deleting={deletingId === g.id} />)}
            </div>
          </div>
        )}

        {gastos.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0", color: MUTED }}>
            <p style={{ fontSize: "2rem", margin: "0 0 8px" }}>💸</p>
            <p style={{ fontFamily: F_BODY, fontSize: "0.85rem" }}>Aún no hay movimientos registrados</p>
          </div>
        )}
      </div>
    </main>
  );
}

function GastoRow({ gasto, onDelete, deleting }: { gasto: Gasto; onDelete: (id: string) => void; deleting: boolean }) {
  const [confirmando, setConfirmando] = useState(false);
  return (
    <div style={rowS}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: F_DISPLAY, fontSize: "1.05rem", color: ACCENT, margin: "0 0 3px", fontWeight: 700 }}>{formatCLP(gasto.monto)}</p>
        <p style={{ fontFamily: F_BODY, fontSize: "0.85rem", color: TEXT, margin: "0 0 4px", lineHeight: 1.4, wordBreak: "break-word" }}>{gasto.comentario}</p>
        <p style={{ fontFamily: F_BODY, fontSize: "0.72rem", color: MUTED, margin: 0, textTransform: "capitalize" }}>{formatFecha(gasto.createdAt)}</p>
      </div>
      <div style={{ marginLeft: "12px", flexShrink: 0 }}>
        {confirmando ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <button onClick={() => { setConfirmando(false); onDelete(gasto.id); }} disabled={deleting}
              style={{ padding: "5px 10px", background: "rgba(255,80,80,0.15)", border: "1px solid rgba(255,80,80,0.4)", borderRadius: "8px", color: "#ff6b6b", fontFamily: F_BODY, fontSize: "0.75rem", cursor: "pointer" }}>
              {deleting ? "..." : "Sí, borrar"}
            </button>
            <button onClick={() => setConfirmando(false)}
              style={{ padding: "5px 10px", background: "transparent", border: `1px solid ${BORDER}`, borderRadius: "8px", color: MUTED, fontFamily: F_BODY, fontSize: "0.75rem", cursor: "pointer" }}>
              Cancelar
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmando(true)}
            style={{ padding: "6px 10px", background: "transparent", border: `1px solid ${BORDER}`, borderRadius: "8px", color: MUTED, fontFamily: F_BODY, fontSize: "0.8rem", cursor: "pointer" }}>✕</button>
        )}
      </div>
    </div>
  );
}

const cardS: React.CSSProperties = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: "20px", padding: "24px 20px" };
const labelS: React.CSSProperties = { fontFamily: F_DISPLAY, fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase", color: MUTED, display: "block", marginBottom: "8px" };
const montoInputS: React.CSSProperties = { width: "100%", padding: "14px 16px", background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}`, borderRadius: "12px", color: ACCENT, fontFamily: F_DISPLAY, fontSize: "1.8rem", fontWeight: 700, outline: "none", boxSizing: "border-box", letterSpacing: "0.02em", transition: "border-color 0.2s" };
const textareaS: React.CSSProperties = { width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}`, borderRadius: "12px", color: TEXT, fontFamily: F_BODY, fontSize: "0.95rem", outline: "none", boxSizing: "border-box", resize: "none", lineHeight: 1.5, transition: "border-color 0.2s" };
const btnS: React.CSSProperties = { width: "100%", marginTop: "20px", padding: "15px", background: ACCENT, border: "none", borderRadius: "12px", fontFamily: F_DISPLAY, fontSize: "0.85rem", letterSpacing: "0.1em", textTransform: "uppercase", color: BG, fontWeight: 700, cursor: "pointer", transition: "background 0.2s" };
const rowS: React.CSSProperties = { display: "flex", alignItems: "flex-start", background: CARD, border: `1px solid ${BORDER}`, borderRadius: "14px", padding: "14px 16px" };
const focusIn = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = ACCENT; };
const focusOut = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = BORDER; };
