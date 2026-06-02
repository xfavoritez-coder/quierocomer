"use client";

import Image from "next/image";

const MOCK_PROMOS = [
  { id: "1", name: "Brisket Ahumado BBQ", desc: "12 horas de ahumado lento con salsa BBQ casera", price: 14990, originalPrice: 18990, discount: 21, photo: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&q=80" },
  { id: "2", name: "Poke Bowl Salmón", desc: "Salmón fresco, arroz sushi, palta, edamame y salsa ponzu", price: 11990, originalPrice: 14990, discount: 20, photo: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80" },
  { id: "3", name: "Burger Doble Smash", desc: "Doble carne smash, cheddar, pickles y salsa especial", price: 9990, originalPrice: 12990, discount: 23, photo: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80" },
];

const MOCK_DISHES = [
  { id: "d1", name: "Tacos al Pastor", desc: "Cerdo marinado, piña, cilantro", price: 8990, photo: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&q=80" },
  { id: "d2", name: "Ceviche Mixto", desc: "Pescado y camarón, leche de tigre", price: 12990, photo: "https://images.unsplash.com/photo-1535399831218-d5bd36d1a6b3?w=400&q=80" },
  { id: "d3", name: "Pad Thai", desc: "Fideos de arroz salteados con camarón", price: 11490, photo: "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=400&q=80" },
  { id: "d4", name: "Risotto Funghi", desc: "Arroz carnaroli, mix de hongos", price: 13990, photo: "https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=400&q=80" },
];

function DishCard({ d, width }: { d: typeof MOCK_DISHES[0]; width: number }) {
  return (
    <div style={{ width, minWidth: width, flexShrink: 0, borderRadius: 14, background: "#111", border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden", scrollSnapAlign: "start" }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: "1/1" }}>
        <Image src={d.photo} alt={d.name} fill className="object-cover" sizes={`${width}px`} />
      </div>
      <div style={{ padding: "10px 12px 12px" }}>
        <p style={{ fontSize: "0.95rem", fontWeight: 700, color: "#f0f0f0", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</p>
        <p style={{ fontSize: "0.78rem", color: "#888", margin: "3px 0 0", lineHeight: 1.4 }}>{d.desc}</p>
        <p style={{ fontSize: "0.95rem", fontWeight: 700, color: "#F4A623", margin: "6px 0 0" }}>${d.price.toLocaleString("es-CL")}</p>
      </div>
    </div>
  );
}

function PromoA({ p }: { p: typeof MOCK_PROMOS[0] }) {
  return (
    <div style={{ flex: "0 0 320px", minWidth: 320, scrollSnapAlign: "start", borderRadius: 16, overflow: "hidden", background: "rgba(244,166,35,0.06)", border: "1px solid rgba(244,166,35,0.2)" }}>
      <div style={{ position: "relative", width: "100%", height: 180 }}>
        <Image src={p.photo} alt={p.name} fill className="object-cover" sizes="320px" />
        <span style={{ position: "absolute", top: 8, left: 8, background: "#10b981", color: "white", fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>-{p.discount}%</span>
        <span style={{ position: "absolute", top: 8, right: 8, background: "#F4A623", color: "white", fontSize: "9px", fontWeight: 800, padding: "3px 8px", borderRadius: 50, letterSpacing: "0.1em" }}>OFERTA</span>
      </div>
      <div style={{ padding: "12px 14px 14px" }}>
        <p style={{ fontSize: "15px", fontWeight: 700, color: "#f0f0f0", margin: 0 }}>{p.name}</p>
        <p style={{ fontSize: "12px", color: "#aaa", margin: "3px 0 0", lineHeight: 1.4 }}>{p.desc}</p>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 8 }}>
          <span style={{ fontSize: "18px", fontWeight: 700, color: "#F4A623" }}>${p.price.toLocaleString("es-CL")}</span>
          <span style={{ fontSize: "13px", color: "#666", textDecoration: "line-through" }}>${p.originalPrice.toLocaleString("es-CL")}</span>
        </div>
      </div>
    </div>
  );
}

function PromoB({ p }: { p: typeof MOCK_PROMOS[0] }) {
  return (
    <div style={{ flex: "1 1 100%", borderRadius: 16, overflow: "hidden", background: "rgba(244,166,35,0.06)", border: "1px solid rgba(244,166,35,0.2)", display: "flex", alignItems: "stretch" }}>
      <div style={{ position: "relative", width: 140, minHeight: 120, flexShrink: 0 }}>
        <Image src={p.photo} alt={p.name} fill className="object-cover" sizes="140px" />
        <span style={{ position: "absolute", top: 6, left: 6, background: "#10b981", color: "white", fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: 6 }}>-{p.discount}%</span>
      </div>
      <div style={{ flex: 1, padding: "12px 14px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <span style={{ display: "inline-block", width: "fit-content", background: "#F4A623", color: "white", fontSize: "9px", fontWeight: 800, padding: "3px 8px", borderRadius: 50, letterSpacing: "0.1em", marginBottom: 6 }}>OFERTA</span>
        <p style={{ fontSize: "16px", fontWeight: 700, color: "#f0f0f0", margin: 0 }}>{p.name}</p>
        <p style={{ fontSize: "12px", color: "#aaa", margin: "3px 0 0", lineHeight: 1.4 }}>{p.desc}</p>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 8 }}>
          <span style={{ fontSize: "18px", fontWeight: 700, color: "#F4A623" }}>${p.price.toLocaleString("es-CL")}</span>
          <span style={{ fontSize: "13px", color: "#666", textDecoration: "line-through" }}>${p.originalPrice.toLocaleString("es-CL")}</span>
        </div>
      </div>
    </div>
  );
}

function PromoC({ p }: { p: typeof MOCK_PROMOS[0] }) {
  return (
    <div style={{ flex: "0 0 220px", minWidth: 220, scrollSnapAlign: "start", borderRadius: 16, overflow: "hidden", position: "relative", height: 280 }}>
      <Image src={p.photo} alt={p.name} fill className="object-cover" sizes="220px" />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 40%, transparent 65%)" }} />
      <span style={{ position: "absolute", top: 10, left: 10, background: "#F4A623", color: "white", fontSize: "9px", fontWeight: 800, padding: "3px 8px", borderRadius: 50, letterSpacing: "0.1em" }}>OFERTA</span>
      <span style={{ position: "absolute", top: 10, right: 10, background: "#10b981", color: "white", fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>-{p.discount}%</span>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "14px" }}>
        <p style={{ fontSize: "15px", fontWeight: 700, color: "white", margin: 0, textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>{p.name}</p>
        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", margin: "3px 0 0", lineHeight: 1.3 }}>{p.desc}</p>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 6 }}>
          <span style={{ fontSize: "17px", fontWeight: 700, color: "#F4A623" }}>${p.price.toLocaleString("es-CL")}</span>
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", textDecoration: "line-through" }}>${p.originalPrice.toLocaleString("es-CL")}</span>
        </div>
      </div>
    </div>
  );
}

export default function PropuestasOfertas() {
  return (
    <div style={{ background: "#070707", minHeight: "100vh", color: "#f0f0f0", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 430, margin: "0 auto", padding: "20px 0 60px" }}>

        {/* ═══ PROPUESTA A: Vertical grande + platos angostos ═══ */}
        <div style={{ padding: "0 16px", marginBottom: 10 }}>
          <h2 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 4px", color: "#F4A623" }}>Propuesta A</h2>
          <p style={{ fontSize: "13px", color: "#888", margin: "0 0 16px" }}>Ofertas verticales grandes (foto arriba, info abajo) + platos a 170px</p>
        </div>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 16px 12px", scrollSnapType: "x mandatory", scrollbarWidth: "none" as any }}>
          {MOCK_PROMOS.map(p => <PromoA key={p.id} p={p} />)}
        </div>
        <p style={{ fontSize: "12px", color: "#666", padding: "0 16px", margin: "4px 0 10px" }}>Platos</p>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 16px 20px", scrollSnapType: "x mandatory", scrollbarWidth: "none" as any }}>
          {MOCK_DISHES.map(d => <DishCard key={d.id} d={d} width={170} />)}
        </div>
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 16px 24px" }} />

        {/* ═══ PROPUESTA B: Horizontal full-width (foto más grande) + platos angostos ═══ */}
        <div style={{ padding: "0 16px", marginBottom: 10 }}>
          <h2 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 4px", color: "#F4A623" }}>Propuesta B</h2>
          <p style={{ fontSize: "13px", color: "#888", margin: "0 0 16px" }}>Ofertas horizontales full-width (foto 140px) + platos a 170px</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 16px 12px" }}>
          {MOCK_PROMOS.slice(0, 2).map(p => <PromoB key={p.id} p={p} />)}
        </div>
        <p style={{ fontSize: "12px", color: "#666", padding: "0 16px", margin: "4px 0 10px" }}>Platos</p>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 16px 20px", scrollSnapType: "x mandatory", scrollbarWidth: "none" as any }}>
          {MOCK_DISHES.map(d => <DishCard key={d.id} d={d} width={170} />)}
        </div>
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 16px 24px" }} />

        {/* ═══ PROPUESTA C: Estilo inmersivo (foto fondo con overlay) + platos angostos ═══ */}
        <div style={{ padding: "0 16px", marginBottom: 10 }}>
          <h2 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 4px", color: "#F4A623" }}>Propuesta C</h2>
          <p style={{ fontSize: "13px", color: "#888", margin: "0 0 16px" }}>Ofertas inmersivas (foto completa con overlay) + platos a 170px</p>
        </div>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 16px 12px", scrollSnapType: "x mandatory", scrollbarWidth: "none" as any }}>
          {MOCK_PROMOS.map(p => <PromoC key={p.id} p={p} />)}
        </div>
        <p style={{ fontSize: "12px", color: "#666", padding: "0 16px", margin: "4px 0 10px" }}>Platos</p>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 16px 20px", scrollSnapType: "x mandatory", scrollbarWidth: "none" as any }}>
          {MOCK_DISHES.map(d => <DishCard key={d.id} d={d} width={170} />)}
        </div>

      </div>
    </div>
  );
}
