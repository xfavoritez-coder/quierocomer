"use client";
import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { toast } from "sonner";
import type { PricingConfig, PricePlan, PriceLine } from "@/lib/pricing";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

type PlanKey = "plans" | "addons";
type LineKey = "implementation" | "extras";

const card: React.CSSProperties = { background: "#1a1a1a", border: "1px solid #2A2A2A", borderRadius: 14, padding: 22, marginBottom: 18 };
const inp: React.CSSProperties = { background: "#111", border: "1px solid #2A2A2A", borderRadius: 8, padding: "8px 10px", color: "#eee", fontFamily: FB, fontSize: "0.85rem", width: "100%", boxSizing: "border-box" };
const sectionTitle: React.CSSProperties = { fontFamily: F, fontSize: "1.05rem", fontWeight: 900, color: "#fff", margin: "0 0 4px" };
const sectionSub: React.CSSProperties = { fontFamily: FB, fontSize: "0.78rem", color: "#888", margin: "0 0 16px" };
const smallBtn: React.CSSProperties = { background: "#242424", border: "1px solid #3a3a3a", borderRadius: 8, color: "#ccc", fontFamily: FB, fontSize: "0.78rem", fontWeight: 700, padding: "7px 12px", cursor: "pointer" };
const xBtn: React.CSSProperties = { background: "none", border: "none", color: "#ff7070", fontSize: "1rem", cursor: "pointer", lineHeight: 1, padding: "0 4px" };

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
const fmt = (n: number) => `$${(Number(n) || 0).toLocaleString("es-CL")}`;

