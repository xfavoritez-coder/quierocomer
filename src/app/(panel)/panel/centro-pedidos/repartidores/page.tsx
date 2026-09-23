"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bike, Plus, Pencil, X, Users } from "lucide-react";
import { toast } from "sonner";
import { useSessionContext } from "@/lib/admin/SessionContext";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#F4A623";

type Driver = { id: string; username: string; displayName: string; role: string; active: boolean; isOnShift: boolean };
type Responsible = { id: string; name: string; roleLabel: string | null; active: boolean };

const inp: React.CSSProperties = { width: "100%", padding: "9px 11px", background: "var(--adm-input, var(--adm-card))", border: "1px solid var(--adm-input-border, var(--adm-card-border))", borderRadius: 9, color: "var(--adm-text)", fontFamily: FB, fontSize: "0.86rem", outline: "none", boxSizing: "border-box" };
const label: React.CSSProperties = { display: "block", fontFamily: F, fontSize: "0.74rem", fontWeight: 700, color: "var(--adm-text2)", marginBottom: 4 };
const card: React.CSSProperties = { background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: 16 };

export default function RepartidoresPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [resps, setResps] = useState<Responsible[]>([]);
  const [loading, setLoading] = useState(true);
  const [driverModal, setDriverModal] = useState<Driver | "new" | null>(null);
  const [respModal, setRespModal] = useState<Responsible | "new" | null>(null);

  const load = () => {
    if (!restaurantId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/panel/ecommerce/drivers?restaurantId=${restaurantId}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/panel/ecommerce/responsibles?restaurantId=${restaurantId}`).then((r) => r.ok ? r.json() : null),
    ]).then(([d, r]) => { if (d?.drivers) setDrivers(d.drivers); if (r?.responsibles) setResps(r.responsibles); }).finally(() => setLoading(false));
  };
  useEffect(load, [restaurantId]);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "8px 4px 60px" }}>
      <Link href="/panel/centro-pedidos" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", textDecoration: "none", marginBottom: 16 }}>
        <ArrowLeft size={15} /> Centro de pedidos
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${ACCENT}1a`, display: "flex", alignItems: "center", justifyContent: "center" }}><Bike size={20} color={ACCENT} /></div>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Repartidores</h1>
          <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>Cuentas de la app de repartidor y responsables del local.</p>
        </div>
      </div>

      {loading ? <p style={{ fontFamily: FB, color: "var(--adm-text3)", padding: 20 }}>Cargando…</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {/* Repartidores */}
          <section>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
              <h2 style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 800, color: "var(--adm-text)", margin: 0, flex: 1 }}>Cuentas de repartidor</h2>
              <button onClick={() => setDriverModal("new")} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 13px", borderRadius: 9, border: "none", background: ACCENT, color: "#1a1a1a", fontFamily: F, fontSize: "0.8rem", fontWeight: 800, cursor: "pointer" }}><Plus size={15} /> Nuevo</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {drivers.length === 0 && <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", ...card }}>Sin repartidores aún.</p>}
              {drivers.map((d) => (
                <div key={d.id} style={{ ...card, display: "flex", alignItems: "center", gap: 12, opacity: d.active ? 1 : 0.55, padding: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>{d.displayName} {d.role === "admin" ? <span style={{ fontSize: "0.62rem", color: ACCENT, fontWeight: 800 }}>ADMIN</span> : null} {d.isOnShift ? <span style={{ fontSize: "0.62rem", color: "#22c55e", fontWeight: 800 }}>• EN TURNO</span> : null}</p>
                    <p style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>usuario: {d.username}{!d.active ? " · inactivo" : ""}</p>
                  </div>
                  <button onClick={() => setDriverModal(d)} title="Editar" style={{ width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", cursor: "pointer" }}><Pencil size={14} /></button>
                </div>
              ))}
            </div>
          </section>

          {/* Responsables */}
          <section>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
              <h2 style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 800, color: "var(--adm-text)", margin: 0, flex: 1, display: "inline-flex", alignItems: "center", gap: 6 }}><Users size={16} /> Responsables (para reenvíos)</h2>
              <button onClick={() => setRespModal("new")} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 13px", borderRadius: 9, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text)", fontFamily: F, fontSize: "0.8rem", fontWeight: 700, cursor: "pointer" }}><Plus size={15} /> Nuevo</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {resps.map((r) => (
                <button key={r.id} onClick={() => setRespModal(r)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, border: "1px solid var(--adm-card-border)", background: r.active ? "var(--adm-hover)" : "transparent", color: "var(--adm-text)", cursor: "pointer", fontFamily: FB, fontSize: "0.8rem", opacity: r.active ? 1 : 0.5 }}>
                  {r.name}{r.roleLabel ? <span style={{ color: "var(--adm-text3)" }}> · {r.roleLabel}</span> : null} <Pencil size={12} color="var(--adm-text3)" />
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {driverModal && restaurantId && <DriverModal restaurantId={restaurantId} driver={driverModal === "new" ? null : driverModal} onClose={() => setDriverModal(null)} onSaved={() => { setDriverModal(null); load(); }} />}
      {respModal && restaurantId && <RespModal restaurantId={restaurantId} resp={respModal === "new" ? null : respModal} onClose={() => setRespModal(null)} onSaved={() => { setRespModal(null); load(); }} />}
    </div>
  );
}

