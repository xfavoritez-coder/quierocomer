"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Save, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { useSessionContext } from "@/lib/admin/SessionContext";
import { parseAccompConfig, emptyAccompConfig, type AccompConfig } from "@/lib/ecommerce/accompaniments";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#F4A623";

type Dish = { id: string; name: string };

export default function AccompanimentsPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const [cfg, setCfg] = useState<AccompConfig>(emptyAccompConfig());
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    fetch(`/api/panel/ecommerce/accompaniments?restaurantId=${restaurantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setCfg(parseAccompConfig(d.config)); setDishes(d.dishes || []); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [restaurantId]);

  const patch = (p: Partial<AccompConfig>) => setCfg((c) => ({ ...c, ...p }));

  // Items (por monto)
  const addItem = () => patch({ items: [...cfg.items, { name: "", qtyPer: 1, perAmount: 10000, minOrder: 0 }] });
  const updItem = (i: number, p: Partial<AccompConfig["items"][0]>) => patch({ items: cfg.items.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const delItem = (i: number) => patch({ items: cfg.items.filter((_, j) => j !== i) });

  // Groups (por producto)
  const addGroup = () => patch({ groups: [...cfg.groups, { id: Math.random().toString(36).slice(2, 9), name: "", options: [] }] });
  const updGroup = (i: number, p: Partial<AccompConfig["groups"][0]>) => patch({ groups: cfg.groups.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const delGroup = (i: number) => { const g = cfg.groups[i]; patch({ groups: cfg.groups.filter((_, j) => j !== i), rules: cfg.rules.filter((r) => r.groupId !== g.id) }); };
  const toggleOpt = (gi: number, name: string) => { const g = cfg.groups[gi]; updGroup(gi, { options: g.options.includes(name) ? g.options.filter((o) => o !== name) : [...g.options, name] }); };

  // Rules (producto -> grupo)
  const addRule = () => patch({ rules: [...cfg.rules, { productId: dishes[0]?.id ?? "", groupId: cfg.groups[0]?.id ?? "", quantity: 1 }] });
  const updRule = (i: number, p: Partial<AccompConfig["rules"][0]>) => patch({ rules: cfg.rules.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const delRule = (i: number) => patch({ rules: cfg.rules.filter((_, j) => j !== i) });

  async function save() {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/panel/ecommerce/accompaniments", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, config: cfg }) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Error al guardar"); setSaving(false); return; }
      setCfg(parseAccompConfig(data.config));
      toast.success("Acompañamientos guardados");
    } catch { toast.error("Error de conexión"); }
    setSaving(false);
  }

  const itemNames = cfg.items.map((i) => i.name).filter(Boolean);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "8px 4px 40px" }}>
      <Link href="/panel/ecommerce/configuracion" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", textDecoration: "none", marginBottom: 18 }}>
        <ArrowLeft size={15} /> Configuración
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${ACCENT}1a`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <UtensilsCrossed size={20} color={ACCENT} />
        </div>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Acompañamientos</h1>
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>Palitos, salsas y extras que el cliente elige en el checkout.</p>
        </div>
      </div>

      {loading ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)", marginTop: 24 }}>Cargando…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 20 }}>
          {/* ── Por monto ── */}
          <section style={card}>
            <div style={rowBetween}>
              <div>
                <h2 style={h2}>Por monto del pedido</h2>
                <p style={sub}>La cantidad máxima depende del subtotal (ej: 1 palito por cada $10.000).</p>
              </div>
              <Toggle on={cfg.perAmountEnabled} onClick={() => patch({ perAmountEnabled: !cfg.perAmountEnabled })} />
            </div>

            {cfg.perAmountEnabled && (
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                {cfg.items.map((it, i) => (
                  <div key={i} style={{ background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: 12 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                      <div style={{ flex: "1 1 160px", minWidth: 130 }}>
                        <label style={lbl}>Nombre</label>
                        <input value={it.name} onChange={(e) => updItem(i, { name: e.target.value })} placeholder="Ej: Palitos" style={inp} />
                      </div>
                      <div style={{ flex: "0 1 90px", minWidth: 80 }}>
                        <label style={lbl}>Cantidad</label>
                        <input value={it.qtyPer || ""} onChange={(e) => updItem(i, { qtyPer: Number(e.target.value.replace(/\D/g, "")) || 1 })} inputMode="numeric" placeholder="1" style={inp} />
                      </div>
                      <div style={{ flex: "0 1 110px", minWidth: 90 }}>
                        <label style={lbl}>Por cada $</label>
                        <input value={it.perAmount || ""} onChange={(e) => updItem(i, { perAmount: Number(e.target.value.replace(/\D/g, "")) || 0 })} inputMode="numeric" placeholder="10000" style={inp} />
                      </div>
                      <div style={{ flex: "0 1 110px", minWidth: 90 }}>
                        <label style={lbl}>Mínimo $ (opc)</label>
                        <input value={it.minOrder || ""} onChange={(e) => updItem(i, { minOrder: Number(e.target.value.replace(/\D/g, "")) || 0 })} inputMode="numeric" placeholder="0" style={inp} />
                      </div>
                      <button onClick={() => delItem(i)} style={delBtn} title="Quitar"><Trash2 size={15} /></button>
                    </div>
                  </div>
                ))}
                {cfg.items.length === 0 && <p style={empty}>No hay acompañamientos. Agrega el primero.</p>}
                <button onClick={addItem} style={addBtn}><Plus size={15} /> Agregar acompañamiento</button>
                <p style={hint}><strong>Mínimo $</strong>: si el pedido no lo alcanza, el acompañamiento no aparece. 0 = siempre aparece.</p>
              </div>
            )}
          </section>

          {/* ── Por producto ── */}
          <section style={card}>
            <div style={rowBetween}>
              <div>
                <h2 style={h2}>Por producto específico</h2>
                <p style={sub}>Cada producto otorga un &quot;pool&quot; a un grupo de opciones (ej: cada roll da 2 salsas).</p>
              </div>
              <Toggle on={cfg.perProductEnabled} onClick={() => patch({ perProductEnabled: !cfg.perProductEnabled })} />
            </div>

            {cfg.perProductEnabled && (
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Grupos */}
                <div>
                  <p style={{ ...lbl, marginBottom: 8 }}>Grupos de opciones</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {cfg.groups.map((g, gi) => (
                      <div key={g.id} style={{ background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: 12 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input value={g.name} onChange={(e) => updGroup(gi, { name: e.target.value })} placeholder="Nombre del grupo (ej: Salsas)" style={{ ...inp, marginTop: 0 }} />
                          <button onClick={() => delGroup(gi)} style={delBtn} title="Quitar grupo"><Trash2 size={15} /></button>
                        </div>
                        <p style={{ ...hint, margin: "8px 0 6px" }}>Opciones del grupo (desde los acompañamientos por monto):</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {itemNames.length === 0 && <span style={{ ...empty, padding: 0 }}>Primero agrega acompañamientos por monto.</span>}
                          {itemNames.map((name) => {
                            const on = g.options.includes(name);
                            return (
                              <button key={name} onClick={() => toggleOpt(gi, name)} style={{ padding: "5px 11px", borderRadius: 999, fontFamily: FB, fontSize: "0.76rem", fontWeight: 600, cursor: "pointer", border: `1px solid ${on ? ACCENT : "var(--adm-card-border)"}`, background: on ? `${ACCENT}22` : "transparent", color: on ? ACCENT : "var(--adm-text2)" }}>{name}</button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {cfg.groups.length === 0 && <p style={empty}>No hay grupos.</p>}
                    <button onClick={addGroup} style={addBtn}><Plus size={15} /> Agregar grupo</button>
                  </div>
                </div>

                {/* Reglas */}
                <div>
                  <p style={{ ...lbl, marginBottom: 8 }}>Reglas por producto</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {cfg.rules.map((rule, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: 10 }}>
                        <select value={rule.productId} onChange={(e) => updRule(i, { productId: e.target.value })} style={{ ...inp, marginTop: 0, flex: "1 1 160px", minWidth: 130 }}>
                          {dishes.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)" }}>otorga</span>
                        <input value={rule.quantity || ""} onChange={(e) => updRule(i, { quantity: Number(e.target.value.replace(/\D/g, "")) || 1 })} inputMode="numeric" style={{ ...inp, marginTop: 0, width: 60, flex: "0 0 60px" }} />
                        <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)" }}>a</span>
                        <select value={rule.groupId} onChange={(e) => updRule(i, { groupId: e.target.value })} style={{ ...inp, marginTop: 0, flex: "1 1 130px", minWidth: 110 }}>
                          {cfg.groups.map((g) => <option key={g.id} value={g.id}>{g.name || "(sin nombre)"}</option>)}
                        </select>
                        <button onClick={() => delRule(i)} style={delBtn} title="Quitar"><Trash2 size={15} /></button>
                      </div>
                    ))}
                    {cfg.rules.length === 0 && <p style={empty}>No hay reglas. Agrega qué productos otorgan pool.</p>}
                    <button onClick={addRule} disabled={!dishes.length || !cfg.groups.length} style={{ ...addBtn, opacity: !dishes.length || !cfg.groups.length ? 0.5 : 1 }}><Plus size={15} /> Agregar regla</button>
                    {!cfg.groups.length && <p style={hint}>Crea al menos un grupo para poder agregar reglas.</p>}
                  </div>
                </div>
              </div>
            )}
          </section>

          <button onClick={save} disabled={saving} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, padding: "11px 20px", background: ACCENT, border: "none", borderRadius: 10, color: "#1a1a1a", fontFamily: F, fontSize: "0.85rem", fontWeight: 800, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }}>
            <Save size={16} /> {saving ? "Guardando…" : "Guardar acompañamientos"}
          </button>
        </div>
      )}
    </div>
  );
}

const card: React.CSSProperties = { background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: 18 };
const rowBetween: React.CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 };
const h2: React.CSSProperties = { fontFamily: F, fontSize: "0.95rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 };
const sub: React.CSSProperties = { fontFamily: FB, fontSize: "0.76rem", color: "var(--adm-text3)", margin: "2px 0 0", lineHeight: 1.4, maxWidth: 440 };
const lbl: React.CSSProperties = { fontFamily: FB, fontSize: "0.66rem", fontWeight: 700, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: 0.4, display: "block" };
const inp: React.CSSProperties = { width: "100%", marginTop: 4, padding: "8px 10px", background: "var(--adm-input, var(--adm-card))", border: "1px solid var(--adm-input-border, var(--adm-card-border))", borderRadius: 8, color: "var(--adm-text)", fontFamily: FB, fontSize: "0.84rem", outline: "none" };
const hint: React.CSSProperties = { fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "4px 2px 0", lineHeight: 1.4 };
const empty: React.CSSProperties = { fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", padding: "8px 2px", margin: 0 };
const addBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", alignSelf: "flex-start" };
const delBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, background: "transparent", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, color: "#ef4444", cursor: "pointer", flexShrink: 0 };

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: 46, height: 26, borderRadius: 13, border: "none", cursor: "pointer", position: "relative", background: on ? "#22c55e" : "var(--adm-toggle-off, #ccc)", transition: "background .2s", flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
    </button>
  );
}
