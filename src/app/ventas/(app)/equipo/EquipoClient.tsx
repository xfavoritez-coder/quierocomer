"use client";

import { useState } from "react";

type Row = { id: string; name: string; email: string; role: "ADMIN" | "SELLER"; active: boolean; leads: number; lastLoginAt: string | null };

export default function EquipoClient({ meId, initial }: { meId: string; initial: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"SELLER" | "ADMIN">("SELLER");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await fetch("/api/ventas/sellers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, role }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(d.error || "No se pudo agregar"); return; }
    setRows((x) => [...x, { ...d.seller, leads: 0, lastLoginAt: null }]);
    setName(""); setEmail(""); setRole("SELLER");
    setMsg(`Listo. ${d.seller.name} ya puede entrar en quierocomer.com/ventas con su correo.`);
  };

  const toggle = async (row: Row) => {
    const r = await fetch("/api/ventas/sellers", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id, active: !row.active }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) setRows((x) => x.map((s) => (s.id === row.id ? { ...s, active: d.seller.active } : s)));
  };

  const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short" }) : "nunca";

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Mi equipo</h1>

      <ShowcaseAdmin />

      <div className="ventas-card" style={{ overflow: "hidden" }}>
        {rows.map((s, i) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "13px 18px", borderTop: i ? "1px solid var(--line)" : "none", opacity: s.active ? 1 : 0.5 }}>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{s.name} {s.role === "ADMIN" && <span style={{ fontSize: 11, color: "var(--amber)", fontWeight: 800, marginLeft: 6 }}>ADMIN</span>}</div>
              <div style={{ fontSize: 13, color: "var(--ink-3)" }}>{s.email}</div>
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-2)" }}><span className="ventas-mono">{s.leads}</span> locales</div>
            <div style={{ fontSize: 12, color: "var(--ink-3)", minWidth: 110 }}>último ingreso: {fmt(s.lastLoginAt)}</div>
            {s.id !== meId && (
              <button className="ventas-btn ghost" style={{ padding: "6px 12px", fontSize: 13 }} onClick={() => toggle(s)}>
                {s.active ? "Desactivar" : "Activar"}
              </button>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={add} className="ventas-card" style={{ padding: 20, display: "grid", gap: 10, maxWidth: 520 }}>
        <div style={{ fontWeight: 800 }}>Agregar vendedor</div>
        <input className="ventas-input" required placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="ventas-input" required type="email" placeholder="correo@ejemplo.cl" value={email} onChange={(e) => setEmail(e.target.value)} />
        <select className="ventas-input" value={role} onChange={(e) => setRole(e.target.value as "SELLER" | "ADMIN")}>
          <option value="SELLER">Vendedor (ve solo sus locales)</option>
          <option value="ADMIN">Administrador (ve todo)</option>
        </select>
        {msg && <p style={{ fontSize: 13, margin: 0, color: msg.startsWith("Listo") ? "#16a34a" : "#dc2626" }}>{msg}</p>}
        <button className="ventas-btn" disabled={busy}>{busy ? "Agregando…" : "Agregar"}</button>
      </form>
    </div>
  );
}

/** Crear o regenerar el local de muestra (panel y POS con datos para mostrar en las demos). */
function ShowcaseAdmin() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const run = async () => {
    setBusy(true); setMsg("Generando… puede tardar hasta un par de minutos.");
    try {
      const r = await fetch("/api/ventas/showcase/seed", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      setMsg(r.ok ? `Listo: ${d.restaurants} sucursales, ${Number(d.orders).toLocaleString("es-CL")} pedidos y ${d.customers} clientes. Carta: ${d.source}.` : d.error || "No se pudo generar");
    } catch { setMsg("Error de conexión"); } finally { setBusy(false); }
  };
  return (
    <div className="ventas-card" style={{ padding: 18, display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 800 }}>Local de muestra</div>
      <p style={{ margin: 0, fontSize: 14, color: "var(--ink-2)", lineHeight: 1.5 }}>
        Una marca vegana ficticia con 3 sucursales y un año de datos (ventas, mesas, clientes, fidelización y recuperación) con la carta y fotos de Horus Vegan.
        En la demo, la página <b>Accesos</b> abre su panel y su POS. Se actualiza solo cada día; no aparece en el sitio público.
      </p>
      <div><button className="ventas-btn" onClick={run} disabled={busy}>{busy ? "Generando…" : "Crear / regenerar local de muestra"}</button></div>
      {msg && <p style={{ margin: 0, fontSize: 14, color: "var(--ink-2)" }}>{msg}</p>}
    </div>
  );
}
