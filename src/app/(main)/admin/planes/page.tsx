"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
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
const goldBtn = (saving: boolean): React.CSSProperties => ({ background: GOLD, border: "none", borderRadius: 10, color: "#111", fontFamily: F, fontWeight: 900, fontSize: "0.9rem", padding: "11px 22px", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 });

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
const fmt = (n: number) => `$${(Number(n) || 0).toLocaleString("es-CL")}`;
const clone = <T,>(x: T): T => (typeof structuredClone === "function" ? structuredClone(x) : JSON.parse(JSON.stringify(x)));

export default function PlanesPage() {
  const { isSuper } = useAdminSession();
  const [cfg, setCfg] = useState<PricingConfig | null>(null);
  const [saved, setSaved] = useState<PricingConfig | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/pricing")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setCfg(d); setSaved(clone(d)); } })
      .catch(() => toast.error("No se pudieron cargar los planes"));
  }, []);

  const mutate = (fn: (c: PricingConfig) => void) =>
    setCfg((prev) => { if (!prev) return prev; const c = clone(prev); fn(c); return c; });

  const cancel = () => { if (saved) setCfg(clone(saved)); setEditing(false); };

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    try {
      const r = await fetch("/api/admin/pricing", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || "Error al guardar");
      const next = d?.pricing || cfg;
      setCfg(next); setSaved(clone(next)); setEditing(false);
      toast.success("Planes guardados");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  // ── edit helpers ────────────────────────────────────────────────
  const setPlan = (k: PlanKey, i: number, field: keyof PricePlan, v: string | number) => mutate((c) => { (c[k][i] as unknown as Record<string, unknown>)[field] = v; });
  const addPlan = (k: PlanKey) => mutate((c) => { c[k].push({ id: uid(), name: "Nuevo plan", price: 0, features: [] }); });
  const removePlan = (k: PlanKey, i: number) => mutate((c) => { c[k].splice(i, 1); });
  const setFeature = (k: PlanKey, pi: number, fi: number, v: string) => mutate((c) => { c[k][pi].features[fi] = v; });
  const addFeature = (k: PlanKey, pi: number) => mutate((c) => { c[k][pi].features.push(""); });
  const removeFeature = (k: PlanKey, pi: number, fi: number) => mutate((c) => { c[k][pi].features.splice(fi, 1); });
  const setLine = (k: LineKey, i: number, field: keyof PriceLine, v: string | number) => mutate((c) => { (c[k][i] as unknown as Record<string, unknown>)[field] = v; });
  const addLine = (k: LineKey) => mutate((c) => { c[k].push({ id: uid(), label: "Nuevo ítem", price: 0, note: "" }); });
  const removeLine = (k: LineKey, i: number) => mutate((c) => { c[k].splice(i, 1); });

  if (!isSuper) return <div style={{ padding: 32, color: "#888", fontFamily: FB }}>Solo superadmin</div>;
  if (!cfg) return <div style={{ padding: 32, color: GOLD, fontFamily: F }}>Cargando planes…</div>;

  const implFor = (name: string) => cfg.implementation.find((l) => l.label.trim().toLowerCase() === name.trim().toLowerCase())?.price ?? null;
  const isHighlight = (p: PricePlan) => p.id === "premium" || /(^|\s)premium$/i.test(p.name.trim());

  // ───────────────────────── VIEW (landing) ─────────────────────────
  const planCard = (p: PricePlan, accent: boolean) => {
    const impl = implFor(p.name);
    const hi = accent && isHighlight(p);
    return (
      <div key={p.id} style={{
        position: "relative", background: hi ? "linear-gradient(180deg,#201a0e,#161616)" : "#17181a",
        border: `1px solid ${hi ? GOLD : "#2A2A2A"}`, borderRadius: 18, padding: "26px 22px 24px",
        boxShadow: hi ? "0 0 0 1px rgba(244,166,35,0.25), 0 18px 40px -20px rgba(244,166,35,0.35)" : "0 10px 30px -22px rgba(0,0,0,0.8)",
        display: "flex", flexDirection: "column",
      }}>
        {hi && <span style={{ position: "absolute", top: -11, left: 22, background: GOLD, color: "#111", fontFamily: F, fontWeight: 900, fontSize: "0.62rem", letterSpacing: "0.5px", textTransform: "uppercase", padding: "4px 10px", borderRadius: 50 }}>Recomendado</span>}
        <h3 style={{ fontFamily: F, fontSize: "1.1rem", fontWeight: 900, color: "#fff", margin: "0 0 10px" }}>{p.name}</h3>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontFamily: F, fontSize: "2rem", fontWeight: 900, color: hi ? GOLD : "#fff", letterSpacing: "-0.03em" }}>{fmt(p.price)}</span>
          <span style={{ fontFamily: FB, fontSize: "0.8rem", color: "#888" }}>/mes</span>
        </div>
        {impl != null && <div style={{ fontFamily: FB, fontSize: "0.72rem", color: "#9a9a9a", marginTop: 6 }}>+ {fmt(impl)} implementación única</div>}
        <div style={{ height: 1, background: "#2A2A2A", margin: "18px 0 16px" }} />
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 9 }}>
          {p.features.map((f, i) => (
            <li key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", fontFamily: FB, fontSize: "0.82rem", color: "#d4d4d4", lineHeight: 1.35 }}>
              <span style={{ color: GOLD, fontWeight: 900, flexShrink: 0, marginTop: 1 }}>✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const renderView = () => (
    <>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontFamily: F, fontSize: "1.25rem", fontWeight: 900, color: "#fff", margin: "0 0 2px" }}>Planes Ecommerce</h2>
        <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "#888", margin: 0 }}>Suscripción mensual · precio de implementación por única vez.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16, marginBottom: 34 }}>
        {cfg.plans.map((p) => planCard(p, true))}
      </div>

      {cfg.addons.length > 0 && <>
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ fontFamily: F, fontSize: "1.25rem", fontWeight: 900, color: "#fff", margin: "0 0 2px" }}>Paquetes y add-ons</h2>
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "#888", margin: 0 }}>Módulos que se contratan aparte o se suman a un plan.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 34 }}>
          {cfg.addons.map((p) => planCard(p, false))}
        </div>
      </>}

      {cfg.extras.length > 0 && <>
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ fontFamily: F, fontSize: "1.25rem", fontWeight: 900, color: "#fff", margin: "0 0 2px" }}>Otros cobros</h2>
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "#888", margin: 0 }}>Cobros variables.</p>
        </div>
        <div style={{ background: "#17181a", border: "1px solid #2A2A2A", borderRadius: 16, overflow: "hidden" }}>
          {cfg.extras.map((l, i) => (
            <div key={l.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "15px 20px", borderTop: i ? "1px solid #242424" : "none" }}>
              <div>
                <div style={{ fontFamily: FB, fontSize: "0.9rem", fontWeight: 700, color: "#eee" }}>{l.label}</div>
                {l.note && <div style={{ fontFamily: FB, fontSize: "0.74rem", color: "#888", marginTop: 2 }}>{l.note}</div>}
              </div>
              <div style={{ fontFamily: F, fontSize: "1.05rem", fontWeight: 900, color: GOLD, whiteSpace: "nowrap" }}>{fmt(l.price)}</div>
            </div>
          ))}
        </div>
      </>}
    </>
  );

  // ───────────────────────── EDIT (form) ─────────────────────────
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

  const renderEdit = () => (
    <>
      {renderPlans("plans", "Planes Ecommerce", "Suscripción mensual. Cada plan con sus características incluidas.")}
      {renderPlans("addons", "Paquetes / Add-ons", "Módulos que se contratan aparte o se suman a un plan.")}
      {renderLines("implementation", "Implementación", "Pago único de puesta en marcha por plan o paquete.", "ítem de implementación")}
      {renderLines("extras", "Otros cobros", "Cobros variables (por mensaje, por metro, dominio, etc.).", "otro cobro")}
    </>
  );

  return (
    <div style={{ padding: "24px 24px 100px", maxWidth: 1040, fontFamily: FB }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.6rem", fontWeight: 900, color: "#fff", margin: 0 }}>📦 Planes</h1>
          <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "#888", margin: "4px 0 0" }}>Planes, paquetes, implementación y otros cobros de QuieroComer.</p>
        </div>
        {editing ? (
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={cancel} disabled={saving} style={{ ...smallBtn, padding: "11px 18px", fontSize: "0.85rem" }}>Cancelar</button>
            <button onClick={save} disabled={saving} style={goldBtn(saving)}>{saving ? "Guardando…" : "Guardar cambios"}</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/admin/planes/presentacion" style={{ ...goldBtn(false), textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>▶ Ver presentación</Link>
            <button onClick={() => setEditing(true)} style={{ ...smallBtn, padding: "11px 18px", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 7 }}>✏️ Editar</button>
          </div>
        )}
      </div>

      {editing ? renderEdit() : renderView()}
    </div>
  );
}
