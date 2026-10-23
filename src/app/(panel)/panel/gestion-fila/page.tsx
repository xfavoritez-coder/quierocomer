"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { ListOrdered, Plus, Bell, Check, X, Copy, RefreshCw, QrCode } from "lucide-react";

const F = "var(--font-display)";
const FB = "var(--font-body)";

interface Entry {
  id: string; number: number; name: string; phone: string; partySize: number;
  status: "WAITING" | "NEAR" | "CALLED" | "DONE" | "CANCELLED"; source: string; note: string | null;
  createdAt: string; calledAt: string | null;
}

const STATUS: Record<Entry["status"], { label: string; color: string; bg: string }> = {
  WAITING: { label: "En espera", color: "#b45309", bg: "rgba(245,158,11,0.12)" },
  NEAR: { label: "Próximo", color: "#2563eb", bg: "rgba(37,99,235,0.12)" },
  CALLED: { label: "Llamado", color: "#16a34a", bg: "rgba(22,163,74,0.14)" },
  DONE: { label: "Atendido", color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
  CANCELLED: { label: "Cancelado", color: "#dc2626", bg: "rgba(220,38,38,0.1)" },
};

function useIsMobile(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const h = () => setM(mq.matches);
    h();
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return m;
}

export default function GestionFilaPage() {
  const isMobile = useIsMobile();
  const { selectedRestaurantId } = useAdminSession();
  const rid = selectedRestaurantId;
  const [enabled, setEnabled] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [party, setParty] = useState("1");
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!rid) return;
    try {
      const res = await fetch(`/api/panel/queue?restaurantId=${rid}`);
      if (!res.ok) return;
      const d = await res.json();
      setEnabled(!!d.enabled); setSlug(d.slug ?? null); setEntries(d.entries ?? []);
    } catch {} finally { setLoading(false); }
  }, [rid]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  // Refresco en vivo (incluye auto-registros públicos).
  useEffect(() => { const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);

  const toggleEnabled = async () => {
    if (!rid) return;
    const next = !enabled; setEnabled(next);
    await fetch("/api/panel/queue", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId: rid, enabled: next }) }).catch(() => setEnabled(!next));
  };

  const add = async () => {
    if (!rid || !name.trim() || !phone.trim()) return;
    setAdding(true); setMsg(null);
    try {
      const res = await fetch("/api/panel/queue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId: rid, name: name.trim(), phone: phone.trim(), partySize: Number(party) || 1 }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(d.error || "No se pudo agregar"); setAdding(false); return; }
      setName(""); setPhone(""); setParty("1");
      setEntries((prev) => [...prev, d.entry]);
    } catch { setMsg("Error de conexión"); }
    setAdding(false);
  };

  const setStatus = async (id: string, status: Entry["status"]) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));
    await fetch("/api/panel/queue", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) }).catch(() => load());
  };

  const active = entries.filter((e) => e.status === "WAITING" || e.status === "NEAR" || e.status === "CALLED");
  const finished = entries.filter((e) => e.status === "DONE" || e.status === "CANCELLED");
  const publicUrl = slug ? `https://quierocomer.com/fila/${slug}` : "";

  const inp: React.CSSProperties = { padding: "10px 12px", background: "var(--adm-input)", border: "1px solid var(--adm-input-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: FB, fontSize: "0.85rem", outline: "none" };
  const actBtn = (color: string): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 8, border: `1px solid ${color}44`, background: `${color}14`, color, fontFamily: F, fontSize: "0.72rem", fontWeight: 700, cursor: "pointer" });

  if (!rid) return null;

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "8px 4px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(244,166,35,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}><ListOrdered size={20} color="#F4A623" /></div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Fila virtual</h1>
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>Fila virtual de espera por número de turno.</p>
        </div>
        <button onClick={() => { setLoading(true); load(); }} title="Actualizar" style={{ width: 38, height: 38, borderRadius: 10, background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", color: "var(--adm-text3)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><RefreshCw size={16} /></button>
      </div>

      {/* Activar fila + link público */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "12px 14px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, margin: "12px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={toggleEnabled} style={{ width: 46, height: 26, borderRadius: 13, border: "none", cursor: "pointer", position: "relative", background: enabled ? "#4ade80" : "var(--adm-input-border)", transition: "background .2s" }}>
            <span style={{ position: "absolute", top: 3, left: enabled ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
          </button>
          <div>
            <p style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>Auto-registro del cliente</p>
            <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)", margin: "1px 0 0" }}>{enabled ? "Activo: los clientes pueden registrarse por el link/QR." : "Desactivado: solo el staff agrega a la fila."}</p>
          </div>
        </div>
        {enabled && slug && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => { navigator.clipboard.writeText(publicUrl); setMsg("Link copiado"); setTimeout(() => setMsg(null), 1500); }} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 12px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text2)", fontFamily: F, fontSize: "0.74rem", fontWeight: 700, cursor: "pointer" }}><Copy size={14} /> Copiar link</button>
            <a href={`/fila/${slug}/cartel`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 12px", background: "rgba(244,166,35,0.12)", border: "1px solid rgba(244,166,35,0.3)", borderRadius: 10, color: "#F4A623", fontFamily: F, fontSize: "0.74rem", fontWeight: 700, textDecoration: "none" }}><QrCode size={14} /> Imprimir cartel QR</a>
          </div>
        )}
      </div>

      {/* Agregar a la fila */}
      <div style={{ padding: "14px 16px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, marginBottom: 16 }}>
        <p style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 10px" }}>Agregar persona</p>
        {isMobile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre *" style={inp} />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono *" inputMode="tel" style={inp} />
            <div style={{ display: "flex", gap: 8 }}>
              <input value={party} onChange={(e) => setParty(e.target.value.replace(/\D/g, ""))} placeholder="Pers." title="Personas" inputMode="numeric" style={{ ...inp, width: 72, textAlign: "center", flexShrink: 0 }} />
              <button onClick={add} disabled={adding || !name.trim() || !phone.trim()} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "12px 16px", background: "#F4A623", color: "#0a0a0a", border: "none", borderRadius: 10, fontFamily: F, fontSize: "0.9rem", fontWeight: 700, cursor: adding ? "wait" : "pointer", opacity: !name.trim() || !phone.trim() ? 0.5 : 1 }}><Plus size={16} /> {adding ? "…" : "Agregar"}</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 70px auto", gap: 8, alignItems: "center" }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre *" style={inp} />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono *" style={inp} />
            <input value={party} onChange={(e) => setParty(e.target.value.replace(/\D/g, ""))} placeholder="Pers." title="Personas" style={{ ...inp, textAlign: "center" }} />
            <button onClick={add} disabled={adding || !name.trim() || !phone.trim()} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", background: "#F4A623", color: "#0a0a0a", border: "none", borderRadius: 10, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: adding ? "wait" : "pointer", opacity: !name.trim() || !phone.trim() ? 0.5 : 1 }}><Plus size={15} /> {adding ? "…" : "Agregar"}</button>
          </div>
        )}
        {msg && <p style={{ fontFamily: FB, fontSize: "0.72rem", color: msg.includes("copiado") ? "#16a34a" : "#dc2626", margin: "8px 0 0" }}>{msg}</p>}
      </div>

      {/* Fila activa */}
      <p style={{ fontFamily: F, fontSize: "0.72rem", fontWeight: 700, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: ".06em", margin: "0 2px 8px" }}>En fila ({active.length})</p>
      {loading ? (
        <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text3)", padding: 20, textAlign: "center" }}>Cargando…</p>
      ) : active.length === 0 ? (
        <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text3)", padding: 24, textAlign: "center", background: "var(--adm-card)", border: "1px dashed var(--adm-card-border)", borderRadius: 12 }}>Nadie en la fila por ahora.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {active.map((e) => {
            const st = STATUS[e.status];
            return (
              <div key={e.id} style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", gap: isMobile ? 10 : 12, padding: "12px 14px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, flexWrap: isMobile ? "wrap" : "nowrap" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(244,166,35,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontFamily: F, fontSize: "1.05rem", fontWeight: 800, color: "#F4A623" }}>{e.number}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
                    <span style={{ fontSize: "0.6rem", fontWeight: 800, padding: "2px 7px", borderRadius: 50, background: st.bg, color: st.color }}>{st.label}</span>
                    {e.source === "public" && <span style={{ fontSize: "0.58rem", fontWeight: 700, color: "var(--adm-text3)" }}>auto</span>}
                  </div>
                  <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>{e.phone}</p>
                </div>
                {/* Nº de personas — destacado para asignar la mesa correcta */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, padding: "4px 12px", borderRadius: 12, background: "rgba(37,99,235,0.1)", minWidth: 58 }}>
                  <span style={{ fontFamily: F, fontSize: "1.35rem", fontWeight: 900, color: "#2563eb", lineHeight: 1 }}>{e.partySize}</span>
                  <span style={{ fontFamily: F, fontSize: "0.58rem", fontWeight: 700, color: "#2563eb", textTransform: "uppercase", letterSpacing: ".04em", marginTop: 2 }}>{e.partySize === 1 ? "persona" : "personas"}</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end", width: isMobile ? "100%" : undefined }}>
                  {e.status !== "CALLED" && <button onClick={() => setStatus(e.id, "CALLED")} style={{ ...actBtn("#16a34a"), flex: isMobile ? 1 : undefined, justifyContent: "center", padding: isMobile ? "9px 10px" : "6px 10px" }}><Bell size={13} /> Llamar</button>}
                  <button onClick={() => setStatus(e.id, "DONE")} style={{ ...actBtn("#6b7280"), flex: isMobile ? 1 : undefined, justifyContent: "center", padding: isMobile ? "9px 10px" : "6px 10px" }}><Check size={13} /> Atendido</button>
                  <button onClick={() => setStatus(e.id, "CANCELLED")} title="Cancelar" style={{ ...actBtn("#dc2626"), justifyContent: "center", padding: isMobile ? "9px 14px" : "6px 10px" }}><X size={13} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Finalizados hoy */}
      {finished.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontFamily: F, fontSize: "0.72rem", fontWeight: 700, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: ".06em", margin: "0 2px 8px" }}>Finalizados hoy ({finished.length})</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {finished.map((e) => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", opacity: 0.6 }}>
                <span style={{ fontFamily: F, fontSize: "0.8rem", fontWeight: 700, color: "var(--adm-text3)", minWidth: 24 }}>{e.number}</span>
                <span style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
                <span style={{ fontSize: "0.6rem", fontWeight: 700, color: STATUS[e.status].color }}>{STATUS[e.status].label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
