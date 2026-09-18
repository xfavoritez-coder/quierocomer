"use client";
import { useEffect, useState } from "react";
import { CalendarX, Plus, Trash2, Pencil, X, Truck, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { parseClosures, type Closure } from "@/lib/ecommerce/hours";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#F4A623";
const DANGER = "#ef4444";

const card: React.CSSProperties = { background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: 18 };
const inp: React.CSSProperties = { width: "100%", padding: "9px 11px", background: "var(--adm-input, var(--adm-card))", border: "1px solid var(--adm-input-border, var(--adm-card-border))", borderRadius: 9, color: "var(--adm-text)", fontFamily: FB, fontSize: "0.85rem", outline: "none", boxSizing: "border-box" };
const labelSpan: React.CSSProperties = { display: "block", fontFamily: F, fontSize: "0.76rem", fontWeight: 700, color: "var(--adm-text2)", marginBottom: 5 };

function fmt(dt: string): string {
  // "YYYY-MM-DDTHH:MM" → "18 sep 2026, 00:00"
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(dt);
  if (!m) return dt;
  const [, y, mo, d, hh, mm] = m;
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${Number(d)} ${meses[Number(mo) - 1]} ${y}, ${hh}:${mm}`;
}

function nowWall(): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date()).reduce((a, x) => { a[x.type] = x.value; return a; }, {} as Record<string, string>);
  const hh = p.hour === "24" ? "00" : p.hour;
  return `${p.year}-${p.month}-${p.day}T${hh}:${p.minute}`;
}

const EMPTY = { id: "", from: "", to: "", reason: "", affectsDelivery: true, affectsPickup: true };

/** Editor de cierres programados (feriados, vacaciones). Auto-contenido: carga
 *  y guarda la lista en /api/panel/ecommerce/hours (campo `closures`). */
export default function CierresEditor({ restaurantId }: { restaurantId?: string | null }) {
  const [closures, setClosures] = useState<Closure[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const editing = !!form.id;

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    fetch(`/api/panel/ecommerce/hours?restaurantId=${restaurantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.hours) setClosures(parseClosures(d.hours.closures)); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [restaurantId]);

  async function persist(next: Closure[]) {
    if (!restaurantId) return false;
    setSaving(true);
    try {
      const res = await fetch("/api/panel/ecommerce/hours", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, closures: next }) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Error al guardar"); setSaving(false); return false; }
      setClosures(parseClosures(data.hours?.closures));
      setSaving(false);
      return true;
    } catch { toast.error("Error de conexión"); setSaving(false); return false; }
  }

  async function guardar() {
    const reason = form.reason.trim();
    if (!form.from || !form.to) { toast.error("Indica desde y hasta"); return; }
    if (form.to <= form.from) { toast.error("La fecha de término debe ser posterior al inicio"); return; }
    if (!reason) { toast.error("Escribe el motivo del cierre"); return; }
    if (!form.affectsDelivery && !form.affectsPickup) { toast.error("El cierre debe afectar al menos un método"); return; }
    const nuevo: Closure = { id: form.id || `cl_${Date.now().toString(36)}`, from: form.from, to: form.to, reason, affectsDelivery: form.affectsDelivery, affectsPickup: form.affectsPickup };
    const next = editing ? closures.map((c) => (c.id === nuevo.id ? nuevo : c)) : [...closures, nuevo];
    next.sort((a, b) => a.from.localeCompare(b.from));
    const ok = await persist(next);
    if (ok) { toast.success(editing ? "Cierre actualizado" : "Cierre programado"); setForm(EMPTY); }
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar este cierre programado?")) return;
    const ok = await persist(closures.filter((c) => c.id !== id));
    if (ok) { toast.success("Cierre eliminado"); if (form.id === id) setForm(EMPTY); }
  }

  if (loading) return <p style={{ fontFamily: FB, color: "var(--adm-text3)" }}>Cargando cierres…</p>;

  const wall = nowWall();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <CalendarX size={18} color={ACCENT} style={{ flexShrink: 0 }} />
        <div>
          <h2 style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Cierres programados</h2>
          <p style={{ fontFamily: FB, fontSize: "0.76rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>Feriados o vacaciones: la tienda muestra el motivo y bloquea los métodos que elijas.</p>
        </div>
      </div>

      {/* Lista de cierres */}
      {closures.length > 0 && (
        <section style={{ ...card, display: "flex", flexDirection: "column", gap: 8 }}>
          {closures.map((c) => {
            const activo = c.from <= wall && wall < c.to;
            const pasado = c.to <= wall;
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--adm-card-border)", opacity: pasado ? 0.55 : 1, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 700, color: "var(--adm-text)" }}>{c.reason}</span>
                    {activo && <span style={{ fontSize: "0.62rem", fontWeight: 800, color: "#fff", background: DANGER, padding: "2px 7px", borderRadius: 999 }}>EN CURSO</span>}
                    {pasado && <span style={{ fontSize: "0.62rem", fontWeight: 800, color: "var(--adm-text3)", background: "var(--adm-hover)", padding: "2px 7px", borderRadius: 999 }}>FINALIZADO</span>}
                  </div>
                  <p style={{ fontFamily: FB, fontSize: "0.76rem", color: "var(--adm-text2)", margin: "3px 0 0" }}>{fmt(c.from)} → {fmt(c.to)}</p>
                  <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                    {c.affectsDelivery && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontFamily: FB, fontSize: "0.68rem", fontWeight: 700, color: "var(--adm-text2)", background: "var(--adm-hover)", padding: "2px 7px", borderRadius: 6 }}><Truck size={11} /> Delivery</span>}
                    {c.affectsPickup && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontFamily: FB, fontSize: "0.68rem", fontWeight: 700, color: "var(--adm-text2)", background: "var(--adm-hover)", padding: "2px 7px", borderRadius: 6 }}><ShoppingBag size={11} /> Retiro</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button onClick={() => setForm({ id: c.id, from: c.from, to: c.to, reason: c.reason, affectsDelivery: c.affectsDelivery, affectsPickup: c.affectsPickup })} title="Editar" style={{ width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", cursor: "pointer" }}><Pencil size={14} /></button>
                  <button onClick={() => eliminar(c.id)} title="Eliminar" style={{ width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: "transparent", color: DANGER, cursor: "pointer" }}><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Formulario nuevo / editar */}
      <section style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>{editing ? "Editar cierre" : "Nuevo cierre"}</p>
          {editing && <button onClick={() => setForm(EMPTY)} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: FB, fontSize: "0.76rem", color: "var(--adm-text3)", background: "transparent", border: "none", cursor: "pointer" }}><X size={14} /> Cancelar</button>}
        </div>

        <label>
          <span style={labelSpan}>Motivo (lo verá el cliente)</span>
          <input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Ej: Feriado 18 y 19 de septiembre" style={inp} maxLength={200} />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ minWidth: 0 }}>
            <span style={labelSpan}>Desde</span>
            <input type="datetime-local" value={form.from} onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))} style={inp} />
          </label>
          <label style={{ minWidth: 0 }}>
            <span style={labelSpan}>Hasta</span>
            <input type="datetime-local" value={form.to} onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))} style={inp} />
          </label>
        </div>
        <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)", margin: "-4px 2px 0" }}>Hora de Chile. Para cerrar todo el 18 y 19, pon <strong>Desde</strong> 18-09 00:00 y <strong>Hasta</strong> 20-09 00:00.</p>

        <div>
          <span style={labelSpan}>¿Qué métodos cierra?</span>
          <div style={{ display: "flex", gap: 8 }}>
            <MetodoChip on={form.affectsDelivery} onClick={() => setForm((f) => ({ ...f, affectsDelivery: !f.affectsDelivery }))} icon={<Truck size={15} />} label="Delivery" />
            <MetodoChip on={form.affectsPickup} onClick={() => setForm((f) => ({ ...f, affectsPickup: !f.affectsPickup }))} icon={<ShoppingBag size={15} />} label="Retiro" />
          </div>
          <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)", margin: "6px 2px 0" }}>Si cierras solo uno, el otro sigue disponible. Si cierras ambos, la tienda queda cerrada.</p>
        </div>

        <button onClick={guardar} disabled={saving} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", background: ACCENT, border: "none", borderRadius: 10, color: "#1a1a1a", fontFamily: F, fontSize: "0.85rem", fontWeight: 800, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }}>
          <Plus size={16} /> {saving ? "Guardando…" : editing ? "Guardar cambios" : "Agregar cierre"}
        </button>
      </section>
    </div>
  );
}

function MetodoChip({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${on ? ACCENT : "var(--adm-card-border)"}`, background: on ? `${ACCENT}1a` : "transparent", color: on ? ACCENT : "var(--adm-text2)", fontFamily: F, fontSize: "0.84rem", fontWeight: 800, cursor: "pointer" }}>
      {icon} {label}
    </button>
  );
}
