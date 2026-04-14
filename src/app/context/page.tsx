"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GenieContext() {
  const router = useRouter();
  const [hunger, setHunger] = useState("");

  const select = (v: string) => {
    setHunger(v);
    setTimeout(() => {
      sessionStorage.setItem("genieContext", JSON.stringify({ ctxHunger: v }));
      router.push("/result");
    }, 200);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <p style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>🧞</p>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.3rem,3.5vw,1.6rem)", color: "#FFD600", textAlign: "center", marginBottom: 24 }}>Cuanta hambre tienes?</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { v: "LIGHT", emoji: "🥗", l: "Poca", sub: "algo liviano" },
            { v: "MEDIUM", emoji: "🍽️", l: "Normal", sub: "un plato esta bien" },
            { v: "HEAVY", emoji: "🍔", l: "Mucha", sub: "entrada + plato o mas" },
          ].map(o => {
            const active = hunger === o.v;
            return (
              <button key={o.v} onClick={() => select(o.v)} style={{ padding: "18px 20px", background: active ? "rgba(255,214,0,0.12)" : "#F5F5F5", border: active ? "1px solid #FFD600" : "1px solid #E0E0E0", borderRadius: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 14, textAlign: "left" }}>
                <span style={{ fontSize: 28 }}>{o.emoji}</span>
                <div>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "0.95rem", color: active ? "#FFD600" : "#FFFFFF", display: "block" }}>{o.l}</span>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "#666666" }}>{o.sub}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