function DriverModal({ restaurantId, driver, onClose, onSaved }: { restaurantId: string; driver: Driver | null; onClose: () => void; onSaved: () => void }) {
  const editing = !!driver;
  const [username, setUsername] = useState(driver?.username ?? "");
  const [displayName, setDisplayName] = useState(driver?.displayName ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(driver?.role ?? "driver");
  const [active, setActive] = useState(driver?.active ?? true);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/panel/ecommerce/drivers", {
        method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { restaurantId, id: driver!.id, displayName, role, active, ...(password ? { password } : {}) } : { restaurantId, username, displayName, password, role }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error || "No se pudo guardar"); setSaving(false); return; }
      toast.success("Guardado"); onSaved();
    } catch { toast.error("Error de conexión"); setSaving(false); }
  }

  return (
    <Overlay onClose={onClose} title={editing ? "Editar repartidor" : "Nuevo repartidor"}>
      {!editing && <div><span style={label}>Usuario (login)</span><input value={username} onChange={(e) => setUsername(e.target.value)} style={inp} autoFocus /></div>}
      <div><span style={label}>Nombre</span><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inp} /></div>
      <div><span style={label}>{editing ? "Nueva clave (dejar vacío para no cambiar)" : "Clave"}</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inp} /></div>
      <div><span style={label}>Rol</span>
        <select value={role} onChange={(e) => setRole(e.target.value)} style={inp}><option value="driver">Repartidor</option><option value="admin">Admin</option></select>
      </div>
      {editing && <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: FB, fontSize: "0.84rem", color: "var(--adm-text)" }}><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Activo</label>}
      <button onClick={save} disabled={saving} style={{ padding: "11px", borderRadius: 10, border: "none", background: ACCENT, color: "#1a1a1a", fontFamily: F, fontWeight: 800, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "Guardando…" : "Guardar"}</button>
    </Overlay>
  );
}

function RespModal({ restaurantId, resp, onClose, onSaved }: { restaurantId: string; resp: Responsible | null; onClose: () => void; onSaved: () => void }) {
  const editing = !!resp;
  const [name, setName] = useState(resp?.name ?? "");
  const [roleLabel, setRoleLabel] = useState(resp?.roleLabel ?? "");
  const [active, setActive] = useState(resp?.active ?? true);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/panel/ecommerce/responsibles", {
        method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { restaurantId, id: resp!.id, name, roleLabel, active } : { restaurantId, name, roleLabel }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error || "No se pudo guardar"); setSaving(false); return; }
      toast.success("Guardado"); onSaved();
    } catch { toast.error("Error de conexión"); setSaving(false); }
  }

  return (
    <Overlay onClose={onClose} title={editing ? "Editar responsable" : "Nuevo responsable"}>
      <div><span style={label}>Nombre</span><input value={name} onChange={(e) => setName(e.target.value)} style={inp} autoFocus /></div>
      <div><span style={label}>Rol (opcional)</span><input value={roleLabel} onChange={(e) => setRoleLabel(e.target.value)} placeholder="Cocina, Encargado…" style={inp} /></div>
      {editing && <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: FB, fontSize: "0.84rem", color: "var(--adm-text)" }}><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Activo</label>}
      <button onClick={save} disabled={saving} style={{ padding: "11px", borderRadius: 10, border: "none", background: ACCENT, color: "#1a1a1a", fontFamily: F, fontWeight: 800, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "Guardando…" : "Guardar"}</button>
    </Overlay>
  );
}

function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, background: "var(--adm-bg, var(--adm-card))", borderRadius: 16, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontFamily: F, fontSize: "1rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--adm-text3)" }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
