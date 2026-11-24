"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { toast } from "sonner";
import type { PricingConfig, PricePlan, PriceLine, PricingHeadings, PricingCategory } from "@/lib/pricing";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

// Defaults de encabezados — copia LOCAL client-safe. No importar de @/lib/pricing: arrastra prisma al cliente y rompe la página.
const DEFAULT_HEADINGS: Record<keyof PricingHeadings, string> = {
  plansTitle: "Planes Ecommerce",
  plansSub: "Suscripción mensual · precio de implementación por única vez.",
  addonsTitle: "Paquetes y add-ons",
  addonsSub: "Módulos que se contratan aparte o se suman a un plan.",
};

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
  const [drag, setDrag] = useState<{ k: PlanKey; pi: number; fi: number } | null>(null); // característica que se está arrastrando

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
  const setPlan = (k: PlanKey, i: number, field: keyof PricePlan, v: string | number | boolean) => mutate((c) => { (c[k][i] as unknown as Record<string, unknown>)[field] = v; });
  const addPlan = (k: PlanKey) => mutate((c) => { c[k].push({ id: uid(), name: "Nuevo plan", price: 0, features: [] }); });
  const removePlan = (k: PlanKey, i: number) => mutate((c) => { c[k].splice(i, 1); });
  const setRecommended = (k: PlanKey, pi: number) => mutate((c) => { const was = c[k][pi].recommended === true; c[k].forEach((p) => { p.recommended = false; }); if (!was) c[k][pi].recommended = true; });
  const setHeading = (field: keyof PricingHeadings, v: string) => mutate((c) => { c.headings = { ...(c.headings || {}), [field]: v }; });
  const addCategory = () => mutate((c) => { c.categories = [...(c.categories || []), { id: uid(), title: "Nueva categoría", subtitle: "" }]; });
  const setCategoryField = (ci: number, field: keyof PricingCategory, v: string) => mutate((c) => { if (!c.categories) return; c.categories[ci] = { ...c.categories[ci], [field]: v }; });
  const removeCategory = (ci: number) => mutate((c) => { if (c.categories) c.categories.splice(ci, 1); }); // los ítems de esa categoría caen a su sección por defecto
  const toggleIncludedAddon = (k: PlanKey, pi: number, addonId: string) => mutate((c) => { const p = c[k][pi]; const arr = p.includedAddons ? [...p.includedAddons] : []; const idx = arr.indexOf(addonId); if (idx >= 0) { arr.splice(idx, 1); if (p.addonPrices) { const m = { ...p.addonPrices }; delete m[addonId]; p.addonPrices = m; } } else arr.push(addonId); p.includedAddons = arr; });
  const setAddonPrice = (k: PlanKey, pi: number, addonId: string, price: number) => mutate((c) => { const p = c[k][pi]; const m = { ...(p.addonPrices || {}) }; if (price > 0) m[addonId] = price; else delete m[addonId]; p.addonPrices = m; });
  const featEq = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const isFeatHi = (p: PricePlan, f: string) => (p.highlightedFeatures || []).some((x) => featEq(x, f));
  const setFeature = (k: PlanKey, pi: number, fi: number, v: string) => mutate((c) => { const p = c[k][pi]; const old = p.features[fi]; p.features[fi] = v; if (p.highlightedFeatures && old !== undefined) { const i = p.highlightedFeatures.findIndex((x) => featEq(x, old)); if (i >= 0) p.highlightedFeatures[i] = v; } });
  const addFeature = (k: PlanKey, pi: number) => mutate((c) => { c[k][pi].features.push(""); });
  const removeFeature = (k: PlanKey, pi: number, fi: number) => mutate((c) => { const p = c[k][pi]; const [removed] = p.features.splice(fi, 1); if (p.highlightedFeatures && removed !== undefined) { const i = p.highlightedFeatures.findIndex((x) => featEq(x, removed)); if (i >= 0) p.highlightedFeatures.splice(i, 1); } });
  const toggleFeatureHighlight = (k: PlanKey, pi: number, text: string) => mutate((c) => { const p = c[k][pi]; const arr = p.highlightedFeatures ? [...p.highlightedFeatures] : []; const i = arr.findIndex((x) => featEq(x, text)); if (i >= 0) arr.splice(i, 1); else arr.push(text); p.highlightedFeatures = arr; });
  const moveFeature = (k: PlanKey, pi: number, from: number, to: number) => mutate((c) => { const arr = c[k][pi].features; if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return; const [it] = arr.splice(from, 1); arr.splice(to, 0, it); });
  // Al arrastrar una característica por encima de otra (mismo plan), la reordena en vivo.
  const onFeatEnter = (k: PlanKey, pi: number, fi: number) => { if (!drag || drag.k !== k || drag.pi !== pi || drag.fi === fi) return; moveFeature(k, pi, drag.fi, fi); setDrag({ ...drag, fi }); };
  const setLine = (k: LineKey, i: number, field: keyof PriceLine, v: string | number) => mutate((c) => { (c[k][i] as unknown as Record<string, unknown>)[field] = v; });
  const addLine = (k: LineKey) => mutate((c) => { c[k].push({ id: uid(), label: "Nuevo ítem", price: 0, note: "" }); });
  const removeLine = (k: LineKey, i: number) => mutate((c) => { c[k].splice(i, 1); });

  if (!isSuper) return <div style={{ padding: 32, color: "#888", fontFamily: FB }}>Solo superadmin</div>;
  if (!cfg) return <div style={{ padding: 32, color: GOLD, fontFamily: F }}>Cargando planes…</div>;

  const implFor = (name: string) => cfg.implementation.find((l) => l.label.trim().toLowerCase() === name.trim().toLowerCase())?.price ?? null;
  const hv = (f: keyof PricingHeadings) => cfg.headings?.[f] || DEFAULT_HEADINGS[f]; // valor efectivo del encabezado (custom o default)
  // Secciones: 2 por defecto (desde headings) + categorías custom. Cada ítem se muestra en la sección de su categoryId, o en la de su pool.
  const customCats = cfg.categories || [];
  const sections: { id: string; title: string; subtitle: string; accent: boolean }[] = [
    { id: "__plans", title: hv("plansTitle"), subtitle: hv("plansSub"), accent: true },
    { id: "__addons", title: hv("addonsTitle"), subtitle: hv("addonsSub"), accent: false },
    ...customCats.map((c) => ({ id: c.id, title: c.title || "Categoría", subtitle: c.subtitle || "", accent: false })),
  ];
  const validSectionIds = new Set(sections.map((s) => s.id));
  const itemSectionId = (p: PricePlan, pool: PlanKey) => (p.categoryId && validSectionIds.has(p.categoryId)) ? p.categoryId : (pool === "plans" ? "__plans" : "__addons");
  const allItems: { p: PricePlan; pool: PlanKey }[] = [...cfg.plans.map((p) => ({ p, pool: "plans" as PlanKey })), ...cfg.addons.map((p) => ({ p, pool: "addons" as PlanKey }))];
  const anyRecommended = [...cfg.plans, ...cfg.addons].some((p) => p.recommended);
  // Resalta el plan marcado como recomendado. Fallback: si nadie está marcado, resalta el premium (comportamiento anterior).
  const isHighlight = (p: PricePlan, accent: boolean) => p.recommended === true || (!anyRecommended && accent && (p.id === "premium" || /(^|\s)premium$/i.test(p.name.trim())));

  // ───────────────────────── VIEW (landing) ─────────────────────────
  const planCard = (p: PricePlan, accent: boolean) => {
    const impl = implFor(p.name);
    const hi = isHighlight(p, accent);
    const subtitleText = p.subtitle && p.subtitle.trim() ? p.subtitle.trim() : (impl != null ? `+ ${fmt(impl)} implementación única` : null);
    const addonsSum = (p.includedAddons || []).reduce((s, id) => s + (p.addonPrices?.[id] ?? (cfg.addons.find((a) => a.id === id)?.price || 0)), 0);
    const regular = p.price + addonsSum;
    const hasOffer = typeof p.offerPrice === "number" && p.offerPrice > 0 && p.offerPrice < regular;
    const mainPrice = hasOffer ? (p.offerPrice as number) : regular;
    const incAddonNames = (p.includedAddons || []).map((id) => cfg.addons.find((a) => a.id === id)?.name).filter(Boolean) as string[];
    return (
      <div key={p.id} style={{
        position: "relative", background: hi ? "linear-gradient(180deg,#201a0e,#161616)" : "#17181a",
        border: `1px solid ${hi ? GOLD : "#2A2A2A"}`, borderRadius: 18, padding: "26px 22px 24px",
        boxShadow: hi ? "0 0 0 1px rgba(244,166,35,0.25), 0 18px 40px -20px rgba(244,166,35,0.35)" : "0 10px 30px -22px rgba(0,0,0,0.8)",
        display: "flex", flexDirection: "column",
      }}>
        {hi && <span style={{ position: "absolute", top: -11, left: 22, background: GOLD, color: "#111", fontFamily: F, fontWeight: 900, fontSize: "0.62rem", letterSpacing: "0.5px", textTransform: "uppercase", padding: "4px 10px", borderRadius: 50 }}>Recomendado</span>}
        <h3 style={{ fontFamily: F, fontSize: "1.1rem", fontWeight: 900, color: "#fff", margin: "0 0 10px" }}>{p.name}</h3>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
          {p.priceFrom && <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "#9a9a9a", fontWeight: 700 }}>Desde</span>}
          {hasOffer && <span style={{ fontFamily: FB, fontSize: "0.95rem", color: "#888", textDecoration: "line-through", fontWeight: 700 }}>{fmt(regular)}</span>}
          <span style={{ fontFamily: F, fontSize: "2rem", fontWeight: 900, color: hi ? GOLD : "#fff", letterSpacing: "-0.03em" }}>{fmt(mainPrice)}</span>
          <span style={{ fontFamily: FB, fontSize: "0.8rem", color: "#888" }}>/mes</span>
        </div>
        {incAddonNames.length > 0 && <div style={{ fontFamily: FB, fontSize: "0.72rem", color: "#c6ad6b", marginTop: 6 }}>Incluye: {incAddonNames.join(" · ")}</div>}
        {subtitleText && <div style={{ fontFamily: FB, fontSize: "0.72rem", color: "#9a9a9a", marginTop: 6 }}>{subtitleText}</div>}
        <div style={{ height: 1, background: "#2A2A2A", margin: "18px 0 16px" }} />
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 9 }}>
          {p.features.map((f, i) => {
            const fhi = isFeatHi(p, f);
            return (
            <li key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", fontFamily: FB, fontSize: "0.82rem", color: fhi ? "#fff" : "#d4d4d4", fontWeight: fhi ? 800 : 400, lineHeight: 1.35 }}>
              <span style={{ color: GOLD, fontWeight: 900, flexShrink: 0, marginTop: 1 }}>{fhi ? "★" : "✓"}</span>
              <span>{f}</span>
            </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const renderView = () => (
    <>
      {sections.map((s) => {
        const its = allItems.filter(({ p, pool }) => itemSectionId(p, pool) === s.id);
        if (its.length === 0) return null;
        return (
          <div key={s.id}>
            <div style={{ marginBottom: 14 }}>
              <h2 style={{ fontFamily: F, fontSize: "1.25rem", fontWeight: 900, color: "#fff", margin: "0 0 2px" }}>{s.title}</h2>
              {s.subtitle && <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "#888", margin: 0 }}>{s.subtitle}</p>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 34 }}>
              {its.map(({ p }) => planCard(p, s.accent))}
            </div>
          </div>
        );
      })}

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
  const renderPlans = (k: PlanKey) => {
    const tf: keyof PricingHeadings = k === "plans" ? "plansTitle" : "addonsTitle";
    const sf: keyof PricingHeadings = k === "plans" ? "plansSub" : "addonsSub";
    return (
    <div style={card}>
      <p style={{ fontFamily: FB, fontSize: "0.66rem", color: "#777", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700 }}>Título y subtítulo de la sección</p>
      <input style={{ ...inp, fontFamily: F, fontWeight: 900, fontSize: "1.05rem", color: "#fff", marginBottom: 6 }} value={cfg.headings?.[tf] ?? ""} onChange={(e) => setHeading(tf, e.target.value)} placeholder={DEFAULT_HEADINGS[tf]} />
      <input style={{ ...inp, fontSize: "0.8rem", color: "#bbb", marginBottom: 16 }} value={cfg.headings?.[sf] ?? ""} onChange={(e) => setHeading(sf, e.target.value)} placeholder={DEFAULT_HEADINGS[sf]} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        {cfg[k].map((p, pi) => (
          <div key={p.id} style={{ background: "#141414", border: "1px solid #2A2A2A", borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <input style={{ ...inp, fontWeight: 800, color: "#fff" }} value={p.name} onChange={(e) => setPlan(k, pi, "name", e.target.value)} placeholder="Nombre del plan" />
              <button style={xBtn} title="Eliminar plan" onClick={() => removePlan(k, pi)}>✕</button>
            </div>
            <select value={p.categoryId || (k === "plans" ? "__plans" : "__addons")} onChange={(e) => setPlan(k, pi, "categoryId", e.target.value)} style={{ ...inp, padding: "6px 8px", fontSize: "0.78rem", marginBottom: 8, cursor: "pointer" }} title="Categoría / sección donde se muestra">
              {sections.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <span style={{ color: GOLD, fontFamily: F, fontWeight: 900 }}>$</span>
              <input style={{ ...inp, fontFamily: F, fontWeight: 900, fontSize: "1.1rem", color: GOLD }} type="number" min={0} step={100} value={p.price} onChange={(e) => setPlan(k, pi, "price", Math.max(0, Math.round(Number(e.target.value) || 0)))} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, cursor: "pointer", fontFamily: FB, fontSize: "0.78rem", color: p.priceFrom ? "#ddd" : "#888" }}>
              <input type="checkbox" checked={p.priceFrom === true} onChange={(e) => setPlan(k, pi, "priceFrom", e.target.checked)} style={{ accentColor: GOLD, width: 14, height: 14, cursor: "pointer" }} />
              Mostrar “Desde” antes del precio
            </label>
            <input style={{ ...inp, padding: "6px 8px", fontSize: "0.8rem", marginBottom: 8 }} value={p.subtitle || ""} onChange={(e) => setPlan(k, pi, "subtitle", e.target.value)} placeholder="Subtítulo (ej: + $9.900 implementación única)" />
            <label style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12, cursor: "pointer", fontFamily: FB, fontSize: "0.8rem", fontWeight: 700, color: p.recommended ? GOLD : "#999" }}>
              <input type="checkbox" checked={p.recommended === true} onChange={() => setRecommended(k, pi)} style={{ accentColor: GOLD, width: 15, height: 15, cursor: "pointer" }} />
              ⭐ Plan recomendado (resaltado)
            </label>
            {k === "plans" && cfg.addons.length > 0 && (
              <div style={{ border: "1px solid #242424", borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
                <p style={{ fontFamily: FB, fontSize: "0.68rem", color: "#888", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700 }}>Add-ons incluidos</p>
                {cfg.addons.map((a) => {
                  const on = (p.includedAddons || []).includes(a.id);
                  const eff = p.addonPrices?.[a.id] ?? a.price;
                  return (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "2px 0", fontFamily: FB, fontSize: "0.78rem" }}>
                      <input type="checkbox" checked={on} onChange={() => toggleIncludedAddon(k, pi, a.id)} style={{ accentColor: GOLD, width: 14, height: 14, cursor: "pointer", flexShrink: 0 }} />
                      <span onClick={() => toggleIncludedAddon(k, pi, a.id)} style={{ flex: 1, cursor: "pointer", color: on ? "#e8e8e8" : "#8a8a8a" }}>{a.name}</span>
                      {on ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }} title="Monto de este add-on en este plan (editable)">
                          <span style={{ color: "#888" }}>$</span>
                          <input type="number" min={0} step={100} value={eff} onChange={(e) => setAddonPrice(k, pi, a.id, Math.max(0, Math.round(Number(e.target.value) || 0)))} style={{ ...inp, width: 92, padding: "4px 6px", fontSize: "0.76rem", color: GOLD, fontWeight: 700 }} />
                        </span>
                      ) : (
                        <span style={{ color: "#999", flexShrink: 0 }}>{fmt(a.price)}</span>
                      )}
                    </div>
                  );
                })}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, paddingTop: 6, borderTop: "1px solid #242424", fontFamily: FB, fontSize: "0.82rem", fontWeight: 800, color: "#fff" }}>
                  <span>Precio sumado</span>
                  <span style={{ color: GOLD }}>{fmt(p.price + (p.includedAddons || []).reduce((s, id) => s + (p.addonPrices?.[id] ?? (cfg.addons.find((a) => a.id === id)?.price || 0)), 0))}</span>
                </div>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <span style={{ color: "#bbb", fontFamily: FB, fontSize: "0.78rem", whiteSpace: "nowrap" }}>Precio oferta</span>
              <span style={{ color: GOLD, fontFamily: F, fontWeight: 900 }}>$</span>
              <input style={{ ...inp, fontFamily: F, fontWeight: 800, fontSize: "0.95rem", color: GOLD }} type="number" min={0} step={100} value={p.offerPrice ?? ""} onChange={(e) => setPlan(k, pi, "offerPrice", Math.max(0, Math.round(Number(e.target.value) || 0)))} placeholder="0 = sin oferta" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {p.features.map((f, fi) => {
                const dragging = !!drag && drag.k === k && drag.pi === pi && drag.fi === fi;
                return (
                <div
                  key={fi}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnter={() => onFeatEnter(k, pi, fi)}
                  onDrop={(e) => { e.preventDefault(); setDrag(null); }}
                  style={{ display: "flex", gap: 6, alignItems: "center", opacity: dragging ? 0.4 : 1, background: dragging ? "#1e1e1e" : "transparent", borderRadius: 6 }}
                >
                  <span
                    draggable
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", ""); setDrag({ k, pi, fi }); }}
                    onDragEnd={() => setDrag(null)}
                    title="Arrastrar para reordenar"
                    style={{ cursor: "grab", color: "#6f6f6f", fontSize: "1rem", userSelect: "none", padding: "0 3px", flexShrink: 0, lineHeight: 1 }}
                  >⠿</span>
                  <input style={{ ...inp, padding: "6px 8px", fontSize: "0.8rem" }} value={f} onChange={(e) => setFeature(k, pi, fi, e.target.value)} placeholder="Característica" />
                  <button onClick={() => toggleFeatureHighlight(k, pi, f)} title={isFeatHi(p, f) ? "Quitar resaltado" : "Resaltar"} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.95rem", color: isFeatHi(p, f) ? GOLD : "#555", padding: "0 2px", flexShrink: 0, lineHeight: 1 }}>★</button>
                  <button style={xBtn} title="Quitar" onClick={() => removeFeature(k, pi, fi)}>✕</button>
                </div>
                );
              })}
              <button style={{ ...smallBtn, marginTop: 4, alignSelf: "flex-start" }} onClick={() => addFeature(k, pi)}>+ característica</button>
            </div>
          </div>
        ))}
      </div>
      <button style={{ ...smallBtn, marginTop: 14 }} onClick={() => addPlan(k)}>+ agregar {k === "plans" ? "plan" : "paquete"}</button>
    </div>
    );
  };

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

  const renderCategories = () => (
    <div style={card}>
      <h3 style={sectionTitle}>Categorías</h3>
      <p style={sectionSub}>Crea secciones y, con el selector arriba de cada tarjeta, asigna a qué sección va cada plan/add-on. “{DEFAULT_HEADINGS.plansTitle}” y “{DEFAULT_HEADINGS.addonsTitle}” son las secciones por defecto.</p>
      {customCats.length === 0 && <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "#777", margin: "0 0 10px" }}>Aún no hay categorías custom.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {customCats.map((c, ci) => (
          <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input style={{ ...inp, fontWeight: 800, color: "#fff" }} value={c.title} onChange={(e) => setCategoryField(ci, "title", e.target.value)} placeholder="Título de la categoría" />
            <input style={inp} value={c.subtitle || ""} onChange={(e) => setCategoryField(ci, "subtitle", e.target.value)} placeholder="Subtítulo (opcional)" />
            <button style={xBtn} title="Eliminar categoría" onClick={() => removeCategory(ci)}>✕</button>
          </div>
        ))}
      </div>
      <button style={{ ...smallBtn, marginTop: 12 }} onClick={addCategory}>+ agregar categoría</button>
    </div>
  );

  const renderEdit = () => (
    <>
      {renderCategories()}
      {renderPlans("plans")}
      {renderPlans("addons")}
      {renderLines("implementation", "Implementación", "Pago único de puesta en marcha por plan o paquete.", "ítem de implementación")}
      {renderLines("extras", "Otros cobros", "Cobros variables (por mensaje, por metro, dominio, etc.).", "otro cobro")}
    </>
  );

  return (
    <div style={{ padding: "24px 24px 100px", fontFamily: FB }}>
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
