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
      router.push(`/grupo/${group.code}`);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <p style={{ fontSize: 40, textAlign: "center", marginBottom: 8 }}>🧞</p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.3rem,4vw,1.7rem)", color: "#0D0D0D", textAlign: "center", marginBottom: 8 }}>Con quien estas?</h1>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "#666666", textAlign: "center", marginBottom: 28 }}>Cada uno elige lo que le tinca y el Genio encuentra donde ir juntos</p>

        {step === "type" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Name input */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontFamily: "var(--font-display)", fontSize: "0.72rem", color: "#666666", display: "block", marginBottom: 6 }}>Tu nombre</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Como te llamas?" style={{ width: "100%", padding: "12px 16px", background: "rgba(0,0,0,0.3)", border: "1px solid #E0E0E0", borderRadius: 12, color: "#0D0D0D", fontFamily: "var(--font-body)", fontSize: "0.9rem", outline: "none", boxSizing: "border-box" }} />
            </div>

            {GROUP_TYPES.map(t => (
              <button key={t.v} onClick={() => {
                setGroupType(t.v);
                if (t.members > 0) { create(t.v, t.members); }
                else setStep("count");
              }} style={{ padding: "18px 20px", background: "#F5F5F5", border: "1px solid #E0E0E0", borderRadius: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 14, textAlign: "left" }}>
                <span style={{ fontSize: 28 }}>{t.emoji}</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "0.95rem", color: "#0D0D0D" }}>{t.l}</span>
              </button>
            ))}

            <button onClick={() => router.push("/")} style={{ marginTop: 8, padding: 12, background: "transparent", border: "none", fontFamily: "var(--font-display)", fontSize: "0.82rem", color: "#666666", cursor: "pointer" }}>
              Voy solo →
            </button>
          </div>
        )}

        {step === "count" && (
          <div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1rem", color: "#0D0D0D", textAlign: "center", marginBottom: 20 }}>Cuantos son?</h2>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 24 }}>
              {[2, 3, 4, 5, 6].map(n => (
                <button key={n} onClick={() => setCount(n)} style={{ width: 52, height: 52, borderRadius: 14, background: count === n ? "rgba(255,214,0,0.15)" : "#F5F5F5", border: count === n ? "1px solid #FFD600" : "1px solid #E0E0E0", fontFamily: "var(--font-display)", fontSize: "1.1rem", color: count === n ? "#FFD600" : "#FFFFFF", cursor: "pointer" }}>{n}</button>
              ))}
            </div>
            <button onClick={() => create(groupType, count)} style={{ width: "100%", padding: 16, background: "#0D0D0D", color: "#FFD600", border: "none", borderRadius: 99, fontFamily: "var(--font-display)", fontSize: "0.92rem", fontWeight: 700, cursor: "pointer" }}>
              Crear sala
            </button>
            <button onClick={() => setStep("type")} style={{ width: "100%", marginTop: 8, padding: 12, background: "transparent", border: "none", fontFamily: "var(--font-display)", fontSize: "0.82rem", color: "#666666", cursor: "pointer" }}>← Atras</button>
          </div>
        )}

        {step === "creating" && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <p style={{ fontFamily: "var(--font-display)", color: "#666666" }}>Creando sala...</p>
          </div>
        )}
      </div>
    </div>
  );
}
