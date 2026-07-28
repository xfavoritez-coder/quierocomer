"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import { toast } from "sonner";
import { CreditCard, Plus, Search, Gift } from "lucide-react";
import LoyaltyNav from "../LoyaltyNav";

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

interface Member {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  stamps: number;
  rewardsEarned: number;
  rewardsRedeemed: number;
  enrolledAt: string;
  lastStampAt: string | null;
}

export default function LoyaltyMembersPage() {
  const { selectedRestaurantId, loading } = usePanelSession();

  const [members, setMembers] = useState<Member[]>([]);
  const [stampsRequired, setStampsRequired] = useState(10);
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
        if (d.program) setStampsRequired(d.program.stampsRequired);
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

  const addStamp = async (member: Member, delta: 1 | -1) => {
    setBusyId(member.id);
    try {
      const res = await fetch(`/api/loyalty/members/${member.id}/stamp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error");
      patchMember(d.member);
      if (d.rewardCompleted) toast.success(`🎉 ¡${member.name || "El cliente"} completó la tarjeta!`);
    } catch (e: any) {
      toast.error(e.message || "Error");
    } finally {
      setBusyId(null);
    }
  };

  const redeem = async (member: Member) => {
    setBusyId(member.id);
    try {
      const res = await fetch(`/api/loyalty/members/${member.id}/redeem`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error");
      patchMember(d.member);
      toast.success(`✓ Recompensa canjeada para ${member.name || "el cliente"}`);
    } catch (e: any) {
      toast.error(e.message || "Error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            fontFamily: F,
            fontSize: "1.2rem",
            fontWeight: 700,
            color: "var(--adm-text)",
            margin: "0 0 4px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <CreditCard size={20} color="var(--adm-text3)" /> Fidelidad
        </h1>
        <p style={{ fontFamily: FB, fontSize: "0.88rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
          Gestiona tus miembros y sus sellos.
        </p>
      </div>

      <LoyaltyNav />

      {/* Buscador + agregar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search
            size={16}
            color="var(--adm-text3)"
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, email o teléfono…"
            style={{ ...inputStyle, paddingLeft: 36 }}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((s) => !s)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 16px",
            borderRadius: 8,
            border: `1.5px solid ${GOLD}`,
            background: "rgba(244,166,35,0.12)",
            color: GOLD,
            fontFamily: F,
            fontSize: "0.8rem",
            fontWeight: 700,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <Plus size={15} /> Agregar miembro
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
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {members.map((m) => {
            const available = m.rewardsEarned - m.rewardsRedeemed;
            const pct = stampsRequired > 0 ? Math.min(100, (m.stamps / stampsRequired) * 100) : 0;
            return (
              <li
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  padding: 14,
                  background: "var(--adm-card)",
                  border: "1px solid var(--adm-card-border)",
                  borderRadius: 12,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p
                    style={{
                      fontFamily: F,
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      color: "var(--adm-text)",
                      margin: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.name || "Sin nombre"}
                  </p>
                  <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)", margin: "1px 0 0" }}>
                    {[m.email, m.phone].filter(Boolean).join(" · ") || "Sin contacto"}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <div style={{ height: 6, width: 96, borderRadius: 999, overflow: "hidden", background: "var(--adm-hover)" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: GOLD, borderRadius: 999, transition: "width 0.2s" }} />
                    </div>
                    <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)" }}>
                      {m.stamps}/{stampsRequired}
                    </span>
                    {available > 0 && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          fontFamily: F,
                          fontSize: "0.66rem",
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: 999,
                          background: "rgba(22,163,74,0.12)",
                          color: "#16a34a",
                        }}
                      >
                        <Gift size={11} /> {available} lista{available > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <button
                    type="button"
                    disabled={busyId === m.id}
                    onClick={() => addStamp(m, -1)}
                    title="Quitar sello"
                    style={{
                      height: 34,
                      width: 34,
                      borderRadius: 8,
                      border: "1px solid var(--adm-card-border)",
                      background: "var(--adm-card)",
                      color: "var(--adm-text2)",
                      fontSize: "1.1rem",
                      cursor: "pointer",
                      opacity: busyId === m.id ? 0.4 : 1,
                    }}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    disabled={busyId === m.id}
                    onClick={() => addStamp(m, 1)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "none",
                      background: "var(--adm-text)",
                      color: "var(--adm-bg, #fff)",
                      fontFamily: F,
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      opacity: busyId === m.id ? 0.4 : 1,
                    }}
                  >
                    +1 sello
                  </button>
                  {available > 0 && (
                    <button
                      type="button"
                      disabled={busyId === m.id}
                      onClick={() => redeem(m)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "none",
                        background: "#16a34a",
                        color: "#fff",
                        fontFamily: F,
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        opacity: busyId === m.id ? 0.4 : 1,
                      }}
                    >
                      Canjear
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AddMemberForm({
  restaurantId,
  onCreated,
}: {
  restaurantId: string;
  onCreated: (m: Member) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/loyalty/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, name, email, phone }),
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
    <div
      style={{
        marginBottom: 18,
        padding: 14,
        background: "var(--adm-card)",
        border: "1px solid var(--adm-card-border)",
        borderRadius: 12,
      }}
    >
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" style={inputStyle} />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={inputStyle} />
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono" style={inputStyle} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          style={{
            padding: "9px 16px",
            borderRadius: 8,
            border: `1.5px solid ${GOLD}`,
            background: GOLD,
            color: "#1a1a1a",
            fontFamily: F,
            fontSize: "0.8rem",
            fontWeight: 700,
            cursor: saving ? "default" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Guardando…" : "Guardar miembro"}
        </button>
      </div>
    </div>
  );
}
