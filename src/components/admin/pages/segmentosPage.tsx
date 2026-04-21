"use client";
import { useState, useEffect, useCallback } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import RestaurantPicker from "@/lib/admin/RestaurantPicker";

const F = "var(--font-display)";

const FIELD_OPTIONS = [
  { value: "dietType", label: "Tipo de dieta", operators: ["eq", "neq"], values: [
    { value: "omnivore", label: "Omnívoro" }, { value: "vegetarian", label: "Vegetariano" },
    { value: "vegan", label: "Vegano" }, { value: "pescetarian", label: "Pescetariano" },
  ]},
  { value: "restriction", label: "Restricción", operators: ["contains"], values: [
    { value: "lactosa", label: "Sin lactosa" }, { value: "gluten", label: "Sin gluten" },
    { value: "nueces", label: "Sin nueces" }, { value: "mariscos", label: "Sin mariscos" },
  ]},
  { value: "registered", label: "Estado registro", operators: ["eq"], values: [
    { value: "true", label: "Registrado" }, { value: "false", label: "Fantasma" },
  ]},
  { value: "visitCount", label: "Número de visitas", operators: ["gte", "lte", "eq"], values: "number" },
  { value: "lastVisitDaysAgo", label: "Días desde última visita", operators: ["gte", "lte"], values: "number" },
  { value: "sessionDuration", label: "Duración promedio (seg)", operators: ["gte", "lte"], values: "number" },
  { value: "viewPreference", label: "Vista preferida", operators: ["eq"], values: [
    { value: "premium", label: "Clásica" }, { value: "lista", label: "Lista" }, { value: "viaje", label: "Espacial" },
  ]},
  { value: "hasBirthday", label: "Tiene cumpleaños", operators: ["eq"], values: [
    { value: "true", label: "Sí" }, { value: "false", label: "No" },
  ]},
];

const OP_LABELS: Record<string, string> = { eq: "es", neq: "no es", gte: "≥", lte: "≤", gt: ">", lt: "<", contains: "incluye" };

interface Rule { field: string; operator: string; value: string; }
interface Segment { id: string; name: string; description: string | null; rules: Rule[]; isAuto: boolean; cachedCount: number | null; cachedAt: string | null; createdAt: string; }

