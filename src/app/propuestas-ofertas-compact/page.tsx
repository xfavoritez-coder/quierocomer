"use client";

import Image from "next/image";

const PROMOS = [
  { id: "1", name: "Tiger Roll Night", desc: "8 piezas de Tiger Roll, salmón furai, queso crema y salsa especial", price: 23900, originalPrice: 25900, photo: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?q=90&w=900&auto=format&fit=crop", day: "HOY VIERNES" },
  { id: "2", name: "Box Familiar", desc: "3 burgers con papas cheddar y bebida 1.5L", price: 12990, originalPrice: 15990, photo: "https://images.unsplash.com/photo-1550547660-d9450f859349?q=90&w=900&auto=format&fit=crop", day: "OFERTA" },
];

export default function PropuestasOfertasCompact() {
  return (
    <div style={{ background: "#070707", minHeight: "100vh", color: "#f0f0f0", fontFamily: "system-ui, sans-serif", padding: "40px 16px" }}>
      <div style={{ maxWidth: 430, margin: "0 auto" }}>

        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#888", marginBottom: 20 }}>Versión A — Horizontal compacta (para Lista)</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 40 }}>
          {PROMOS.map(p => (
            <div key={p.id + "a"} style={{
              height: 110, borderRadius: 18, overflow: "hidden", position: "relative",
              background: "#111", display: "flex",
            }}>
              <div style={{ position: "absolute", inset: 0 }}>
                <Image src={p.photo} alt={p.name} fill className="object-cover" sizes="430px" style={{ objectPosition: "center" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, #111 45%, rgba(17,17,17,0.4) 65%, transparent 100%)" }} />
              </div>
              <span style={{ position: "absolute", top: 8, right: 8, fontSize: 9, fontWeight: 900, color: "white", background: "#F4A623", padding: "3px 8px", borderRadius: 50, letterSpacing: "0.1em", zIndex: 2 }}>{p.day}</span>
              <div style={{ position: "relative", zIndex: 1, padding: "12px 14px", width: "55%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 800, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</h3>
                <p style={{ margin: "0 0 8px", fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.desc}</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: "#F4A623" }}>${p.price.toLocaleString("es-CL")}</span>
                  <del style={{ fontSize: 11, color: "#666" }}>${p.originalPrice.toLocaleString("es-CL")}</del>
                </div>
              </div>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#888", marginBottom: 20 }}>Versión B — Mini card con foto circular (para Lista)</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 40 }}>
          {PROMOS.map(p => (
            <div key={p.id + "b"} style={{
              borderRadius: 16, overflow: "hidden",
              background: "linear-gradient(135deg, rgba(244,166,35,0.06), rgba(244,166,35,0.02))",
              border: "1px solid rgba(244,166,35,0.15)",
              display: "flex", alignItems: "center", gap: 12, padding: "10px 14px 10px 10px",
            }}>
              <div style={{ position: "relative", width: 70, height: 70, borderRadius: 14, overflow: "hidden", flexShrink: 0 }}>
                <Image src={p.photo} alt={p.name} fill className="object-cover" sizes="70px" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</h3>
                  <span style={{ fontSize: 8, fontWeight: 900, color: "#F4A623", background: "rgba(244,166,35,0.12)", padding: "2px 6px", borderRadius: 50, letterSpacing: "0.1em", flexShrink: 0 }}>{p.day}</span>
                </div>
                <p style={{ margin: "0 0 4px", fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.desc}</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#F4A623" }}>${p.price.toLocaleString("es-CL")}</span>
                  <del style={{ fontSize: 11, color: "#555" }}>${p.originalPrice.toLocaleString("es-CL")}</del>
                </div>
              </div>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#888", marginBottom: 20 }}>Versión C — Banner slim con foto fondo (para Galería)</h2>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 10, scrollbarWidth: "none" }}>
          {PROMOS.map(p => (
            <div key={p.id + "c"} style={{
              flex: "0 0 280px", minWidth: 280, height: 140, borderRadius: 20, overflow: "hidden", position: "relative",
              background: "#111",
            }}>
              <div style={{ position: "absolute", inset: 0 }}>
                <Image src={p.photo} alt={p.name} fill className="object-cover" sizes="280px" />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, #111 40%, rgba(17,17,17,0.3) 60%, transparent 100%)" }} />
              </div>
              <span style={{ position: "absolute", top: 10, right: 10, fontSize: 9, fontWeight: 900, color: "white", background: "#F4A623", padding: "3px 8px", borderRadius: 50, letterSpacing: "0.1em", zIndex: 2 }}>{p.day}</span>
              <div style={{ position: "absolute", left: 14, bottom: 14, right: "45%", zIndex: 1 }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: "white" }}>{p.name}</h3>
                <p style={{ margin: "0 0 6px", fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.desc}</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 17, fontWeight: 900, color: "#F4A623" }}>${p.price.toLocaleString("es-CL")}</span>
                  <del style={{ fontSize: 11, color: "#666" }}>${p.originalPrice.toLocaleString("es-CL")}</del>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
