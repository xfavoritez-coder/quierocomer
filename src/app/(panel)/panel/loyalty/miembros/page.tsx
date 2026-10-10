"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import { toast } from "sonner";
import { CreditCard, Plus, Search, RotateCcw, Trash2, Check, Circle } from "lucide-react";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  boxSizing: "border-box",
  background: "var(--adm-card)",
  border: "1px solid var(--adm-card-border)",
  borderRadius: 8,
  color: "var(--adm-text)",
  fontFamily: FB,
  fontSize: "0.88rem",
  outline: "none",
};

interface RewardTier {
  stamp: number;
  reward: string;
}

interface Member {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  stamps: number;
  redeemedTiers: number[];
  completedCards: number;
  enrolledAt: string;
  lastStampAt: string | null;
}

export default function LoyaltyMembersPage() {
  const { restaurants, selectedRestaurantId, loading } = usePanelSession();
  const restaurantName = restaurants.find((r) => r.id === selectedRestaurantId)?.name || "";

  const [members, setMembers] = useState<Member[]>([]);
  const [stampGoal, setStampGoal] = useState(8);
  const [stampIcon, setStampIcon] = useState("★");
  const [rewards, setRewards] = useState<RewardTier[]>([]);
  const [query, setQuery] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!selectedRestaurantId) return;
    fetch(`/api/loyalty/program?restaurantId=${selectedRestaurantId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.program) {
          setStampGoal(d.program.stampGoal);
          setStampIcon(d.program.stampIcon || "★");
          setRewards(
            Array.isArray(d.program.rewards)
              ? [...d.program.rewards].sort((a: RewardTier, b: RewardTier) => a.stamp - b.stamp)
              : [],
          );
        }
      })
      .catch(() => {});
  }, [selectedRestaurantId]);

  const loadMembers = useCallback(
    (q: string) => {
      if (!selectedRestaurantId) return;
      setLoadingList(true);
      fetch(`/api/loyalty/members?restaurantId=${selectedRestaurantId}&q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setMembers(d.members || []))
        .catch(() => toast.error("Error al cargar miembros"))
        .finally(() => setLoadingList(false));
    },
    [selectedRestaurantId],
  );

  useEffect(() => {
    if (!selectedRestaurantId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadMembers(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selectedRestaurantId, loadMembers]);

  const patchMember = (m: Member) => setMembers((prev) => prev.map((x) => (x.id === m.id ? m : x)));

  const post = async (member: Member, path: string, body?: unknown, successMsg?: string) => {
    setBusyId(member.id);
    try {
      const res = await fetch(`/api/loyalty/members/${member.id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error");
      patchMember(d.member);
      if (d.earnedTiers?.length) {
        toast.success(`🎉 ¡${member.name || "El cliente"} ganó: ${d.earnedTiers.map((t: RewardTier) => t.reward).join(", ")}!`);
      } else if (successMsg) {
        toast.success(successMsg);
      }
    } catch (e: any) {
      toast.error(e.message || "Error");
    } finally {
      setBusyId(null);
    }
  };

  // Revocar (eliminar) el pase del cliente
  const removeMember = async (member: Member) => {
    if (!window.confirm(`¿Revocar el pase de ${member.name || "este cliente"}? Su tarjeta quedará anulada y saldrá de la lista.`)) return;
    setBusyId(member.id);
    try {
      const res = await fetch(`/api/loyalty/members/${member.id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error");
      setMembers((prev) => prev.filter((x) => x.id !== member.id));
      toast.success("Pase revocado");
    } catch (e: any) {
      toast.error(e.message || "Error al revocar");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: F, fontSize: "1.35rem", fontWeight: 800, color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
          <CreditCard size={22} color="var(--adm-text3)" /> Fidelidad
        </h1>
        <p style={{ fontFamily: FB, fontSize: "0.9rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
          Gestiona tus miembros y sus sellos.{!loadingList && <span style={{ marginLeft: 8, fontFamily: F, fontWeight: 700, color: "var(--adm-text3)", fontSize: "0.84rem" }}>{members.length} {members.length === 1 ? "miembro" : "miembros"}</span>}
        </p>
      </div>


      {/* Buscador + agregar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 320px", minWidth: 200, maxWidth: 520 }}>
          <Search size={16} color="var(--adm-text3)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, email o teléfono…" style={{ ...inputStyle, paddingLeft: 36, height: 44 }} />
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((s) => !s)}
          style={{ display: "flex", alignItems: "center", gap: 6, height: 44, padding: "0 18px", borderRadius: 10, border: `1.5px solid ${GOLD}`, background: "rgba(244,166,35,0.12)", color: GOLD, fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
        >
          <Plus size={16} /> Agregar miembro
        </button>
      </div>

      {showAdd && selectedRestaurantId && (
        <AddMemberForm
          restaurantId={selectedRestaurantId}
          onCreated={(m) => {
            setMembers((prev) => [m, ...prev]);
            setShowAdd(false);
            toast.success("Miembro agregado");
          }}
        />
      )}

      {/* Lista */}
      {loading || loadingList ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)", fontSize: "0.85rem" }}>Cargando miembros…</p>
      ) : members.length === 0 ? (
        <div style={{ textAlign: "center", padding: "56px 20px" }}>
          <CreditCard size={38} color="var(--adm-card-border)" style={{ marginBottom: 12 }} />
          <p style={{ fontFamily: F, fontSize: "0.9rem", color: "var(--adm-text3)", margin: 0 }}>
            {query ? "Sin resultados para tu búsqueda." : "Aún no tienes miembros. Agrega el primero."}
          </p>
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 14, alignItems: "stretch" }}>
          {members.map((m) => {
            const pct = stampGoal > 0 ? Math.min(100, (m.stamps / stampGoal) * 100) : 0;
            const cardFull = m.stamps >= stampGoal;
            const busy = busyId === m.id;
            return (
              <li key={m.id} style={{ padding: 18, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                {/* Info del cliente */}
                <div>
                  <p style={{ fontFamily: F, fontSize: "1.02rem", fontWeight: 700, color: "var(--adm-text)", margin: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{m.name || "Sin nombre"}</span>
                    {m.completedCards > 0 && (
                      <span style={{ fontFamily: F, fontSize: "0.66rem", fontWeight: 800, padding: "2px 7px", borderRadius: 999, background: "rgba(244,166,35,0.14)", color: GOLD }}>
                        {m.completedCards} completada{m.completedCards > 1 ? "s" : ""}
                      </span>
                    )}
                  </p>
                  <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {[m.email, m.phone].filter(Boolean).join(" · ") || "Sin contacto"}
                  </p>
                  {m.birthDate && (
                    <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", margin: "3px 0 0" }}>
                      🎂 {new Date(m.birthDate).toLocaleDateString("es-CL", { day: "numeric", month: "long", timeZone: "UTC" })}
                    </p>
                  )}
                </div>

                {/* Progreso */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ height: 8, flex: 1, borderRadius: 999, overflow: "hidden", background: "var(--adm-hover)" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: cardFull ? "#16a34a" : GOLD, borderRadius: 999, transition: "width 0.2s" }} />
                  </div>
                  <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: cardFull ? "#16a34a" : "var(--adm-text2)", flexShrink: 0 }}>
                    {m.stamps}/{stampGoal} {stampIcon === "logo" ? "•" : stampIcon}
                  </span>
                </div>

                {/* Metadatos */}
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <p style={{ fontFamily: FB, fontSize: "0.77rem", color: "var(--adm-text3)", margin: 0 }}>
                    Miembro desde: {new Date(m.enrolledAt).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  <p style={{ fontFamily: FB, fontSize: "0.77rem", color: "var(--adm-text3)", margin: 0 }}>
                    {m.lastStampAt
                      ? `Última compra: ${new Date(m.lastStampAt).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                      : "Sin compras aún"}
                  </p>
                </div>

                {/* Checklist de recompensas ganadas (informativo) */}
                {rewards.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, paddingTop: 10, borderTop: "1px solid var(--adm-card-border)" }}>
                    {rewards.map((t) => {
                      const won = m.stamps >= t.stamp;
                      return (
                        <div key={t.stamp} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {won ? <Check size={15} color="#16a34a" /> : <Circle size={14} color="var(--adm-card-border)" />}
                          <span style={{ fontFamily: FB, fontSize: "0.8rem", color: won ? "var(--adm-text2)" : "var(--adm-text3)" }}>
                            <span style={{ fontWeight: 700 }}>{t.stamp} {stampIcon === "logo" ? "•" : stampIcon}</span> · {t.reward}
                            {won && <span style={{ color: "#16a34a", fontWeight: 700 }}> ✓ ganada</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Empuja las acciones al fondo (tarjetas de igual alto en el grid) */}
                <div style={{ flex: 1 }} />

                {/* Acciones */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button type="button" disabled={busy} onClick={() => post(m, "stamp", { delta: -1 })} title="Quitar sello" style={{ height: 42, width: 42, borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "var(--adm-card)", color: "var(--adm-text2)", fontSize: "1.25rem", cursor: "pointer", opacity: busy ? 0.4 : 1, flexShrink: 0 }}>−</button>
                  {cardFull ? (
                    <button type="button" disabled={busy} onClick={() => post(m, "reset", undefined, "Tarjeta reiniciada")} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, height: 42, borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "var(--adm-hover)", color: "var(--adm-text2)", fontFamily: F, fontSize: "0.88rem", fontWeight: 700, cursor: "pointer", opacity: busy ? 0.4 : 1 }}>
                      <RotateCcw size={15} /> Reiniciar tarjeta
                    </button>
                  ) : (
                    <button type="button" disabled={busy} onClick={() => post(m, "stamp", { delta: 1 })} style={{ flex: 1, height: 42, borderRadius: 10, border: "none", background: "var(--adm-text)", color: "var(--adm-bg)", fontFamily: F, fontSize: "0.9rem", fontWeight: 800, cursor: "pointer", opacity: busy ? 0.4 : 1 }}>
                      + 1 sello
                    </button>
                  )}
                  <button type="button" disabled={busy} onClick={() => removeMember(m)} title="Revocar pase" style={{ height: 42, width: 42, borderRadius: 10, border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.06)", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: busy ? 0.4 : 1, flexShrink: 0 }}>
                    <Trash2 size={16} />
                  </button>
                </div>

              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AddMemberForm({ restaurantId, onCreated }: { restaurantId: string; onCreated: (m: Member) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/loyalty/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, name, email, phone, birthDate: birthDate || undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error");
      onCreated(d.member);
    } catch (e: any) {
      toast.error(e.message || "Error al agregar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginBottom: 18, padding: 14, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12 }}>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" style={inputStyle} />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={inputStyle} />
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono" style={inputStyle} />
        <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} title="Fecha de cumpleaños" style={{ ...inputStyle, colorScheme: "dark" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <button type="button" onClick={submit} disabled={saving} style={{ padding: "9px 16px", borderRadius: 8, border: `1.5px solid ${GOLD}`, background: GOLD, color: "#1a1a1a", fontFamily: F, fontSize: "0.8rem", fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Guardando…" : "Guardar miembro"}
        </button>
      </div>
    </div>
  );
}