function RuleBuilder({ rules, onChange, restaurantId }: { rules: Rule[]; onChange: (r: Rule[]) => void; restaurantId: string }) {
  const [preview, setPreview] = useState<{ count: number; registeredCount: number; ghostCount: number } | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  const evaluate = useCallback(async () => {
    if (!rules.length || !restaurantId) return;
    setEvaluating(true);
    try {
      const res = await fetch("/api/admin/segments/evaluate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, rules }),
      });
      const data = await res.json();
      setPreview(data);
    } catch {} finally { setEvaluating(false); }
  }, [rules, restaurantId]);

  useEffect(() => {
    const t = setTimeout(evaluate, 500);
    return () => clearTimeout(t);
  }, [evaluate]);

  const addRule = () => onChange([...rules, { field: "dietType", operator: "eq", value: "omnivore" }]);
  const removeRule = (i: number) => onChange(rules.filter((_, idx) => idx !== i));
  const updateRule = (i: number, patch: Partial<Rule>) => onChange(rules.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  return (
    <div>
      {rules.map((rule, i) => {
        const fieldDef = FIELD_OPTIONS.find(f => f.value === rule.field);
        return (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select value={rule.field} onChange={e => updateRule(i, { field: e.target.value, operator: FIELD_OPTIONS.find(f => f.value === e.target.value)?.operators[0] || "eq", value: "" })} style={S}>
              {FIELD_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <select value={rule.operator} onChange={e => updateRule(i, { operator: e.target.value })} style={{ ...S, width: 80 }}>
              {(fieldDef?.operators || ["eq"]).map(op => <option key={op} value={op}>{OP_LABELS[op]}</option>)}
            </select>
            {fieldDef?.values === "number" ? (
              <input type="number" value={rule.value} onChange={e => updateRule(i, { value: e.target.value })} style={{ ...S, width: 80 }} />
            ) : (
              <select value={rule.value} onChange={e => updateRule(i, { value: e.target.value })} style={S}>
                <option value="">Seleccionar</option>
                {Array.isArray(fieldDef?.values) && fieldDef.values.map((v: any) => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            )}
            <button onClick={() => removeRule(i)} style={{ background: "none", border: "none", color: "#ff6b6b", cursor: "pointer", fontSize: "1rem" }}>×</button>
          </div>
        );
      })}
      <button onClick={addRule} style={{ background: "rgba(244,166,35,0.1)", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 8, padding: "6px 14px", color: "#F4A623", fontFamily: F, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>+ Agregar regla</button>

      {preview && (
        <div style={{ marginTop: 14, background: "rgba(244,166,35,0.06)", border: "1px solid rgba(244,166,35,0.15)", borderRadius: 10, padding: "12px 14px", display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div><span style={{ fontFamily: F, fontSize: "1.3rem", color: "#F4A623", fontWeight: 700 }}>{evaluating ? "..." : preview.count}</span><p style={{ fontFamily: F, fontSize: "0.7rem", color: "#888", margin: 0 }}>Total</p></div>
          <div><span style={{ fontFamily: F, fontSize: "1.3rem", color: "#4ade80", fontWeight: 700 }}>{preview.registeredCount}</span><p style={{ fontFamily: F, fontSize: "0.7rem", color: "#888", margin: 0 }}>Registrados</p></div>
          <div><span style={{ fontFamily: F, fontSize: "1.3rem", color: "#888", fontWeight: 700 }}>{preview.ghostCount}</span><p style={{ fontFamily: F, fontSize: "0.7rem", color: "#888", margin: 0 }}>Fantasmas</p></div>
        </div>
      )}
    </div>
  );
}

const S: React.CSSProperties = { padding: "6px 10px", background: "#111", border: "1px solid #2A2A2A", borderRadius: 6, color: "white", fontFamily: F, fontSize: "0.78rem", outline: "none" };

export default function AdminSegmentos() {
  const { selectedRestaurantId, loading: sessionLoading } = useAdminSession();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newRules, setNewRules] = useState<Rule[]>([{ field: "dietType", operator: "eq", value: "vegetarian" }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (sessionLoading || !selectedRestaurantId) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/admin/segments?restaurantId=${selectedRestaurantId}`)
      .then(r => r.json()).then(d => setSegments(d.segments || []))
      .catch(() => {}).finally(() => setLoading(false));
  }, [selectedRestaurantId, sessionLoading]);

  const handleCreate = async () => {
    if (!newName || !selectedRestaurantId || !newRules.length) return;
    setSaving(true);
    const res = await fetch("/api/admin/segments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId: selectedRestaurantId, name: newName, description: newDesc || null, rules: newRules }),
    });
    const data = await res.json();
    if (data.segment) {
      setSegments(prev => [data.segment, ...prev]);
      setCreating(false);
      setNewName(""); setNewDesc(""); setNewRules([{ field: "dietType", operator: "eq", value: "vegetarian" }]);
    }
    setSaving(false);
  };

  if (loading) return <p style={{ color: "#F4A623", fontFamily: F, padding: 40 }}>Cargando segmentos...</p>;

  if (!selectedRestaurantId) return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <p style={{ color: "#888", fontFamily: F }}>Selecciona un local para ver segmentos</p>
      <RestaurantPicker />
    </div>
  );

  return (
    <div style={{ maxWidth: 800 }}>
      <div className="adm-flex-wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: "#F4A623", margin: 0 }}>Segmentos</h1>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "4px 0 0" }}>Agrupa a tus clientes por comportamiento para comunicaciones más efectivas</p>
        </div>
        <div className="adm-flex-wrap" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <RestaurantPicker />
          {!creating && (
            <button onClick={() => setCreating(true)} style={{ padding: "8px 16px", background: "#F4A623", color: "white", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>+ Crear segmento</button>
          )}
        </div>
      </div>

      {creating && (
        <div style={{ background: "#1A1A1A", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontFamily: F, fontSize: "1rem", color: "white", marginBottom: 16 }}>Nuevo segmento</h3>
          <input placeholder="Nombre del segmento" value={newName} onChange={e => setNewName(e.target.value)} style={{ width: "100%", padding: "10px 14px", background: "#111", border: "1px solid #2A2A2A", borderRadius: 8, color: "white", fontFamily: F, fontSize: "0.88rem", outline: "none", marginBottom: 10, boxSizing: "border-box" }} />
          <input placeholder="Descripción (opcional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} style={{ width: "100%", padding: "10px 14px", background: "#111", border: "1px solid #2A2A2A", borderRadius: 8, color: "white", fontFamily: F, fontSize: "0.85rem", outline: "none", marginBottom: 16, boxSizing: "border-box" }} />
          <p style={{ fontFamily: F, fontSize: "0.75rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Reglas</p>
          <RuleBuilder rules={newRules} onChange={setNewRules} restaurantId={selectedRestaurantId} />
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={handleCreate} disabled={saving || !newName} style={{ padding: "10px 20px", background: "#F4A623", color: "#0a0a0a", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", opacity: saving ? 0.5 : 1 }}>{saving ? "Guardando..." : "Crear segmento"}</button>
            <button onClick={() => setCreating(false)} style={{ padding: "10px 20px", background: "none", border: "1px solid #2A2A2A", borderRadius: 8, color: "#888", fontFamily: F, fontSize: "0.85rem", cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {segments.map(seg => (
          <div key={seg.id} style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 12, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: seg.isAuto ? "rgba(127,191,220,0.1)" : "rgba(244,166,35,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>
              {seg.isAuto ? "🤖" : "👥"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: F, fontSize: "0.95rem", color: "white", fontWeight: 600 }}>{seg.name}</span>
                {seg.isAuto && <span style={{ fontSize: "0.6rem", background: "rgba(127,191,220,0.15)", color: "#7fbfdc", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>Auto</span>}
              </div>
              {seg.description && <p style={{ fontFamily: F, fontSize: "0.75rem", color: "#666", margin: "2px 0 0" }}>{seg.description}</p>}
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                {(seg.rules as Rule[]).map((r, i) => (
                  <span key={i} style={{ fontFamily: F, fontSize: "0.65rem", padding: "2px 8px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 4, color: "#aaa" }}>
                    {FIELD_OPTIONS.find(f => f.value === r.field)?.label || r.field} {OP_LABELS[r.operator]} {r.value}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <p style={{ fontFamily: F, fontSize: "1.4rem", color: "#F4A623", fontWeight: 700, margin: 0 }}>{seg.cachedCount ?? "—"}</p>
              <p style={{ fontFamily: F, fontSize: "0.65rem", color: "#666", margin: 0 }}>personas</p>
            </div>
          </div>
        ))}
        {segments.length === 0 && !creating && (
          <p style={{ fontFamily: F, fontSize: "0.85rem", color: "#666", textAlign: "center", padding: 40 }}>No hay segmentos. Crea el primero.</p>
        )}
      </div>
    </div>
  );
}
