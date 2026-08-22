"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Save, Ticket, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useSessionContext } from "@/lib/admin/SessionContext";
import { parseCoupons, DAY_CODES, type Coupon } from "@/lib/ecommerce/coupons";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#F4A623";
const DAY_LABELS: Record<string, string> = { D: "Dom", L: "Lun", M: "Mar", Mi: "Mié", J: "Jue", V: "Vie", S: "Sáb" };

type Dish = { id: string; name: string };

function newCoupon(): Coupon {
  return { id: Math.random().toString(36).slice(2, 9), code: "", label: "", isEnabled: true, type: "discount", discountType: "fixed", discountValue: 0, maxDiscountAmount: null, startDate: null, endDate: null, startTime: null, endTime: null, daysOfWeek: [], appliesDelivery: true, appliesPickup: true, minOrderAmount: null, maxUses: null, maxUsesPerUser: null, freeProductId: null };
}

export default function CouponsPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [uses, setUses] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    fetch(`/api/panel/ecommerce/coupons?restaurantId=${restaurantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setCoupons(parseCoupons(d.coupons)); setDishes(d.dishes || []); setUses(d.uses || {}); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [restaurantId]);

  const upd = (id: string, p: Partial<Coupon>) => setCoupons((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const del = (id: string) => setCoupons((cs) => cs.filter((c) => c.id !== id));
  const add = () => { const c = newCoupon(); setCoupons((cs) => [...cs, c]); setExpanded(c.id); };
  const toggleDay = (id: string, day: string) => { const c = coupons.find((x) => x.id === id); if (!c) return; upd(id, { daysOfWeek: c.daysOfWeek.includes(day) ? c.daysOfWeek.filter((d) => d !== day) : [...c.daysOfWeek, day] }); };
  const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v.replace(/\D/g, "")) || 0);

  async function save() {
    if (!restaurantId) return;
    const clean = coupons.filter((c) => c.code.trim());
    setSaving(true);
    try {
      const res = await fetch("/api/panel/ecommerce/coupons", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, coupons: clean }) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Error al guardar"); setSaving(false); return; }
      setCoupons(parseCoupons(data.coupons));
      toast.success("Cupones guardados");
    } catch { toast.error("Error de conexión"); }
    setSaving(false);
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "8px 4px 40px" }}>
      <Link href="/panel/ecommerce" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", textDecoration: "none", marginBottom: 18 }}>
        <ArrowLeft size={15} /> Ecommerce
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${ACCENT}1a`, display: "flex", alignItems: "center", justifyContent: "center" }}><Ticket size={20} color={ACCENT} /></div>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Cupones de descuento</h1>
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>Códigos con % o monto fijo, vigencia, mínimo y límites de uso.</p>
        </div>
      </div>

      {loading ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)", marginTop: 24 }}>Cargando…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
          {coupons.length === 0 && <div style={{ textAlign: "center", padding: "36px 20px", border: "1px dashed var(--adm-card-border)", borderRadius: 14, fontFamily: FB, color: "var(--adm-text3)" }}>Aún no tienes cupones. Crea el primero.</div>}

          {coupons.map((c) => {
            const open = expanded === c.id;
            const used = uses[c.code] ?? 0;
            const summary = c.type === "product" ? "Producto gratis" : c.discountType === "percent" ? `${c.discountValue}% off` : `−$${c.discountValue.toLocaleString("es-CL")}`;
            return (
              <div key={c.id} style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setExpanded(open ? null : c.id)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: F, fontSize: "0.92rem", fontWeight: 800, color: "var(--adm-text)", margin: 0, letterSpacing: 0.5 }}>{c.code || "(sin código)"} <span style={{ fontFamily: FB, fontSize: "0.72rem", fontWeight: 600, color: "var(--adm-text3)", letterSpacing: 0 }}>· {summary}</span></p>
                    <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>{c.isEnabled ? "Activo" : "Inactivo"}{used > 0 ? ` · ${used} uso${used !== 1 ? "s" : ""}` : ""}</p>
                  </div>
                  <Toggle on={c.isEnabled} onClick={(e) => { e.stopPropagation(); upd(c.id, { isEnabled: !c.isEnabled }); }} />
                  <ChevronDown size={18} color="var(--adm-text3)" style={{ transform: open ? "rotate(180deg)" : "none", transition: ".2s" }} />
                </div>

                {open && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--adm-card-border)", display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 10 }}>
                      <Field label="Código"><input value={c.code} onChange={(e) => upd(c.id, { code: e.target.value.toUpperCase() })} placeholder="EJ: BIENVENIDA20" style={{ ...inp, fontFamily: "monospace" }} /></Field>
                      <Field label="Descripción (opcional)"><input value={c.label ?? ""} onChange={(e) => upd(c.id, { label: e.target.value })} placeholder="20% primera compra" style={inp} /></Field>
                    </div>

                    <Field label="Tipo">
                      <Seg options={[{ v: "discount", l: "Descuento" }, { v: "product", l: "Producto gratis" }]} value={c.type} onChange={(v) => upd(c.id, { type: v as Coupon["type"] })} />
                    </Field>

                    {c.type === "discount" ? (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 10 }}>
                        <Field label="Modo"><Seg options={[{ v: "fixed", l: "$ Fijo" }, { v: "percent", l: "% Porcentaje" }]} value={c.discountType} onChange={(v) => upd(c.id, { discountType: v as Coupon["discountType"] })} /></Field>
                        <Field label={c.discountType === "percent" ? "Porcentaje" : "Monto $"}><input value={c.discountValue || ""} onChange={(e) => upd(c.id, { discountValue: numOrNull(e.target.value) ?? 0 })} inputMode="numeric" placeholder={c.discountType === "percent" ? "20" : "2000"} style={inp} /></Field>
                        {c.discountType === "percent" && <Field label="Tope $ (opc)"><input value={c.maxDiscountAmount ?? ""} onChange={(e) => upd(c.id, { maxDiscountAmount: numOrNull(e.target.value) })} inputMode="numeric" placeholder="—" style={inp} /></Field>}
                      </div>
                    ) : (
                      <Field label="Producto gratis"><select value={c.freeProductId ?? ""} onChange={(e) => upd(c.id, { freeProductId: e.target.value || null })} style={inp}><option value="">Elige un producto…</option>{dishes.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
                    )}

                    <Field label="Aplica en">
                      <div style={{ display: "flex", gap: 14 }}>
                        <Check label="Delivery" on={c.appliesDelivery} onClick={() => upd(c.id, { appliesDelivery: !c.appliesDelivery })} />
                        <Check label="Retiro" on={c.appliesPickup} onClick={() => upd(c.id, { appliesPickup: !c.appliesPickup })} />
                      </div>
                    </Field>

                    <Field label="Días válidos (vacío = todos)">
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {DAY_CODES.map((d) => { const on = c.daysOfWeek.includes(d); return <button key={d} onClick={() => toggleDay(c.id, d)} style={{ padding: "5px 10px", borderRadius: 8, fontFamily: FB, fontSize: "0.74rem", fontWeight: 600, cursor: "pointer", border: `1px solid ${on ? ACCENT : "var(--adm-card-border)"}`, background: on ? `${ACCENT}22` : "transparent", color: on ? ACCENT : "var(--adm-text2)" }}>{DAY_LABELS[d]}</button>; })}
                      </div>
                    </Field>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 10 }}>
                      <Field label="Desde (fecha)"><input type="date" value={c.startDate ?? ""} onChange={(e) => upd(c.id, { startDate: e.target.value || null })} style={inp} /></Field>
                      <Field label="Hasta (fecha)"><input type="date" value={c.endDate ?? ""} onChange={(e) => upd(c.id, { endDate: e.target.value || null })} style={inp} /></Field>
                      <Field label="Desde (hora)"><input type="time" value={c.startTime ?? ""} onChange={(e) => upd(c.id, { startTime: e.target.value || null })} style={inp} /></Field>
                      <Field label="Hasta (hora)"><input type="time" value={c.endTime ?? ""} onChange={(e) => upd(c.id, { endTime: e.target.value || null })} style={inp} /></Field>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 10 }}>
                      <Field label="Monto mínimo $"><input value={c.minOrderAmount ?? ""} onChange={(e) => upd(c.id, { minOrderAmount: numOrNull(e.target.value) })} inputMode="numeric" placeholder="—" style={inp} /></Field>
                      <Field label="Usos totales"><input value={c.maxUses ?? ""} onChange={(e) => upd(c.id, { maxUses: numOrNull(e.target.value) })} inputMode="numeric" placeholder="ilimitado" style={inp} /></Field>
                      <Field label="Usos por cliente"><input value={c.maxUsesPerUser ?? ""} onChange={(e) => upd(c.id, { maxUsesPerUser: numOrNull(e.target.value) })} inputMode="numeric" placeholder="ilimitado" style={inp} /></Field>
                    </div>

                    <button onClick={() => del(c.id)} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, color: "#ef4444", fontFamily: F, fontSize: "0.76rem", fontWeight: 600, padding: "7px 12px", cursor: "pointer" }}><Trash2 size={14} /> Eliminar cupón</button>
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
            <button onClick={add} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}><Plus size={16} /> Agregar cupón</button>
            <button onClick={save} disabled={saving} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", background: ACCENT, border: "none", borderRadius: 10, color: "#1a1a1a", fontFamily: F, fontSize: "0.82rem", fontWeight: 800, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }}><Save size={16} /> {saving ? "Guardando…" : "Guardar cupones"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

