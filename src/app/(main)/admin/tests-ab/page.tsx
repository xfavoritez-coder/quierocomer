"use client";

import { useState, useEffect, useCallback } from "react";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

interface Variant {
  id: string;
  text: string;
  isActive: boolean;
  impressions: number;
  conversions: number;
  conversionRate: number;
  trafficSharePct: number;
}

interface Experiment {
  slug: string;
  name: string;
  isActive: boolean;
  slots: { title: Variant[]; subtitle: Variant[]; cta: Variant[] };
  currentBest: { title: Variant | null; subtitle: Variant | null; cta: Variant | null };
}

const SLOT_LABEL: Record<string, string> = { title: "Título", subtitle: "Subtítulo", cta: "Botón (CTA)" };

export default function TestsAbPage() {
  const [data, setData] = useState<{ experiments: Experiment[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState<{ slug: string; slot: string } | null>(null);
  const [newText, setNewText] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/ab-tests")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const addVariant = async (slug: string, slot: string) => {
    if (!newText.trim()) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/ab-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experimentSlug: slug, slot, text: newText.trim() }),
      });
      if (r.ok) { setNewText(""); setAdding(null); load(); }
    } finally { setBusy(false); }
  };

  const toggleVariant = async (variantId: string, isActive: boolean) => {
    setBusy(true);
    try {
      await fetch(`/api/admin/ab-tests/variants/${variantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      load();
    } finally { setBusy(false); }
  };

  const deleteVariant = async (variantId: string) => {
    if (!confirm("Eliminar esta variante? Se perderá su historial.")) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/ab-tests/variants/${variantId}`, { method: "DELETE" });
      load();
    } finally { setBusy(false); }
  };

  if (loading) return <div style={{ padding: 24, color: "var(--adm-text3)", fontFamily: F }}>Cargando experimentos...</div>;
  if (!data || data.experiments.length === 0) return <div style={{ padding: 24, color: "var(--adm-text3)", fontFamily: F }}>No hay experimentos activos.</div>;

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: "var(--adm-accent)", margin: 0 }}>🧪 Tests A/B</h1>
        <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "4px 0 0" }}>
          Optimización en vivo con Thompson Sampling — el sistema asigna más tráfico a las opciones que mejor convierten.
        </p>
      </div>

      {data.experiments.map((exp) => (
        <div key={exp.slug} style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "18px 20px", marginBottom: 18, boxShadow: "var(--adm-card-shadow, none)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            <div>
              <h2 style={{ fontFamily: F, fontSize: "1.05rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>{exp.name}</h2>
              <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>Slug: {exp.slug}</p>
            </div>
            <span style={{ padding: "4px 10px", borderRadius: 50, background: exp.isActive ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: exp.isActive ? "#16a34a" : "#ef4444", fontSize: "0.72rem", fontWeight: 600, fontFamily: F }}>
              {exp.isActive ? "● Activo" : "○ Pausado"}
            </span>
          </div>

          {/* Best combination so far */}
          <div style={{ background: "rgba(244,166,35,0.05)", border: "1px solid rgba(244,166,35,0.18)", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
            <p style={{ fontFamily: F, fontSize: "0.72rem", fontWeight: 700, color: GOLD, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Combinación ganadora ahora</p>
            <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)", margin: "0 0 4px", fontWeight: 600 }}>
              {exp.currentBest.title?.text || <span style={{ color: "var(--adm-text3)" }}>(sin título)</span>}
            </p>
            <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 6px" }}>
              {exp.currentBest.subtitle?.text || <span style={{ color: "var(--adm-text3)" }}>(sin subtítulo)</span>}
            </p>
            <span style={{ display: "inline-block", padding: "5px 12px", borderRadius: 50, background: GOLD, color: "white", fontFamily: F, fontSize: "0.74rem", fontWeight: 600 }}>
              {exp.currentBest.cta?.text || "(sin CTA)"}
            </span>
          </div>

          {/* Slots */}
          {(["title", "subtitle", "cta"] as const).map((slot) => (
            <SlotSection
              key={slot}
              slot={slot}
              variants={exp.slots[slot] || []}
              addingHere={adding?.slug === exp.slug && adding?.slot === slot}
              onStartAdd={() => { setAdding({ slug: exp.slug, slot }); setNewText(""); }}
              onCancelAdd={() => { setAdding(null); setNewText(""); }}
              newText={newText}
              setNewText={setNewText}
              onAdd={() => addVariant(exp.slug, slot)}
              onToggle={toggleVariant}
              onDelete={deleteVariant}
              busy={busy}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function SlotSection({
  slot, variants, addingHere, onStartAdd, onCancelAdd, newText, setNewText, onAdd, onToggle, onDelete, busy,
}: {
  slot: "title" | "subtitle" | "cta";
  variants: Variant[];
  addingHere: boolean;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  newText: string;
  setNewText: (t: string) => void;
  onAdd: () => void;
  onToggle: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
  busy: boolean;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <h3 style={{ fontFamily: F, fontSize: "0.84rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>
          {SLOT_LABEL[slot]} <span style={{ color: "var(--adm-text3)", fontWeight: 400, fontSize: "0.72rem" }}>({variants.filter((v) => v.isActive).length} activas / {variants.length})</span>
        </h3>
        {!addingHere && (
          <button onClick={onStartAdd} style={{ padding: "6px 14px", background: "transparent", border: "1px dashed var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.72rem", color: GOLD, cursor: "pointer", fontWeight: 600 }}>
            + Agregar variante
          </button>
        )}
      </div>

      {addingHere && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder={`Nuevo texto para ${SLOT_LABEL[slot].toLowerCase()}`}
            autoFocus
            style={{ flex: 1, padding: "8px 12px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text)", outline: "none" }}
          />
          <button onClick={onAdd} disabled={busy || !newText.trim()} style={{ padding: "8px 14px", background: GOLD, color: "white", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.74rem", fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: !newText.trim() ? 0.5 : 1 }}>Guardar</button>
          <button onClick={onCancelAdd} style={{ padding: "8px 12px", background: "transparent", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.74rem", color: "var(--adm-text3)", cursor: "pointer" }}>Cancelar</button>
        </div>
      )}

      {variants.length === 0 ? (
        <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", padding: "12px 0" }}>Sin variantes todavía.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: "0.78rem", borderCollapse: "collapse", fontFamily: FB }}>
            <thead>
              <tr style={{ color: "var(--adm-text3)", borderBottom: "1px solid var(--adm-card-border)" }}>
                <th style={{ padding: "8px 6px", textAlign: "left", fontWeight: 600 }}>Texto</th>
                <th style={{ padding: "8px 6px", textAlign: "right", fontWeight: 600 }}>Tráfico</th>
                <th style={{ padding: "8px 6px", textAlign: "right", fontWeight: 600 }}>Impresiones</th>
                <th style={{ padding: "8px 6px", textAlign: "right", fontWeight: 600 }}>Conversiones</th>
                <th style={{ padding: "8px 6px", textAlign: "right", fontWeight: 600 }}>Tasa</th>
                <th style={{ padding: "8px 6px", textAlign: "right", fontWeight: 600 }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => {
                const tasa = v.impressions > 0 ? (v.conversions / v.impressions) * 100 : 0;
                return (
                  <tr key={v.id} style={{ borderBottom: "1px dashed var(--adm-card-border)", opacity: v.isActive ? 1 : 0.5 }}>
                    <td style={{ padding: "10px 6px", color: "var(--adm-text)" }}>{v.text}</td>
                    <td style={{ padding: "10px 6px", textAlign: "right", color: GOLD, fontWeight: 600 }}>
                      {v.isActive ? `${v.trafficSharePct}%` : "—"}
                    </td>
                    <td style={{ padding: "10px 6px", textAlign: "right", color: "var(--adm-text2)" }}>{v.impressions}</td>
                    <td style={{ padding: "10px 6px", textAlign: "right", color: "var(--adm-text2)" }}>{v.conversions}</td>
                    <td style={{ padding: "10px 6px", textAlign: "right", color: tasa > 0 ? "#16a34a" : "var(--adm-text3)", fontWeight: 600 }}>
                      {v.impressions > 0 ? `${tasa.toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ padding: "10px 6px", textAlign: "right" }}>
                      <button
                        onClick={() => onToggle(v.id, !v.isActive)}
                        disabled={busy}
                        style={{ padding: "4px 10px", background: v.isActive ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.7rem", fontWeight: 600, color: v.isActive ? "#16a34a" : "#ef4444", cursor: "pointer", marginRight: 4 }}
                      >
                        {v.isActive ? "Activa" : "Pausada"}
                      </button>
                      <button
                        onClick={() => onDelete(v.id)}
                        disabled={busy}
                        title="Eliminar variante"
                        style={{ padding: "4px 8px", background: "transparent", border: "1px solid var(--adm-card-border)", borderRadius: 6, fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text3)", cursor: "pointer" }}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
