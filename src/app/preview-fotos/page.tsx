"use client";

import { useState } from "react";

const PHOTOS = [
  { name: "Galaxy", url: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/dishes/horusvegan/cmo31qnmf0004k004g271czyz_0.jpg" },
  { name: "HFC", url: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/dishes/horusvegan/cmo31qnms0006k004m7hpdjee_0.jpg" },
  { name: "Desierto", url: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/dishes/horusvegan/cmo31qnn30008k0042fm32rat_0.jpg" },
  { name: "Bosque mágico", url: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/dishes/horusvegan/cmo31qnnf000ak004hqhf8swx_0.jpg" },
  { name: "Pharaon", url: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/dishes/horusvegan/cmo31qnoc000gk0040i544gds_0.jpg" },
  { name: "Anubis", url: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/dishes/horusvegan/cmo31qnoo000ik0043gfmm1qp_0.jpg" },
];

const VARIANTS = [
  {
    id: "A",
    label: "Actual — object-cover (zoom/crop)",
    render: (url: string) => (
      <div style={{ position: "relative", width: "100%", height: 340, overflow: "hidden", background: "#000" }}>
        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
      </div>
    ),
  },
  {
    id: "B",
    label: "object-contain (sin crop, bordes vacíos)",
    render: (url: string) => (
      <div style={{ position: "relative", width: "100%", height: 340, overflow: "hidden", background: "#0e0e0e" }}>
        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </div>
    ),
  },
  {
    id: "C",
    label: "Contain + blur background",
    render: (url: string) => (
      <div style={{ position: "relative", width: "100%", height: 340, overflow: "hidden" }}>
        <img src={url} alt="" style={{ position: "absolute", inset: -20, width: "calc(100% + 40px)", height: "calc(100% + 40px)", objectFit: "cover", filter: "blur(20px) brightness(0.5)", transform: "scale(1.1)" }} />
        <img src={url} alt="" style={{ position: "relative", width: "100%", height: "100%", objectFit: "contain", zIndex: 1 }} />
      </div>
    ),
  },
  {
    id: "D",
    label: "Cover con menos altura (280px)",
    render: (url: string) => (
      <div style={{ position: "relative", width: "100%", height: 280, overflow: "hidden", background: "#000" }}>
        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%" }} />
      </div>
    ),
  },
  {
    id: "E",
    label: "Aspect ratio libre (foto natural)",
    render: (url: string) => (
      <div style={{ position: "relative", width: "100%", maxHeight: 400, overflow: "hidden", background: "#0e0e0e" }}>
        <img src={url} alt="" style={{ width: "100%", height: "auto", display: "block", maxHeight: 400, objectFit: "contain" }} />
      </div>
    ),
  },
  {
    id: "F",
    label: "Cover suave (object-position top)",
    render: (url: string) => (
      <div style={{ position: "relative", width: "100%", height: 340, overflow: "hidden", background: "#000" }}>
        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
      </div>
    ),
  },
];

export default function PreviewDishModal() {
  const [photoIdx, setPhotoIdx] = useState(0);
  const photo = PHOTOS[photoIdx];

  return (
    <div style={{ background: "#0e0e0e", minHeight: "100vh", color: "white", padding: "20px 16px 60px" }}>
      <h1 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 16, fontFamily: "system-ui" }}>Preview — Modal de plato con fotos de Horus</h1>

      {/* Photo selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, overflowX: "auto", paddingBottom: 4 }}>
        {PHOTOS.map((p, i) => (
          <button
            key={p.name}
            onClick={() => setPhotoIdx(i)}
            style={{
              padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
              background: i === photoIdx ? "#F4A623" : "rgba(255,255,255,0.08)",
              color: i === photoIdx ? "#0e0e0e" : "rgba(255,255,255,0.6)",
              fontSize: "0.82rem", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0,
            }}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Variants grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {VARIANTS.map(v => (
          <div key={v.id} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
            {v.render(photo.url)}
            <div style={{ padding: "12px 14px" }}>
              <p style={{ fontSize: "0.72rem", color: "#F4A623", fontWeight: 700, margin: "0 0 4px" }}>Variante {v.id}</p>
              <p style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.5)", margin: 0, lineHeight: 1.4 }}>{v.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Full width comparison */}
      <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: "32px 0 16px", fontFamily: "system-ui" }}>Vista completa (como se vería en el modal)</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {VARIANTS.map(v => (
          <div key={v.id} style={{ background: "white", borderRadius: 20, overflow: "hidden", maxWidth: 400 }}>
            {v.render(photo.url)}
            <div style={{ padding: "16px 20px" }}>
              <p style={{ fontSize: "0.65rem", color: "#F4A623", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 6px" }}>Variante {v.id} — {v.label}</p>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#0e0e0e", margin: "0 0 6px" }}>{photo.name}</h2>
              <p style={{ fontSize: "0.85rem", color: "#666", margin: "0 0 12px", lineHeight: 1.5 }}>Bowl vegano con ingredientes frescos y proteína de origen vegetal</p>
              <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "#F4A623" }}>$8.900</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
