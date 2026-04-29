"use client";

import { useState, useEffect } from "react";

const DM = "var(--font-display)";
const PF = "var(--font-playfair, Georgia, serif)";
const BRAND = "#F4A623";

interface Dish {
  id: string;
  name: string;
  price: number;
  photo: string;
  diet: "VEGAN" | "VEGETARIAN" | "OMNIVORE";
  desc?: string;
}

interface Category {
  id: string;
  name: string;
  dishes: Dish[];
}

const MENU: Category[] = [
  {
    id: "1", name: "Para compartir",
    dishes: [
      { id: "d1", name: "Gyozas de cerdo", price: 6900, photo: "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=400&h=400&fit=crop", diet: "OMNIVORE", desc: "6 unidades con salsa ponzu" },
      { id: "d2", name: "Edamame con sal de mar", price: 3500, photo: "https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=400&h=400&fit=crop", diet: "VEGAN", desc: "Porotos de soja al vapor" },
      { id: "d3", name: "Tempura de langostinos", price: 8900, photo: "https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=400&h=400&fit=crop", diet: "OMNIVORE", desc: "4 langostinos en masa tempura" },
      { id: "d4", name: "Rollitos primavera veganos", price: 5200, photo: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=400&fit=crop", diet: "VEGAN", desc: "Rellenos de verduras frescas" },
    ],
  },
  {
    id: "2", name: "Ceviches y tiraditos",
    dishes: [
      { id: "d5", name: "Ceviche clásico", price: 12900, photo: "https://images.unsplash.com/photo-1535399831218-d5bd36d1a6b3?w=400&h=400&fit=crop", diet: "OMNIVORE", desc: "Pescado del día, limón, cilantro" },
      { id: "d6", name: "Tiradito de salmón", price: 14500, photo: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&h=400&fit=crop", diet: "OMNIVORE", desc: "Láminas de salmón, ají amarillo" },
      { id: "d7", name: "Ceviche de mango", price: 11900, photo: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop", diet: "OMNIVORE", desc: "Con leche de tigre tropical" },
    ],
  },
  {
    id: "3", name: "Rolls clásicos",
    dishes: [
      { id: "d8", name: "California roll", price: 9900, photo: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=400&h=400&fit=crop", diet: "OMNIVORE", desc: "Kanikama, palta, pepino" },
      { id: "d9", name: "Avocado roll", price: 7500, photo: "https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=400&h=400&fit=crop", diet: "VEGAN", desc: "Palta cremosa, sésamo" },
      { id: "d10", name: "Spicy tuna roll", price: 11900, photo: "https://images.unsplash.com/photo-1553621042-f6e147245754?w=400&h=400&fit=crop", diet: "OMNIVORE", desc: "Atún picante, mayo sriracha" },
      { id: "d11", name: "Veggie dragon roll", price: 8900, photo: "https://images.unsplash.com/photo-1559410545-0bdcd187e0a6?w=400&h=400&fit=crop", diet: "VEGAN", desc: "Palta, espárrago, zanahoria" },
    ],
  },
  {
    id: "4", name: "Fondos",
    dishes: [
      { id: "d12", name: "Ramen de cerdo", price: 15900, photo: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&h=400&fit=crop", diet: "OMNIVORE", desc: "Chashu, huevo, cebollín" },
      { id: "d13", name: "Pad thai de tofu", price: 12500, photo: "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=400&h=400&fit=crop", diet: "VEGAN", desc: "Tofu firme, maní, brotes" },
      { id: "d14", name: "Teriyaki de pollo", price: 13900, photo: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=400&fit=crop", diet: "OMNIVORE", desc: "Pollo glaseado, arroz japonés" },
      { id: "d15", name: "Bowl de quinoa", price: 11500, photo: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=400&fit=crop", diet: "VEGAN", desc: "Quinoa, verduras asadas, hummus" },
      { id: "d16", name: "Curry verde vegano", price: 12900, photo: "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=400&h=400&fit=crop", diet: "VEGAN", desc: "Leche de coco, albahaca thai" },
    ],
  },
  {
    id: "5", name: "Postres",
    dishes: [
      { id: "d17", name: "Mochi de matcha", price: 4500, photo: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=400&fit=crop", diet: "VEGAN", desc: "Helado vegano de matcha" },
      { id: "d18", name: "Cheesecake yuzu", price: 5900, photo: "https://images.unsplash.com/photo-1567171466295-4afa63d45416?w=400&h=400&fit=crop", diet: "VEGETARIAN", desc: "Base de galleta, coulis cítrico" },
      { id: "d19", name: "Tempura de helado", price: 6500, photo: "https://images.unsplash.com/photo-1488900128323-21503983a07e?w=400&h=400&fit=crop", diet: "OMNIVORE", desc: "Helado frito con canela" },
    ],
  },
];

const allVegan = MENU.flatMap(cat => cat.dishes.filter(d => d.diet === "VEGAN").map(d => ({ ...d, category: cat.name })));

/* ── Premium Card (horizontal scroll) ── */
function PremiumCard({ dish }: { dish: Dish }) {
  return (
    <div style={{ width: 205, minWidth: 205, flexShrink: 0, scrollSnapAlign: "start" }}>
      <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", height: 290, background: "#1a1a1a" }}>
        <img src={dish.photo} alt={dish.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.25) 30%, transparent 55%)" }} />
        <h3 style={{ position: "absolute", bottom: 28, left: 10, right: 10, fontFamily: DM, fontSize: "1.125rem", fontWeight: 700, color: "white", lineHeight: 1.3, margin: 0 }}>
          {dish.name}{" "}
          {dish.diet === "VEGAN" && <span style={{ fontSize: 12, verticalAlign: "middle" }}>🌿</span>}
          {dish.diet === "VEGETARIAN" && <span style={{ fontSize: 12, verticalAlign: "middle" }}>🥗</span>}
        </h3>
        <span style={{ position: "absolute", bottom: 9, left: 10, fontFamily: DM, fontSize: "0.9rem", fontWeight: 500, color: BRAND }}>
          ${dish.price.toLocaleString("es-CL")}
        </span>
      </div>
    </div>
  );
}

/* ── Lista Card (vertical list) ── */
function ListaCard({ dish }: { dish: Dish }) {
  return (
    <div style={{ display: "flex", gap: 0, background: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid #f0ebe0" }}>
      <div style={{ width: 140, minHeight: 120, position: "relative", flexShrink: 0 }}>
        <img src={dish.photo} alt={dish.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <div style={{ flex: 1, padding: "12px 14px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <h3 style={{ fontFamily: DM, fontSize: "1rem", fontWeight: 700, color: "#0e0e0e", margin: "0 0 4px", lineHeight: 1.3 }}>
          {dish.name}{" "}
          {dish.diet === "VEGAN" && <span style={{ fontSize: 12, verticalAlign: "middle" }}>🌿</span>}
          {dish.diet === "VEGETARIAN" && <span style={{ fontSize: 12, verticalAlign: "middle" }}>🥗</span>}
        </h3>
        {dish.desc && <p style={{ fontSize: "0.82rem", color: "#999", margin: "0 0 8px", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any, overflow: "hidden" }}>{dish.desc}</p>}
        <span style={{ fontFamily: DM, fontSize: "0.9rem", fontWeight: 600, color: BRAND }}>${dish.price.toLocaleString("es-CL")}</span>
      </div>
    </div>
  );
}

/* ── Genio Vegan Carousel ── */
function GenioCarousel({ onDishClick }: { onDishClick?: (id: string) => void }) {
  return (
    <div style={{
      margin: "0 20px 20px", padding: "16px 14px",
      background: "linear-gradient(135deg, #FFF7E8 0%, #FFEDD0 100%)",
      border: "1px solid rgba(244,166,35,0.2)", borderRadius: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: "1.3rem" }}>🧞</span>
        <div>
          <p style={{ fontFamily: DM, fontSize: "0.88rem", fontWeight: 600, color: "#0e0e0e", margin: 0 }}>
            Encontré {allVegan.length} platos veganos para ti
          </p>
          <p style={{ fontFamily: DM, fontSize: "0.72rem", color: "#8a5a2c", margin: "2px 0 0" }}>
            Repartidos en {new Set(allVegan.map(d => d.category)).size} secciones de la carta
          </p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" as any }}>
        {allVegan.map(d => (
          <button key={d.id} onClick={() => onDishClick?.(d.id)} style={{
            flexShrink: 0, background: "#fff", border: "1px solid rgba(244,166,35,0.15)",
            borderRadius: 12, padding: 6, cursor: "pointer", width: 100, textAlign: "left",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          }}>
            <img src={d.photo} alt="" style={{ width: "100%", height: 60, borderRadius: 8, objectFit: "cover", marginBottom: 4 }} />
            <p style={{ fontFamily: DM, fontSize: "0.65rem", fontWeight: 600, color: "#0e0e0e", margin: "0 0 1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</p>
            <p style={{ fontFamily: DM, fontSize: "0.62rem", color: BRAND, fontWeight: 600, margin: 0 }}>${d.price.toLocaleString("es-CL")}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Vista Premium ── */
function VistaPremium() {
  const scrollToDish = (id: string) => {
    const el = document.getElementById(`premium-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      {/* Fake hero */}
      <div style={{ height: 280, background: "linear-gradient(to bottom, #1a1a1a, #333)", position: "relative", overflow: "hidden" }}>
        <img src="https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&h=400&fit=crop" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.6 }} />
        <div style={{ position: "absolute", bottom: 20, left: 20 }}>
          <p style={{ fontFamily: DM, fontSize: "0.85rem", color: "rgba(255,255,255,0.6)", margin: "0 0 4px" }}>Carta · ordenada para ti</p>
          <h1 style={{ fontFamily: PF, fontSize: "1.6rem", fontWeight: 700, color: "white", margin: 0 }}>Hand Roll</h1>
        </div>
      </div>

      {/* Category nav */}
      <div style={{ position: "sticky", top: 44, zIndex: 10, background: "#fff", borderBottom: "1px solid #eee", padding: "0 16px", overflowX: "auto", scrollbarWidth: "none" as any, display: "flex", gap: 0 }}>
        <button style={{ padding: "12px 14px", background: "none", border: "none", borderBottom: `2px solid ${BRAND}`, fontFamily: DM, fontSize: "0.82rem", fontWeight: 600, color: BRAND, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>Ofertas</button>
        {MENU.map(cat => (
          <button key={cat.id} style={{ padding: "12px 14px", background: "none", border: "none", borderBottom: "2px solid transparent", fontFamily: DM, fontSize: "0.82rem", fontWeight: 600, color: "#999", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
            {cat.name}
          </button>
        ))}
      </div>

      {/* Promos section */}
      <div style={{ padding: "16px 12px 4px" }}>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollSnapType: "x mandatory", scrollbarWidth: "none" as any }}>
          {[
            { name: "2x1 en Rolls", desc: "Todos los rolls clásicos", discount: 50, price: 9900, photo: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=200&h=200&fit=crop" },
            { name: "Combo Familiar", desc: "Tabla de sushi + 2 entradas", discount: null, price: 42900, photo: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=200&h=200&fit=crop" },
          ].map((p, i) => (
            <div key={i} style={{ flex: "0 0 290px", minWidth: 290, scrollSnapAlign: "start", background: "linear-gradient(135deg, #FFF7E8 0%, #FFEDD0 100%)", border: "1px solid rgba(244,166,35,0.25)", borderRadius: 16, display: "flex", overflow: "hidden" }}>
              <div style={{ width: 95, minHeight: 80, position: "relative", flexShrink: 0 }}>
                <img src={p.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                {p.discount && <span style={{ position: "absolute", top: 4, left: 4, background: "#10b981", color: "white", fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: 6 }}>-{p.discount}%</span>}
              </div>
              <div style={{ flex: 1, padding: "10px 12px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#C23B1E", letterSpacing: "0.2em", textTransform: "uppercase" }}>HOY</span>
                <p style={{ fontFamily: DM, fontSize: "14px", fontWeight: 700, color: "#0e0e0e", margin: "2px 0 0" }}>{p.name}</p>
                <p style={{ fontSize: "12.5px", color: "#8a7060", margin: "2px 0 0" }}>{p.desc}</p>
                <span style={{ fontSize: "15px", fontWeight: 700, color: BRAND, marginTop: 4, display: "block" }}>${p.price.toLocaleString("es-CL")}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Genio carousel — below promos */}
      <div style={{ paddingTop: 12 }}>
        <GenioCarousel onDishClick={scrollToDish} />
      </div>

      {/* Categories with horizontal scroll */}
      {MENU.map(cat => {
        const sorted = [...cat.dishes].sort((a, b) => {
          if (a.diet === "VEGAN" && b.diet !== "VEGAN") return -1;
          if (a.diet !== "VEGAN" && b.diet === "VEGAN") return 1;
          return 0;
        });
        return (
          <section key={cat.id} style={{ paddingTop: 21 }}>
            <div style={{ padding: "0 20px", marginBottom: 10 }}>
              <h2 style={{ fontFamily: PF, fontSize: "1.5rem", fontWeight: 800, color: "#0e0e0e", margin: 0 }}>{cat.name}</h2>
            </div>
            <div style={{ display: "flex", overflowX: "auto", gap: 10, paddingLeft: 20, paddingRight: 20, paddingBottom: 8, scrollSnapType: "x mandatory", scrollbarWidth: "none" as any }}>
              {sorted.map(d => (
                <div key={d.id} id={`premium-${d.id}`}>
                  <PremiumCard dish={d} />
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* Genio banner bottom */}
      <div style={{ margin: "32px 20px 16px", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, background: "linear-gradient(135deg, #FFF7E8 0%, #FFEDD0 100%)", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 14 }}>
        <span style={{ fontSize: "1.3rem" }}>🧞</span>
        <div style={{ flex: 1 }}>
          <span style={{ fontFamily: DM, fontSize: "0.88rem", fontWeight: 600, color: "#0e0e0e" }}>Tu carta está personalizada ✓</span>
          <span style={{ fontFamily: DM, fontSize: "0.72rem", color: "#8a5a2c", marginLeft: 8 }}>Editar gustos</span>
        </div>
      </div>

      <div style={{ height: 100 }} />
    </div>
  );
}

/* ── Vista Lista ── */
function VistaLista() {

  const scrollToDish = (id: string) => {
    const el = document.getElementById(`lista-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div style={{ background: "#f7f7f5", minHeight: "100vh" }}>
      {/* Fake slim hero */}
      <div style={{ height: 180, background: "#1a1a1a", position: "relative", overflow: "hidden" }}>
        <img src="https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&h=300&fit=crop" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.5 }} />
        <div style={{ position: "absolute", bottom: 16, left: 16 }}>
          <h1 style={{ fontFamily: DM, fontSize: "1.2rem", fontWeight: 700, color: "white", margin: 0 }}>Hand Roll</h1>
        </div>
      </div>

      {/* Category tabs */}
      <div style={{ position: "sticky", top: 44, zIndex: 10, background: "#fff", borderBottom: "1px solid #eee", padding: "0 16px", overflowX: "auto", scrollbarWidth: "none" as any, display: "flex", gap: 0 }}>
        <button style={{ padding: "12px 14px", background: "none", border: "none", borderBottom: `2px solid ${BRAND}`, fontFamily: DM, fontSize: "0.82rem", fontWeight: 600, color: BRAND, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>Ofertas</button>
        {MENU.map(cat => (
          <button key={cat.id} style={{ padding: "12px 14px", background: "none", border: "none", borderBottom: "2px solid transparent", fontFamily: DM, fontSize: "0.82rem", fontWeight: 600, color: "#999", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
            {cat.name}
          </button>
        ))}
      </div>

      {/* Promos section */}
      <div style={{ padding: "16px 16px 4px" }}>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollSnapType: "x mandatory", scrollbarWidth: "none" as any }}>
          {[
            { name: "2x1 en Rolls", desc: "Todos los rolls clásicos", discount: 50, price: 9900, photo: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=200&h=200&fit=crop" },
            { name: "Combo Familiar", desc: "Tabla de sushi + 2 entradas", discount: null, price: 42900, photo: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=200&h=200&fit=crop" },
          ].map((p, i) => (
            <div key={i} style={{ flex: "0 0 290px", minWidth: 290, scrollSnapAlign: "start", background: "linear-gradient(135deg, #FFF7E8 0%, #FFEDD0 100%)", border: "1px solid rgba(244,166,35,0.25)", borderRadius: 16, display: "flex", overflow: "hidden" }}>
              <div style={{ width: 95, minHeight: 80, position: "relative", flexShrink: 0 }}>
                <img src={p.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                {p.discount && <span style={{ position: "absolute", top: 4, left: 4, background: "#10b981", color: "white", fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: 6 }}>-{p.discount}%</span>}
              </div>
              <div style={{ flex: 1, padding: "10px 12px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#C23B1E", letterSpacing: "0.2em", textTransform: "uppercase" }}>HOY</span>
                <p style={{ fontFamily: DM, fontSize: "14px", fontWeight: 700, color: "#0e0e0e", margin: "2px 0 0" }}>{p.name}</p>
                <p style={{ fontSize: "12.5px", color: "#8a7060", margin: "2px 0 0" }}>{p.desc}</p>
                <span style={{ fontSize: "15px", fontWeight: 700, color: BRAND, marginTop: 4, display: "block" }}>${p.price.toLocaleString("es-CL")}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Genio carousel — below promos */}
      <div style={{ paddingTop: 12, paddingBottom: 4 }}>
        <GenioCarousel onDishClick={scrollToDish} />
      </div>

      {/* Categories with vertical list */}
      <div style={{ padding: "0 16px" }}>
        {MENU.map(cat => {
          const sorted = [...cat.dishes].sort((a, b) => {
            if (a.diet === "VEGAN" && b.diet !== "VEGAN") return -1;
            if (a.diet !== "VEGAN" && b.diet === "VEGAN") return 1;
            return 0;
          });
          return (
            <section key={cat.id} style={{ paddingTop: 20 }}>
              <h2 style={{ fontFamily: PF, fontSize: "1.1rem", fontWeight: 700, color: "#777", margin: "0 0 10px" }}>{cat.name}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {sorted.map(d => (
                  <div key={d.id} id={`lista-${d.id}`}>
                    <ListaCard dish={d} />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div style={{ height: 100 }} />
    </div>
  );
}

/* ── PAGE ── */
export default function PreviewDietPage() {
  const [view, setView] = useState<"premium" | "lista">("premium");
  const [showFab, setShowFab] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowFab(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div style={{ minHeight: "100dvh" }}>
      {/* View switcher */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, background: "rgba(14,14,14,0.95)", backdropFilter: "blur(8px)", padding: "8px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontFamily: DM, fontSize: "0.7rem", color: BRAND, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>Preview vegano</span>
        <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
          {(["premium", "lista"] as const).map(v => (
            <button key={v} onClick={() => { setView(v); window.scrollTo({ top: 0 }); }} style={{
              padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
              fontFamily: DM, fontSize: "0.75rem", fontWeight: 600,
              background: view === v ? BRAND : "rgba(255,255,255,0.08)",
              color: view === v ? "#0a0a0a" : "#888",
            }}>
              {v === "premium" ? "Galería" : "Lista"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ paddingTop: 44 }}>
        {view === "premium" && <VistaPremium />}
        {view === "lista" && <VistaLista />}
      </div>

      {/* Floating button — always rendered from parent */}
      {showFab && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 100,
          display: "flex", alignItems: "center", gap: 6,
          padding: "12px 22px", background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)",
          border: "1px solid rgba(244,166,35,0.3)", borderRadius: 999,
          cursor: "pointer", boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        }}>
          <span style={{ fontSize: "15px" }}>🌿</span>
          <span style={{ fontFamily: DM, fontSize: "0.82rem", fontWeight: 600, color: "#0e0e0e" }}>Mis opciones veganas ↑</span>
        </button>
      )}
    </div>
  );
}
