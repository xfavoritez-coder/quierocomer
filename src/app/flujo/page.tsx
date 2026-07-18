"use client";
import { useState, useEffect, useRef } from "react";

type Gasto = { id: string; monto: number; comentario: string; createdAt: string };

const ACCENT = "#F4A623";
const BG = "#0a0500";
const CARD = "rgba(255,255,255,0.04)";
const BORDER = "rgba(232,168,76,0.18)";
const MUTED = "rgba(240,234,214,0.35)";
const TEXT = "rgba(240,234,214,0.9)";
const F_DISPLAY = "var(--font-display, 'Space Grotesk', sans-serif)";
const F_BODY = "var(--font-body, 'Inter', sans-serif)";

function formatCLP(n: number) {
  return "$" + n.toLocaleString("es-CL");
}

function formatFecha(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" }) +
    " · " + d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

function totalDelDia(gastos: Gasto[]) {
  const hoy = new Date().toDateString();
  return gastos.filter(g => new Date(g.createdAt).toDateString() === hoy).reduce((s, g) => s + g.monto, 0);
}

export default function FlujoPage() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [monto, setMonto] = useState("");
  const [comentario, setComentario] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const montoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/flujo/gastos").then(r => r.json()).then(setGastos).catch(() => {});
  }, []);

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
        body: JSON.stringify({ monto: montoNum, comentario: comentario.trim() }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Error"); setLoading(false); return; }
      const nuevo = await res.json();
      setGastos(prev => [nuevo, ...prev]);
      setMonto("");
      setComentario("");
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
    const raw = e.target.value.replace(/\D/g, "");
    setMonto(raw);
  }

  const montoDisplay = monto ? formatCLP(parseInt(monto, 10)) : "";
  const todayTotal = totalDelDia(gastos);

  return (
    <main style={{ background: BG, minHeight: "100vh", padding: "0 0 80px", fontFamily: F_BODY }}>
      {/* Header */}
      <div style={{ background: "rgba(10,5,0,0.95)", borderBottom: `1px solid ${BORDER}`, padding: "20px 20px 16px", position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(12px)" }}>
        <p style={{ fontFamily: F_DISPLAY, fontSize: "0.65rem", letterSpacing: "0.25em", textTransform: "uppercase", color: MUTED, margin: "0 0 2px" }}>Horys Vegan</p>
        <h1 style={{ fontFamily: F_DISPLAY, fontSize: "1.4rem", color: ACCENT, margin: 0, fontWeight: 700 }}>Flujo de Caja</h1>
        {todayTotal > 0 && (
          <p style={{ fontFamily: F_BODY, fontSize: "0.8rem", color: MUTED, margin: "6px 0 0" }}>
            Hoy: <span style={{ color: TEXT, fontWeight: 600 }}>{formatCLP(todayTotal)}</span>
          </p>
        )}
      </div>

      <div style={{ padding: "24px 20px 0", maxWidth: "480px", margin: "0 auto" }}>

        {/* Form */}
        <form onSubmit={handleSubmit} style={cardS}>
          <label style={labelS}>Monto</label>
          <input
            ref={montoRef}
            inputMode="numeric"
            placeholder="$0"
            value={montoDisplay}
            onChange={handleMontoChange}
            onFocus={focusIn}
            onBlur={focusOut}
            style={montoInputS}
            autoFocus
          />

          <label style={{ ...labelS, marginTop: "20px" }}>Detalle del gasto</label>
          <textarea
            placeholder="¿Qué se compró? Ej: Ferretería — 2 llaves y cinta"
            value={comentario}
            onChange={e => setComentario(e.target.value)}
            rows={3}
            onFocus={e => { e.target.style.borderColor = ACCENT; }}
            onBlur={e => { e.target.style.borderColor = BORDER; }}
            style={textareaS}
          />

          {error && (
            <p style={{ fontFamily: F_BODY, fontSize: "0.82rem", color: "#ff6b6b", margin: "10px 0 0" }}>⚠️ {error}</p>
          )}

          <button
            type="submit"
            disabled={loading || success}
            style={{ ...btnS, ...(success ? { background: "#2a9d6b" } : {}) }}
          >
            {success ? "✓ Guardado" : loading ? "Guardando..." : "Registrar gasto"}
          </button>
        </form>

        {/* Lista de gastos */}
        {gastos.length > 0 && (
          <div style={{ marginTop: "28px" }}>
            <p style={{ fontFamily: F_DISPLAY, fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase", color: MUTED, margin: "0 0 12px" }}>Historial</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {gastos.map(g => (
                <GastoRow key={g.id} gasto={g} onDelete={handleDelete} deleting={deletingId === g.id} />
              ))}
            </div>
          </div>
        )}

        {gastos.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0", color: MUTED }}>
            <p style={{ fontSize: "2rem", margin: "0 0 8px" }}>💸</p>
            <p style={{ fontFamily: F_BODY, fontSize: "0.85rem" }}>Aún no hay gastos registrados</p>
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
        <p style={{ fontFamily: F_DISPLAY, fontSize: "1.05rem", color: ACCENT, margin: "0 0 3px", fontWeight: 700 }}>
          {formatCLP(gasto.monto)}
        </p>
        <p style={{ fontFamily: F_BODY, fontSize: "0.85rem", color: TEXT, margin: "0 0 4px", lineHeight: 1.4, wordBreak: "break-word" }}>
          {gasto.comentario}
        </p>
        <p style={{ fontFamily: F_BODY, fontSize: "0.72rem", color: MUTED, margin: 0, textTransform: "capitalize" }}>
          {formatFecha(gasto.createdAt)}
        </p>
      </div>
      <div style={{ marginLeft: "12px", flexShrink: 0 }}>
        {confirmando ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <button
              onClick={() => { setConfirmando(false); onDelete(gasto.id); }}
              disabled={deleting}
              style={{ padding: "5px 10px", background: "rgba(255,80,80,0.15)", border: "1px solid rgba(255,80,80,0.4)", borderRadius: "8px", color: "#ff6b6b", fontFamily: F_BODY, fontSize: "0.75rem", cursor: "pointer" }}
            >
              {deleting ? "..." : "Sí, borrar"}
            </button>
            <button
              onClick={() => setConfirmando(false)}
              style={{ padding: "5px 10px", background: "transparent", border: `1px solid ${BORDER}`, borderRadius: "8px", color: MUTED, fontFamily: F_BODY, fontSize: "0.75rem", cursor: "pointer" }}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmando(true)}
            style={{ padding: "6px 10px", background: "transparent", border: `1px solid ${BORDER}`, borderRadius: "8px", color: MUTED, fontFamily: F_BODY, fontSize: "0.8rem", cursor: "pointer" }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Estilos ─────────────────────────────────────────────────

const cardS: React.CSSProperties = {
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: "20px",
  padding: "24px 20px",
};

const labelS: React.CSSProperties = {
  fontFamily: F_DISPLAY,
  fontSize: "0.65rem",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: MUTED,
  display: "block",
  marginBottom: "8px",
};

const montoInputS: React.CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  background: "rgba(255,255,255,0.05)",
  border: `1px solid ${BORDER}`,
  borderRadius: "12px",
  color: ACCENT,
  fontFamily: F_DISPLAY,
  fontSize: "1.8rem",
  fontWeight: 700,
  outline: "none",
  boxSizing: "border-box",
  letterSpacing: "0.02em",
  transition: "border-color 0.2s",
};

const textareaS: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  background: "rgba(255,255,255,0.05)",
  border: `1px solid ${BORDER}`,
  borderRadius: "12px",
  color: TEXT,
  fontFamily: F_BODY,
  fontSize: "0.95rem",
  outline: "none",
  boxSizing: "border-box",
  resize: "none",
  lineHeight: 1.5,
  transition: "border-color 0.2s",
};

const btnS: React.CSSProperties = {
  width: "100%",
  marginTop: "20px",
  padding: "15px",
  background: ACCENT,
  border: "none",
  borderRadius: "12px",
  fontFamily: F_DISPLAY,
  fontSize: "0.85rem",
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  color: BG,
  fontWeight: 700,
  cursor: "pointer",
  transition: "background 0.2s, opacity 0.2s",
};

const rowS: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: "14px",
  padding: "14px 16px",
};

const focusIn = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = ACCENT; };
const focusOut = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = BORDER; };