const card: React.CSSProperties = { background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: 14 };
const inp: React.CSSProperties = { width: "100%", marginTop: 4, padding: "8px 10px", background: "var(--adm-input, var(--adm-card))", border: "1px solid var(--adm-input-border, var(--adm-card-border))", borderRadius: 8, color: "var(--adm-text)", fontFamily: FB, fontSize: "0.84rem", outline: "none" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: "block" }}><span style={{ fontFamily: FB, fontSize: "0.66rem", fontWeight: 700, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</span>{children}</label>;
}

function Seg({ options, value, onChange }: { options: { v: string; l: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
      {options.map((o) => { const on = value === o.v; return <button key={o.v} onClick={() => onChange(o.v)} style={{ flex: 1, padding: "8px", borderRadius: 8, cursor: "pointer", fontFamily: F, fontSize: "0.78rem", fontWeight: 700, border: `1px solid ${on ? ACCENT : "var(--adm-card-border)"}`, background: on ? ACCENT : "var(--adm-hover)", color: on ? "#1a1a1a" : "var(--adm-text2)" }}>{o.l}</button>; })}
    </div>
  );
}

function Check({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", fontFamily: FB, fontSize: "0.82rem", fontWeight: 600, color: on ? "var(--adm-text)" : "var(--adm-text3)", marginTop: 4 }}>
    <span style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${on ? ACCENT : "var(--adm-card-border)"}`, background: on ? ACCENT : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#1a1a1a", fontSize: 13, fontWeight: 900 }}>{on ? "✓" : ""}</span>
    {label}
  </button>;
}

function Toggle({ on, onClick }: { on: boolean; onClick: (e: React.MouseEvent) => void }) {
  return <button onClick={onClick} style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", position: "relative", background: on ? "#22c55e" : "var(--adm-toggle-off, #ccc)", flexShrink: 0 }}><span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 2px rgba(0,0,0,.3)" }} /></button>;
}
