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
  deepConversions: number;
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
    if (!newText.trim() && slot !== "subtitle") return;
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

  const exp = data?.experiments.find(e => e.slug === "landing-hero");

  if (loading) return <div style={{ padding: 24, color: "var(--adm-text3)", fontFamily: F }}>Cargando...</div>;
  if (!exp) return <div style={{ padding: 24, color: "var(--adm-text3)", fontFamily: F }}>Experimento landing-hero no encontrado.</div>;

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: "var(--adm-accent)", margin: 0 }}>🧪 A/B Test — Landing Hero</h1>
        <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "4px 0 0" }}>
          Thompson Sampling asigna más tráfico a las variantes que mejor convierten. Impresión = visita a /, Conversión = click en el CTA.
        </p>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        <span style={{ padding: "5px 12px", borderRadius: 50, background: exp.isActive ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: exp.isActive ? "#16a34a" : "#ef4444", fontSize: "0.74rem", fontWeight: 700, fontFamily: F }}>
          {exp.isActive ? "● Activo" : "○ Pausado"}
        </span>
        {(["title"] as const).map(slot => {
          const best = exp.currentBest[slot];
          if (!best) return null;
          return (
            <div key={slot} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 14px", borderRadius: 50, background: "rgba(244,166,35,0.08)", border: "1px solid rgba(244,166,35,0.2)" }}>
              <span style={{ fontSize: "0.68rem", color: GOLD, fontWeight: 700, fontFamily: F, textTransform: "uppercase" }}>{SLOT_LABEL[slot]} ganando</span>
              <span style={{ padding: "2px 8px", borderRadius: 50, background: GOLD, color: "#fff", fontFamily: F, fontSize: "0.73rem", fontWeight: 700, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{best.text}</span>
            </div>
          );
        })}
      </div>

      {/* CTA fijo — ganó "Subir mi carta →", no se A/B testea más */}
      <div style={{ marginBottom: 20, padding: "10px 14px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 10, fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)" }}>
        <strong style={{ color: "#16a34a" }}>Botón CTA fijo:</strong> &nbsp;"Subir mi carta →" — ganó el test, ya no rota variantes.
      </div>

      {(["title", "subtitle"] as const).map(slot => (
        <SlotSection
          key={slot}
          slot={slot}
          variants={exp.slots[slot] || []}
          addingHere={adding?.slug === "landing-hero" && adding?.slot === slot}
          onStartAdd={() => { setAdding({ slug: "landing-hero", slot }); setNewText(""); }}
          onCancelAdd={() => { setAdding(null); setNewText(""); }}
          newText={newText}
          setNewText={setNewText}
          onAdd={() => addVariant("landing-hero", slot)}
          onToggle={toggleVariant}
          onDelete={deleteVariant}
          busy={busy}
        />
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
            placeholder={slot === "subtitle" ? `Texto o vacío (sin subtítulo)` : `Nuevo texto para ${SLOT_LABEL[slot].toLowerCase()}`}
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
                <th style={{ padding: "8px 6px", textAlign: "right", fontWeight: 600 }}>Conv</th>
                <th style={{ padding: "8px 6px", textAlign: "right", fontWeight: 600, color: "#a855f7" }}>Leads</th>
                <th style={{ padding: "8px 6px", textAlign: "right", fontWeight: 600 }}>Tasa</th>
                <th style={{ padding: "8px 6px", textAlign: "right", fontWeight: 600 }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => {
                const tasa = v.impressions > 0 ? (v.conversions / v.impressions) * 100 : 0;
                return (
                  <tr key={v.id} style={{ borderBottom: "1px dashed var(--adm-card-border)", opacity: v.isActive ? 1 : 0.5 }}>
                    <td style={{ padding: "10px 6px", color: v.text ? "var(--adm-text)" : "var(--adm-text3)", fontStyle: v.text ? "normal" : "italic" }}>{v.text || "(sin subtítulo)"}</td>
                    <td style={{ padding: "10px 6px", textAlign: "right", color: GOLD, fontWeight: 600 }}>
                      {v.isActive ? `${v.trafficSharePct}%` : "—"}
                    </td>
                    <td style={{ padding: "10px 6px", textAlign: "right", color: "var(--adm-text2)" }}>{v.impressions}</td>
                    <td style={{ padding: "10px 6px", textAlign: "right", color: "var(--adm-text2)" }}>{v.conversions}</td>
                    <td style={{ padding: "10px 6px", textAlign: "right", color: v.deepConversions > 0 ? "#a855f7" : "var(--adm-text3)", fontWeight: 600 }}>{v.deepConversions || "—"}</td>
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
