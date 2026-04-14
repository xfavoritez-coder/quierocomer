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
      router.push("/genie/result");
    }, 200);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0812", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <p style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>🧞</p>
        <h2 style={{ fontFamily: "var(--font-cinzel-decorative)", fontSize: "clamp(1.3rem,3.5vw,1.6rem)", color: "#f5d080", textAlign: "center", marginBottom: 24 }}>Cuanta hambre tienes?</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { v: "LIGHT", emoji: "🥗", l: "Poca", sub: "algo liviano" },
            { v: "MEDIUM", emoji: "🍽️", l: "Normal", sub: "un plato esta bien" },
            { v: "HEAVY", emoji: "🍔", l: "Mucha", sub: "entrada + plato o mas" },
          ].map(o => {
            const active = hunger === o.v;
            return (
              <button key={o.v} onClick={() => select(o.v)} style={{ padding: "18px 20px", background: active ? "rgba(232,168,76,0.12)" : "rgba(255,255,255,0.03)", border: active ? "1px solid #e8a84c" : "1px solid rgba(255,255,255,0.08)", borderRadius: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 14, textAlign: "left" }}>
                <span style={{ fontSize: 28 }}>{o.emoji}</span>
                <div>
                  <span style={{ fontFamily: "var(--font-cinzel)", fontSize: "0.95rem", color: active ? "#e8a84c" : "#f0ead6", display: "block" }}>{o.l}</span>
                  <span style={{ fontFamily: "var(--font-lato)", fontSize: "0.75rem", color: "rgba(240,234,214,0.35)" }}>{o.sub}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
