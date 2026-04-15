"use client";
import { useState } from "react";
import Image from "next/image";
import DishPlaceholder from "@/components/DishPlaceholder";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Dish = any;

interface Props {
  dishes: Dish[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  loading?: boolean;
}

export default function DishGrid({ dishes, selected, onToggleSelect, loading }: Props) {
  const [previewDish, setPreviewDish] = useState<Dish | null>(null);

  if (loading) {
    return <p className="font-body" style={{ color: "#999", textAlign: "center", padding: 40 }}>Cargando platos...</p>;
  }

  if (dishes.length === 0) {
    return <p className="font-body" style={{ color: "#999", textAlign: "center", padding: 40 }}>No hay platos disponibles aún. Vuelve pronto.</p>;
  }

  return (
    <>
      {/* Selected count */}
      {selected.size > 0 && (
        <p className="font-body" style={{ fontSize: "0.78rem", color: "#3db89e", textAlign: "center", marginBottom: 10 }}>
          {selected.size} seleccionado{selected.size > 1 ? "s" : ""}
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
        {dishes.map((d: Dish) => {
          const isSel = selected.has(d.id);
          return (
            <div key={d.id}
              className={d.imagenUrl ? "skeleton" : ""}
              style={{ position: "relative", aspectRatio: "1", borderRadius: 14, overflow: "hidden", border: isSel ? "2px solid #3db89e" : "2px solid transparent", cursor: "pointer" }}
              onClick={() => setPreviewDish(d)}>
              {d.imagenUrl ? (
                <Image src={d.imagenUrl} alt={d.nombre} fill sizes="(max-width: 500px) 33vw, 160px" style={{ objectFit: "cover", opacity: isSel ? 0.7 : 1, transition: "opacity 0.15s" }} loading="lazy" />
              ) : (
                <DishPlaceholder categoria={d.categoria} />
              )}
              {/* Vegan badge */}
              {d.dietType === "VEGAN" && (
                <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.55)", borderRadius: 99, padding: "2px 6px", fontSize: 10, color: "#fff", display: "flex", alignItems: "center", gap: 2 }}>🌿</div>
              )}
              {/* Checkbox — large hit area */}
              <button onClick={(e) => { e.stopPropagation(); onToggleSelect(d.id); }} style={{ position: "absolute", top: 0, right: 0, width: 40, height: 40, background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                <span style={{ width: 26, height: 26, borderRadius: "50%", background: isSel ? "#FFD600" : "rgba(0,0,0,0.3)", border: isSel ? "2px solid #FFD600" : "2px solid rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: isSel ? "#0D0D0D" : "#fff", fontWeight: 800 }}>{isSel ? "✓" : ""}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Preview modal */}
      {previewDish && (
        <>
          <div onClick={() => setPreviewDish(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(90vw, 400px)", zIndex: 101, borderRadius: 20, overflow: "hidden", background: "#FFF", boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}>
            {/* X close */}
            <button onClick={() => setPreviewDish(null)} style={{ position: "absolute", top: 12, right: 12, zIndex: 2, width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            {previewDish.imagenUrl ? (
              <div style={{ position: "relative" }}>
                <Image src={previewDish.imagenUrl} alt={previewDish.nombre} width={400} height={260} sizes="90vw" style={{ width: "100%", height: 260, objectFit: "cover" }} />
                {previewDish.dietType === "VEGAN" && (
                  <div style={{ position: "absolute", bottom: 10, left: 10, background: "rgba(0,0,0,0.6)", borderRadius: 99, padding: "3px 10px", fontSize: 11, color: "#fff", display: "flex", alignItems: "center", gap: 4 }}>🌿 Vegano</div>
                )}
              </div>
            ) : (
              <div style={{ height: 200 }}><DishPlaceholder categoria={previewDish.categoria} /></div>
            )}
            <div style={{ padding: "16px 20px" }}>
              <h3 className="font-display" style={{ fontSize: "1.1rem", color: "#0D0D0D", marginBottom: 2 }}>{previewDish.nombre}</h3>
              <p className="font-body" style={{ fontSize: "0.82rem", color: "#999", marginBottom: 6 }}>{previewDish.local?.nombre} · <span style={{ color: "#0D0D0D" }}>${Number(previewDish.precio).toLocaleString("es-CL")}</span></p>
              {previewDish.descripcion && (
                <p className="font-body" style={{ fontSize: "0.8rem", color: "#666", lineHeight: 1.5, marginBottom: 10 }}>{previewDish.descripcion}</p>
              )}
              {previewDish.ingredients?.length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
                  {previewDish.ingredients.map((ing: string) => (
                    <span key={ing} style={{ padding: "2px 8px", borderRadius: 99, background: "#F5F5F5", fontSize: "0.7rem", color: "#666" }}>{ing}</span>
                  ))}
                </div>
              )}
              {previewDish.totalLoved > 0 && (
                <p className="font-body" style={{ fontSize: "0.78rem", color: "#3db89e", marginBottom: 10 }}>{previewDish.totalLoved} personas lo recomiendan</p>
              )}
              <button onClick={() => { onToggleSelect(previewDish.id); setPreviewDish(null); }} style={{ width: "100%", padding: 14, background: selected.has(previewDish.id) ? "#F5F5F5" : "#FFD600", border: "none", borderRadius: 99, fontWeight: 700, fontSize: "0.88rem", color: selected.has(previewDish.id) ? "#ff6b6b" : "#0D0D0D", cursor: "pointer" }}>
                {selected.has(previewDish.id) ? "Quitar selección" : "Me llama la atención"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
