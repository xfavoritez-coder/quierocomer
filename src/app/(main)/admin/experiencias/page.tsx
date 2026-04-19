"use client";
import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";

const F = "var(--font-display)";

interface Template { id: string; name: string; slug: string; theme: string; category: string; description: string; accentColor: string; iconEmoji: string; _count: { results: number; instances: number } }
interface Instance { id: string; isActive: boolean; restaurant: { id: string; name: string; slug: string }; template: { name: string; slug: string; iconEmoji: string }; _count: { submissions: number } }

export default function AdminExperiencias() {
  const { restaurants } = useAdminSession();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [assignLocal, setAssignLocal] = useState("");
  const [assignTemplate, setAssignTemplate] = useState("");

  useEffect(() => {
    fetch("/api/admin/experiences")
      .then(r => r.json())
      .then(d => { setTemplates(d.templates || []); setInstances(d.instances || []); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleAssign = async () => {
    if (!assignLocal || !assignTemplate) return;
    await fetch("/api/admin/experiences", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "assign", restaurantId: assignLocal, templateId: assignTemplate }),
    });
    // Reload
    const d = await fetch("/api/admin/experiences").then(r => r.json());
    setInstances(d.instances || []);
    setAssigning(false); setAssignLocal(""); setAssignTemplate("");
  };

  const handleToggle = async (id: string) => {
    await fetch("/api/admin/experiences", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", experienceId: id }),
    });
    setInstances(prev => prev.map(i => i.id === id ? { ...i, isActive: !i.isActive } : i));
  };

  const handleRemove = async (id: string) => {
    if (!confirm("¿Quitar experiencia de este local?")) return;
    await fetch("/api/admin/experiences", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", experienceId: id }),
    });
    setInstances(prev => prev.filter(i => i.id !== id));
  };

  const assignedLocalIds = new Set(instances.map(i => i.restaurant.id));
  const availableLocals = restaurants.filter(r => !assignedLocalIds.has(r.id));

  if (loading) return <p style={{ color: "#F4A623", fontFamily: F, padding: 40 }}>Cargando...</p>;

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: "#F4A623", margin: 0 }}>Experiencias</h1>
        {!assigning && <button onClick={() => setAssigning(true)} style={{ padding: "8px 16px", background: "#F4A623", color: "#0a0a0a", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>+ Asignar a local</button>}
      </div>

      {/* Assign form */}
      {assigning && (
        <div style={{ background: "#1A1A1A", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontFamily: F, fontSize: "1rem", color: "white", marginBottom: 16 }}>Asignar experiencia a un local</h3>
          <select value={assignLocal} onChange={e => setAssignLocal(e.target.value)} style={{ width: "100%", padding: "10px 12px", background: "#111", border: "1px solid #2A2A2A", borderRadius: 8, color: "white", fontFamily: F, fontSize: "0.82rem", outline: "none", marginBottom: 10 }}>
            <option value="">Seleccionar local</option>
            {availableLocals.map(r => <option key={r.id} value={r.id} style={{ background: "#1A1A1A" }}>{r.name}</option>)}
          </select>
          <select value={assignTemplate} onChange={e => setAssignTemplate(e.target.value)} style={{ width: "100%", padding: "10px 12px", background: "#111", border: "1px solid #2A2A2A", borderRadius: 8, color: "white", fontFamily: F, fontSize: "0.82rem", outline: "none", marginBottom: 14 }}>
            <option value="">Seleccionar experiencia</option>
            {templates.map(t => <option key={t.id} value={t.id} style={{ background: "#1A1A1A" }}>{t.iconEmoji} {t.name} ({t.category})</option>)}
          </select>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleAssign} disabled={!assignLocal || !assignTemplate} style={{ flex: 1, padding: "10px", background: "#F4A623", color: "#0a0a0a", border: "none", borderRadius: 10, fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>Asignar</button>
            <button onClick={() => setAssigning(false)} style={{ padding: "10px 16px", background: "none", border: "1px solid #2A2A2A", borderRadius: 10, color: "#888", fontFamily: F, fontSize: "0.85rem", cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Active instances */}
      <h2 style={{ fontFamily: F, fontSize: "0.85rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Locales con experiencia ({instances.length})</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
        {instances.map(i => (
          <div key={i.id} style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, opacity: i.isActive ? 1 : 0.5 }}>
            <span style={{ fontSize: "1.3rem" }}>{i.template.iconEmoji}</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontFamily: F, fontSize: "0.92rem", color: "white", fontWeight: 600 }}>{i.restaurant.name}</span>
              <p style={{ fontFamily: F, fontSize: "0.72rem", color: "#999", margin: "2px 0 0" }}>{i.template.name} · {i._count.submissions} participaciones</p>
            </div>
            <button onClick={() => handleToggle(i.id)} style={{ padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.72rem", fontWeight: 600, background: i.isActive ? "rgba(255,100,100,0.1)" : "rgba(74,222,128,0.1)", color: i.isActive ? "#ff6b6b" : "#4ade80" }}>
              {i.isActive ? "Pausar" : "Activar"}
            </button>
            <button onClick={() => handleRemove(i.id)} style={{ padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.72rem", color: "#555", background: "rgba(255,255,255,0.04)" }}>Quitar</button>
          </div>
        ))}
        {instances.length === 0 && <p style={{ fontFamily: F, fontSize: "0.85rem", color: "#555", textAlign: "center", padding: 20 }}>Ningún local tiene experiencia asignada</p>}
      </div>

      {/* Templates library */}
      <h2 style={{ fontFamily: F, fontSize: "0.85rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Plantillas disponibles ({templates.length})</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {templates.map(t => (
          <div key={t.id} style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 14, padding: "18px 16px", textAlign: "center" }}>
            <span style={{ fontSize: "2rem", display: "block", marginBottom: 8 }}>{t.iconEmoji}</span>
            <h3 style={{ fontFamily: F, fontSize: "0.88rem", color: "white", fontWeight: 600, margin: "0 0 4px" }}>{t.name}</h3>
            <p style={{ fontFamily: F, fontSize: "0.7rem", color: "#999", margin: "0 0 8px" }}>{t.description}</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <span style={{ fontSize: "0.65rem", padding: "2px 8px", borderRadius: 4, background: "rgba(244,166,35,0.1)", color: "#F4A623" }}>{t.category}</span>
              <span style={{ fontSize: "0.65rem", padding: "2px 8px", borderRadius: 4, background: "rgba(255,255,255,0.05)", color: "#888" }}>{t._count.results} resultados</span>
              <span style={{ fontSize: "0.65rem", padding: "2px 8px", borderRadius: 4, background: "rgba(255,255,255,0.05)", color: "#888" }}>{t._count.instances} locales</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
