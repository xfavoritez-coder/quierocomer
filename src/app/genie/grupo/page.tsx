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
  const [step, setStep] = useState<"type" | "count" | "creating">("type");
  const [groupType, setGroupType] = useState("");
  const [count, setCount] = useState(2);
  const [nombre, setNombre] = useState(user?.nombre?.split(" ")[0] ?? "");

  const create = async (type: string, total: number) => {
    setStep("creating");
    const sid = getSessionId();
    const res = await fetch("/api/genie/group", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupType: type, totalMembers: total, userId: user?.id || null, sessionId: sid, nombre: nombre || "Tú" }),
    });
    if (res.ok) {
      const group = await res.json();
      router.push(`/genie/grupo/${group.code}`);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0812", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <p style={{ fontSize: 40, textAlign: "center", marginBottom: 8 }}>🧞</p>
        <h1 style={{ fontFamily: "var(--font-cinzel-decorative)", fontSize: "clamp(1.3rem,4vw,1.7rem)", color: "#f5d080", textAlign: "center", marginBottom: 8 }}>Con quien estas?</h1>
        <p style={{ fontFamily: "var(--font-lato)", fontSize: "0.85rem", color: "rgba(240,234,214,0.4)", textAlign: "center", marginBottom: 28 }}>Cada uno elige lo que le tinca y el Genio encuentra donde ir juntos</p>

        {step === "type" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Name input */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontFamily: "var(--font-cinzel)", fontSize: "0.72rem", color: "rgba(240,234,214,0.4)", display: "block", marginBottom: 6 }}>Tu nombre</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Como te llamas?" style={{ width: "100%", padding: "12px 16px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(232,168,76,0.2)", borderRadius: 12, color: "#f0ead6", fontFamily: "var(--font-lato)", fontSize: "0.9rem", outline: "none", boxSizing: "border-box" }} />
            </div>

            {GROUP_TYPES.map(t => (
              <button key={t.v} onClick={() => {
                setGroupType(t.v);
                if (t.members > 0) { create(t.v, t.members); }
                else setStep("count");
              }} style={{ padding: "18px 20px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 14, textAlign: "left" }}>
                <span style={{ fontSize: 28 }}>{t.emoji}</span>
                <span style={{ fontFamily: "var(--font-cinzel)", fontSize: "0.95rem", color: "#f0ead6" }}>{t.l}</span>
              </button>
            ))}

            <button onClick={() => router.push("/genie")} style={{ marginTop: 8, padding: 12, background: "transparent", border: "none", fontFamily: "var(--font-cinzel)", fontSize: "0.82rem", color: "rgba(240,234,214,0.3)", cursor: "pointer" }}>
              Voy solo →
            </button>
          </div>
        )}

        {step === "count" && (
          <div>
            <h2 style={{ fontFamily: "var(--font-cinzel)", fontSize: "1rem", color: "#e8a84c", textAlign: "center", marginBottom: 20 }}>Cuantos son?</h2>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 24 }}>
              {[2, 3, 4, 5, 6].map(n => (
                <button key={n} onClick={() => setCount(n)} style={{ width: 52, height: 52, borderRadius: 14, background: count === n ? "rgba(232,168,76,0.15)" : "rgba(255,255,255,0.03)", border: count === n ? "1px solid #e8a84c" : "1px solid rgba(255,255,255,0.08)", fontFamily: "var(--font-cinzel)", fontSize: "1.1rem", color: count === n ? "#e8a84c" : "#f0ead6", cursor: "pointer" }}>{n}</button>
              ))}
            </div>
            <button onClick={() => create(groupType, count)} style={{ width: "100%", padding: 16, background: "#e8a84c", color: "#0a0812", border: "none", borderRadius: 14, fontFamily: "var(--font-cinzel)", fontSize: "0.92rem", fontWeight: 700, cursor: "pointer" }}>
              Crear sala
            </button>
            <button onClick={() => setStep("type")} style={{ width: "100%", marginTop: 8, padding: 12, background: "transparent", border: "none", fontFamily: "var(--font-cinzel)", fontSize: "0.82rem", color: "rgba(240,234,214,0.3)", cursor: "pointer" }}>← Atras</button>
          </div>
        )}

        {step === "creating" && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <p style={{ fontFamily: "var(--font-cinzel)", color: "rgba(240,234,214,0.4)" }}>Creando sala...</p>
          </div>
        )}
      </div>
    </div>
  );
}
