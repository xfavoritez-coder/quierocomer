"use client";
import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import RestaurantPicker from "@/lib/admin/RestaurantPicker";
import { EMAIL_TEMPLATES } from "@/lib/campaigns/templates";

const F = "var(--font-display)";

const TRIGGERS = [
  { value: "birthday", label: "Cumpleaños", icon: "🎂", desc: "Envía email el día del cumpleaños del cliente" },
  { value: "inactivity", label: "Inactividad", icon: "💤", desc: "Envía cuando un cliente no vuelve en X días" },
  { value: "welcome", label: "Bienvenida", icon: "👋", desc: "Envía 1 hora después de que se registra" },
  { value: "milestone", label: "Milestone", icon: "🏆", desc: "Envía en la visita N (5ta, 10ma, etc)" },
];

interface Rule {
  id: string; name: string; trigger: string; triggerConfig: any;
  subject: string | null; bodyHtml: string | null; isActive: boolean; createdAt: string;
}

export default function AdminAutomatizaciones() {
  const { selectedRestaurantId, loading: sessionLoading } = useAdminSession();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Form
  const [fName, setFName] = useState("");
  const [fTrigger, setFTrigger] = useState("birthday");
  const [fConfig, setFConfig] = useState<any>({});
  const [fSubject, setFSubject] = useState("");
  const [fBody, setFBody] = useState("");
  const [fTemplate, setFTemplate] = useState("");

  useEffect(() => {
    if (sessionLoading || !selectedRestaurantId) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/admin/automations?restaurantId=${selectedRestaurantId}`)
      .then(r => r.json()).then(d => setRules(d.rules || []))
      .catch(() => {}).finally(() => setLoading(false));
  }, [selectedRestaurantId, sessionLoading]);

  const applyTemplate = (id: string) => {
    const t = EMAIL_TEMPLATES.find(t => t.id === id);
    if (t) { setFSubject(t.subject); setFBody(t.bodyHtml); setFTemplate(id); }
  };

  const handleCreate = async () => {
    if (!fName || !selectedRestaurantId) return;
    const res = await fetch("/api/admin/automations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId: selectedRestaurantId, name: fName, trigger: fTrigger, triggerConfig: fConfig, subject: fSubject, bodyHtml: fBody, templateId: fTemplate }),
    });
    const data = await res.json();
    if (data.rule) { setRules(prev => [data.rule, ...prev]); resetForm(); }
  };

  const toggleActive = async (rule: Rule) => {
    const res = await fetch("/api/admin/automations", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rule.id, isActive: !rule.isActive }),
    });
    const data = await res.json();
    if (data.rule) setRules(prev => prev.map(r => r.id === rule.id ? data.rule : r));
  };

  const resetForm = () => {
    setCreating(false); setFName(""); setFTrigger("birthday"); setFConfig({}); setFSubject(""); setFBody(""); setFTemplate("");
  };

  const triggerInfo = TRIGGERS.find(t => t.value === fTrigger);

  if (loading) return <p style={{ color: "#F4A623", fontFamily: F, padding: 40 }}>Cargando...</p>;
  if (!selectedRestaurantId) return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "#888", fontFamily: F }}>Selecciona un local</p><RestaurantPicker /></div>;

  return (
    <div style={{ maxWidth: 800 }}>
      <div className="adm-flex-wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 10 }}>
        <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: "#F4A623", margin: 0 }}>Automatizaciones</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <RestaurantPicker />
          {!creating && <button onClick={() => setCreating(true)} style={{ padding: "8px 16px", background: "#F4A623", color: "#0a0a0a", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>+ Nueva regla</button>}
        </div>
      </div>

      {creating && (
        <div style={{ background: "#1A1A1A", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontFamily: F, fontSize: "1rem", color: "white", marginBottom: 16 }}>Nueva automatización</h3>

          <input placeholder="Nombre (ej: Cumpleaños clientes)" value={fName} onChange={e => setFName(e.target.value)} style={I} />

          {/* Trigger selector */}
          <p style={{ fontFamily: F, fontSize: "0.72rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Trigger</p>
          <div className="adm-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            {TRIGGERS.map(t => (
              <button key={t.value} onClick={() => { setFTrigger(t.value); setFConfig({}); }} style={{
                padding: "12px 14px", background: fTrigger === t.value ? "rgba(244,166,35,0.1)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${fTrigger === t.value ? "rgba(244,166,35,0.3)" : "#2A2A2A"}`,
                borderRadius: 10, cursor: "pointer", textAlign: "left",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "1.1rem" }}>{t.icon}</span>
                  <span style={{ fontFamily: F, fontSize: "0.85rem", color: fTrigger === t.value ? "#F4A623" : "white", fontWeight: 600 }}>{t.label}</span>
                </div>
                <p style={{ fontFamily: F, fontSize: "0.7rem", color: "#666", margin: "4px 0 0" }}>{t.desc}</p>
              </button>
            ))}
          </div>

          {/* Trigger config */}
          {fTrigger === "inactivity" && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontFamily: F, fontSize: "0.75rem", color: "#888" }}>Días de inactividad:</label>
              <input type="number" value={fConfig.daysInactive || 14} onChange={e => setFConfig({ ...fConfig, daysInactive: parseInt(e.target.value) })} style={{ ...I, width: "auto", maxWidth: 100, marginLeft: 10, marginBottom: 0 }} />
            </div>
          )}
          {fTrigger === "milestone" && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontFamily: F, fontSize: "0.75rem", color: "#888" }}>Número de visita:</label>
              <input type="number" value={fConfig.milestoneVisit || 5} onChange={e => setFConfig({ ...fConfig, milestoneVisit: parseInt(e.target.value) })} style={{ ...I, width: "auto", maxWidth: 100, marginLeft: 10, marginBottom: 0 }} />
            </div>
          )}

          {/* Template + email */}
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <select value={fTemplate} onChange={e => applyTemplate(e.target.value)} style={{ ...I, flex: 1, marginBottom: 0 }}>
              <option value="">Usar plantilla...</option>
              {EMAIL_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <input placeholder="Asunto del email" value={fSubject} onChange={e => setFSubject(e.target.value)} style={I} />
          <textarea placeholder="HTML del email (usa {{name}} y {{restaurant}})" value={fBody} onChange={e => setFBody(e.target.value)} rows={6} style={{ ...I, resize: "vertical", lineHeight: 1.5 }} />

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={handleCreate} disabled={!fName || !fSubject} style={{ padding: "10px 20px", background: "#F4A623", color: "#0a0a0a", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>Crear regla</button>
            <button onClick={resetForm} style={{ padding: "10px 20px", background: "none", border: "1px solid #2A2A2A", borderRadius: 8, color: "#888", fontFamily: F, fontSize: "0.85rem", cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Rules list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rules.map(rule => {
          const t = TRIGGERS.find(t => t.value === rule.trigger);
          return (
            <div key={rule.id} style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 12, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, opacity: rule.isActive ? 1 : 0.5 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(244,166,35,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>
                {t?.icon || "⚙️"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: F, fontSize: "0.95rem", color: "white", fontWeight: 600 }}>{rule.name}</span>
                  <span style={{ fontSize: "0.6rem", padding: "2px 8px", borderRadius: 4, background: rule.isActive ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.05)", color: rule.isActive ? "#4ade80" : "#666", fontWeight: 600 }}>
                    {rule.isActive ? "Activa" : "Pausada"}
                  </span>
                </div>
                <p style={{ fontFamily: F, fontSize: "0.72rem", color: "#666", margin: "4px 0 0" }}>
                  {t?.label || rule.trigger}
                  {rule.trigger === "inactivity" && ` · ${(rule.triggerConfig as any)?.daysInactive || 14} días`}
                  {rule.trigger === "milestone" && ` · visita ${(rule.triggerConfig as any)?.milestoneVisit || 5}`}
                  {rule.subject && ` · "${rule.subject.slice(0, 30)}..."`}
                </p>
              </div>
              <button onClick={() => toggleActive(rule)} style={{
                padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                fontFamily: F, fontSize: "0.72rem", fontWeight: 600, flexShrink: 0,
                background: rule.isActive ? "rgba(255,100,100,0.1)" : "rgba(74,222,128,0.1)",
                color: rule.isActive ? "#ff6b6b" : "#4ade80",
              }}>
                {rule.isActive ? "Pausar" : "Activar"}
              </button>
            </div>
          );
        })}
        {rules.length === 0 && !creating && (
          <div style={{ textAlign: "center", padding: 60 }}>
            <p style={{ fontSize: "2rem", marginBottom: 12 }}>⚡</p>
            <p style={{ fontFamily: F, fontSize: "0.92rem", color: "#888" }}>No hay automatizaciones</p>
            <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#555" }}>Crea reglas para enviar emails automáticos por cumpleaños, inactividad y más</p>
          </div>
        )}
      </div>
    </div>
  );
}

const I: React.CSSProperties = { width: "100%", padding: "10px 14px", background: "#111", border: "1px solid #2A2A2A", borderRadius: 8, color: "white", fontFamily: "var(--font-display)", fontSize: "0.85rem", outline: "none", marginBottom: 10, boxSizing: "border-box" };