export default function PreciosPage() {
  const { isSuper } = useAdminSession();
  const [cfg, setCfg] = useState<PricingConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/pricing")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCfg(d))
      .catch(() => toast.error("No se pudieron cargar los precios"));
  }, []);

  const mutate = (fn: (c: PricingConfig) => void) =>
    setCfg((prev) => {
      if (!prev) return prev;
      const c = structuredClone(prev);
      fn(c);
      return c;
    });

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    try {
      const r = await fetch("/api/admin/pricing", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || "Error al guardar");
      if (d?.pricing) setCfg(d.pricing);
      toast.success("Precios guardados");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  // ── Plan helpers (planes + add-ons) ─────────────────────────────
  const setPlan = (k: PlanKey, i: number, field: keyof PricePlan, v: string | number) => mutate((c) => { (c[k][i] as unknown as Record<string, unknown>)[field] = v; });
  const addPlan = (k: PlanKey) => mutate((c) => { c[k].push({ id: uid(), name: "Nuevo plan", price: 0, features: [] }); });
  const removePlan = (k: PlanKey, i: number) => mutate((c) => { c[k].splice(i, 1); });
  const setFeature = (k: PlanKey, pi: number, fi: number, v: string) => mutate((c) => { c[k][pi].features[fi] = v; });
  const addFeature = (k: PlanKey, pi: number) => mutate((c) => { c[k][pi].features.push(""); });
  const removeFeature = (k: PlanKey, pi: number, fi: number) => mutate((c) => { c[k][pi].features.splice(fi, 1); });

  // ── Line helpers (implementación + extras) ──────────────────────
  const setLine = (k: LineKey, i: number, field: keyof PriceLine, v: string | number) => mutate((c) => { (c[k][i] as unknown as Record<string, unknown>)[field] = v; });
  const addLine = (k: LineKey) => mutate((c) => { c[k].push({ id: uid(), label: "Nuevo ítem", price: 0, note: "" }); });
  const removeLine = (k: LineKey, i: number) => mutate((c) => { c[k].splice(i, 1); });

  if (!isSuper) return <div style={{ padding: 32, color: "#888", fontFamily: FB }}>Solo superadmin</div>;
  if (!cfg) return <div style={{ padding: 32, color: GOLD, fontFamily: F }}>Cargando precios…</div>;

  const renderPlans = (k: PlanKey, title: string, sub: string) => (
    <div style={card}>
      <h3 style={sectionTitle}>{title}</h3>
      <p style={sectionSub}>{sub}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        {cfg[k].map((p, pi) => (
          <div key={p.id} style={{ background: "#141414", border: "1px solid #2A2A2A", borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <input style={{ ...inp, fontWeight: 800, color: "#fff" }} value={p.name} onChange={(e) => setPlan(k, pi, "name", e.target.value)} placeholder="Nombre del plan" />
              <button style={xBtn} title="Eliminar plan" onClick={() => removePlan(k, pi)}>✕</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <span style={{ color: GOLD, fontFamily: F, fontWeight: 900 }}>$</span>
              <input style={{ ...inp, fontFamily: F, fontWeight: 900, fontSize: "1.1rem", color: GOLD }} type="number" min={0} step={100} value={p.price} onChange={(e) => setPlan(k, pi, "price", Math.max(0, Math.round(Number(e.target.value) || 0)))} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {p.features.map((f, fi) => (
                <div key={fi} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ color: GOLD, fontSize: "0.7rem" }}>✓</span>
                  <input style={{ ...inp, padding: "6px 8px", fontSize: "0.8rem" }} value={f} onChange={(e) => setFeature(k, pi, fi, e.target.value)} placeholder="Característica" />
                  <button style={xBtn} title="Quitar" onClick={() => removeFeature(k, pi, fi)}>✕</button>
                </div>
              ))}
              <button style={{ ...smallBtn, marginTop: 4, alignSelf: "flex-start" }} onClick={() => addFeature(k, pi)}>+ característica</button>
            </div>
          </div>
        ))}
      </div>
      <button style={{ ...smallBtn, marginTop: 14 }} onClick={() => addPlan(k)}>+ agregar {k === "plans" ? "plan" : "paquete"}</button>
    </div>
  );

  const renderLines = (k: LineKey, title: string, sub: string, addLabel: string) => (
    <div style={card}>
      <h3 style={sectionTitle}>{title}</h3>
      <p style={sectionSub}>{sub}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 1.4fr 30px", gap: 8, marginBottom: 6, fontFamily: F, fontSize: "0.68rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700 }}>
        <span>Concepto</span><span>Precio</span><span>Nota</span><span />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {cfg[k].map((l, i) => (
          <div key={l.id} style={{ display: "grid", gridTemplateColumns: "1fr 130px 1.4fr 30px", gap: 8, alignItems: "center" }}>
            <input style={inp} value={l.label} onChange={(e) => setLine(k, i, "label", e.target.value)} placeholder="Concepto" />
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: GOLD, fontWeight: 800 }}>$</span>
              <input style={{ ...inp, fontFamily: F, fontWeight: 800 }} type="number" min={0} step={100} value={l.price} onChange={(e) => setLine(k, i, "price", Math.max(0, Math.round(Number(e.target.value) || 0)))} />
            </div>
            <input style={inp} value={l.note || ""} onChange={(e) => setLine(k, i, "note", e.target.value)} placeholder="Nota (opcional)" />
            <button style={xBtn} title="Eliminar" onClick={() => removeLine(k, i)}>✕</button>
          </div>
        ))}
      </div>
      <button style={{ ...smallBtn, marginTop: 14 }} onClick={() => addLine(k)}>+ {addLabel}</button>
    </div>
  );

  return (
    <div style={{ padding: "24px 24px 100px", maxWidth: 1000, fontFamily: FB }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.6rem", fontWeight: 900, color: "#fff", margin: 0 }}>💲 Precios</h1>
          <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "#888", margin: "4px 0 0" }}>Planes, paquetes, implementación y otros cobros de QuieroComer.</p>
        </div>
        <button onClick={save} disabled={saving} style={{ background: GOLD, border: "none", borderRadius: 10, color: "#111", fontFamily: F, fontWeight: 900, fontSize: "0.9rem", padding: "11px 22px", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>

      {renderPlans("plans", "Planes Ecommerce", "Suscripción mensual. Cada plan con sus características incluidas.")}
      {renderPlans("addons", "Paquetes / Add-ons", "Módulos que se contratan aparte o se suman a un plan.")}
      {renderLines("implementation", "Implementación", "Pago único de puesta en marcha por plan o paquete.", "ítem de implementación")}
      {renderLines("extras", "Otros cobros", "Cobros variables (por mensaje, por metro, dominio, etc.).", "otro cobro")}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
        <button onClick={save} disabled={saving} style={{ background: GOLD, border: "none", borderRadius: 10, color: "#111", fontFamily: F, fontWeight: 900, fontSize: "0.9rem", padding: "11px 22px", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>

      <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "#555", marginTop: 20 }}>
        Vista previa rápida: {cfg.plans.map((p) => `${p.name} ${fmt(p.price)}`).join(" · ")}
      </p>
    </div>
  );
}
