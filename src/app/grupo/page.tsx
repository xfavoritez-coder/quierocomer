"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const GROUP_TYPES = [
  { v: "PAREJA", emoji: "💑", l: "En pareja", members: 2 },
  { v: "AMIGOS", emoji: "👯", l: "Con amigos", members: 0 },
  { v: "FAMILIA", emoji: "👨‍👩‍👧‍👦", l: "Con familia", members: 0 },
];

function getSessionId(): string {
  return localStorage.getItem("genie_session_id") ?? "";
}

export default function CrearGrupo() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState<"choose" | "type" | "count" | "join" | "creating">("choose");
  const [groupType, setGroupType] = useState("");
  const [count, setCount] = useState(3);
  const [joinCode, setJoinCode] = useState("");
  const [nombre, setNombre] = useState(user?.nombre?.split(" ")[0] ?? "");

  const create = async (type: string, total: number) => {
    setStep("creating");
    const sid = getSessionId();
    const res = await fetch("/api/genie/group", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupType: type, totalMembers: total, userId: user?.id || null, sessionId: sid, nombre: nombre || "Anfitrión" }),
    });
    if (res.ok) {
      const group = await res.json();
      router.push(`/grupo/${group.code}`);
    }
  };

  return (
    <div style={{ padding: "clamp(20px,4vw,40px) clamp(16px,3vw,24px)" }}>
      <div style={{ maxWidth: 420, margin: "0 auto", paddingTop: 40 }}>
        <p style={{ fontSize: 40, textAlign: "center", marginBottom: 8 }}>🧞</p>

        {/* Step 0: Create or Join */}
        {step === "choose" && (
          <div>
            <h1 className="font-display" style={{ fontSize: "clamp(1.3rem,4vw,1.7rem)", color: "#0D0D0D", textAlign: "center", marginBottom: 24 }}>Grupo</h1>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={() => setStep("type")} style={{ padding: "18px 20px", background: "#F5F5F5", border: "1px solid #E0E0E0", borderRadius: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 24 }}>➕</span>
                <div style={{ textAlign: "left" }}>
                  <span className="font-display" style={{ fontSize: "0.95rem", color: "#0D0D0D", display: "block" }}>Crear una sala</span>
                  <span className="font-body" style={{ fontSize: "0.75rem", color: "#999" }}>Invita a tu grupo a elegir juntos</span>
                </div>
              </button>
              <button onClick={() => setStep("join")} style={{ padding: "18px 20px", background: "#F5F5F5", border: "1px solid #E0E0E0", borderRadius: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 24 }}>🔑</span>
                <div style={{ textAlign: "left" }}>
                  <span className="font-display" style={{ fontSize: "0.95rem", color: "#0D0D0D", display: "block" }}>Tengo un código</span>
                  <span className="font-body" style={{ fontSize: "0.75rem", color: "#999" }}>Alguien me invitó a una sala</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Join with code */}
        {step === "join" && (
          <div>
            <h2 className="font-display" style={{ fontSize: "1.1rem", color: "#0D0D0D", textAlign: "center", marginBottom: 16 }}>Ingresa el código</h2>
            <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="Ej: AB3K" maxLength={4} style={{ width: "100%", padding: "16px", background: "#F5F5F5", border: "1px solid #E0E0E0", borderRadius: 12, color: "#0D0D0D", fontSize: "1.5rem", fontWeight: 700, textAlign: "center", letterSpacing: "0.3em", outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
            <button onClick={() => { if (joinCode.length >= 3) router.push(`/grupo/${joinCode}`); }} disabled={joinCode.length < 3} style={{ width: "100%", padding: 14, background: joinCode.length >= 3 ? "#FFD600" : "#E0E0E0", color: "#0D0D0D", border: "none", borderRadius: 99, fontWeight: 700, fontSize: "0.9rem", cursor: joinCode.length >= 3 ? "pointer" : "default" }}>
              Unirme
            </button>
            <button onClick={() => setStep("choose")} style={{ width: "100%", marginTop: 8, padding: 12, background: "#0D0D0D", color: "#FFFFFF", border: "none", borderRadius: 99, fontSize: "0.82rem", fontWeight: 500, cursor: "pointer" }}>← Atrás</button>
          </div>
        )}

        {/* Create: choose type + name */}
        {step === "type" && (
          <div>
            <h2 className="font-display" style={{ fontSize: "1.1rem", color: "#0D0D0D", textAlign: "center", marginBottom: 12 }}>Con quién estás?</h2>
            <div style={{ marginBottom: 16 }}>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre" style={{ width: "100%", padding: "12px 16px", background: "#F5F5F5", border: "1px solid #E0E0E0", borderRadius: 12, color: "#0D0D0D", fontSize: "0.9rem", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {GROUP_TYPES.map(t => (
                <button key={t.v} onClick={() => {
                  setGroupType(t.v);
                  if (t.members > 0) create(t.v, t.members);
                  else setStep("count");
                }} style={{ padding: "16px 18px", background: "#F5F5F5", border: "1px solid #E0E0E0", borderRadius: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 24 }}>{t.emoji}</span>
                  <span className="font-display" style={{ fontSize: "0.92rem", color: "#0D0D0D" }}>{t.l}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setStep("choose")} style={{ width: "100%", marginTop: 8, padding: 12, background: "#0D0D0D", color: "#FFFFFF", border: "none", borderRadius: 99, fontSize: "0.82rem", fontWeight: 500, cursor: "pointer" }}>← Atrás</button>
          </div>
        )}

        {/* Create: choose count */}
        {step === "count" && (
          <div>
            <h2 className="font-display" style={{ fontSize: "1rem", color: "#0D0D0D", textAlign: "center", marginBottom: 20 }}>Cuántos son en total?</h2>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 24 }}>
              {[2, 3, 4, 5, 6].map(n => (
                <button key={n} onClick={() => setCount(n)} style={{ width: 52, height: 52, borderRadius: 14, background: count === n ? "#0D0D0D" : "#F5F5F5", border: count === n ? "none" : "1px solid #E0E0E0", fontSize: "1.1rem", color: count === n ? "#FFD600" : "#0D0D0D", cursor: "pointer", fontWeight: 700 }}>{n}</button>
              ))}
            </div>
            <button onClick={() => create(groupType, count)} style={{ width: "100%", padding: 16, background: "#FFD600", color: "#0D0D0D", border: "none", borderRadius: 99, fontWeight: 700, fontSize: "0.92rem", cursor: "pointer" }}>
              Crear sala
            </button>
            <button onClick={() => setStep("type")} style={{ width: "100%", marginTop: 8, padding: 12, background: "#0D0D0D", color: "#FFFFFF", border: "none", borderRadius: 99, fontSize: "0.82rem", fontWeight: 500, cursor: "pointer" }}>← Atrás</button>
          </div>
        )}

        {step === "creating" && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <p style={{ color: "#666" }}>Creando sala...</p>
          </div>
        )}
      </div>
    </div>
  );
}
