"use client";

/**
 * MOCKUP — Propuestas de posición para filtros en /qr
 * Acceso: /admin/mockup-filtros-qr
 * Eliminar cuando se tome decisión de diseño.
 */

import { useState } from "react";

const ACCENT = "#F4A623";
const DISHES = [
  { name: "Lomo al Jugo", cat: "Fondos", price: "$8.900", tag: "🔥 Popular", photo: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&h=200&fit=crop", veg: false },
  { name: "Ensalada del Huerto", cat: "Entradas", price: "$5.200", tag: "⭐ Estrella", photo: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&h=200&fit=crop", veg: true },
  { name: "Pasta Primavera", cat: "Fondos", price: "$7.400", tag: "🌿 Veggie", photo: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=200&h=200&fit=crop", veg: true },
  { name: "Cazuela de Vacuno", cat: "Fondos", price: "$9.500", tag: "", photo: "https://images.unsplash.com/photo-1547592180-85f173990554?w=200&h=200&fit=crop", veg: false },
  { name: "Hummus y Pita", cat: "Entradas", price: "$4.800", tag: "🔥 Popular", photo: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=200&h=200&fit=crop", veg: true },
  { name: "Salmón a la Plancha", cat: "Fondos", price: "$11.200", tag: "⭐ Estrella", photo: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=200&h=200&fit=crop", veg: false },
];
const CATS = ["Todos", "Entradas", "Fondos", "Postres"];
const FILTERS = [
  { id: "popular", emoji: "🔥", label: "Popular" },
  { id: "estrella", emoji: "⭐", label: "Estrella" },
  { id: "veggie", emoji: "🌿", label: "Veggie" },
  { id: "precio_asc", emoji: "↑", label: "Precio" },
];

type ActiveFilter = string | null;

function FilterPills({ active, onToggle, dark = false }: { active: ActiveFilter; onToggle: (id: string) => void; dark?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", padding: "0 0 2px" }}>
      {FILTERS.map(f => {
        const isActive = active === f.id;
        return (
          <button key={f.id} onClick={() => onToggle(f.id)} style={{
            flexShrink: 0,
            display: "flex", alignItems: "center", gap: 5,
            padding: "7px 13px", borderRadius: 999,
            fontSize: 13, fontWeight: isActive ? 700 : 500,
            cursor: "pointer",
            background: isActive
              ? (f.id === "popular" ? (dark ? "rgba(239,68,68,0.18)" : "rgba(239,68,68,0.12)")
                : f.id === "veggie" ? (dark ? "rgba(34,197,94,0.18)" : "rgba(34,197,94,0.12)")
                : (dark ? "rgba(244,166,35,0.18)" : "rgba(244,166,35,0.13)"))
              : (dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"),
            border: `1px solid ${isActive
              ? (f.id === "popular" ? "rgba(239,68,68,0.45)"
                : f.id === "veggie" ? "rgba(34,197,94,0.45)"
                : "rgba(244,166,35,0.5)")
              : (dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.09)")}`,
            color: isActive
              ? (f.id === "popular" ? "#ef4444" : f.id === "veggie" ? "#16a34a" : ACCENT)
              : (dark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)"),
            transition: "all 0.15s",
            whiteSpace: "nowrap",
          }}>
            <span>{f.emoji}</span> {f.label}
          </button>
        );
      })}
    </div>
  );
}

function CategoryNav({ dark = false }: { dark?: boolean }) {
  const [cat, setCat] = useState("Todos");
  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", padding: "0 0 2px" }}>
      {CATS.map(c => {
        const isActive = cat === c;
        return (
          <button key={c} onClick={() => setCat(c)} style={{
            flexShrink: 0, padding: "6px 14px", borderRadius: 999,
            fontSize: 13, fontWeight: isActive ? 700 : 500,
            cursor: "pointer",
            background: isActive ? ACCENT : (dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"),
            border: `1px solid ${isActive ? ACCENT : (dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.09)")}`,
            color: isActive ? "#0a0a0a" : (dark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)"),
            whiteSpace: "nowrap",
          }}>
            {c}
          </button>
        );
      })}
    </div>
  );
}

function DishRowList({ dish, dark = false }: { dish: typeof DISHES[0]; dark?: boolean }) {
  return (
    <div style={{
      display: "flex", gap: 12, padding: "14px 0",
      borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
      alignItems: "center",
    }}>
      <img src={dish.photo} alt="" style={{ width: 68, height: 68, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: dark ? "#fff" : "#111", marginBottom: 2 }}>{dish.name}</div>
        <div style={{ fontSize: 11, color: dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)", marginBottom: 4 }}>{dish.cat}</div>
        {dish.tag && <span style={{ fontSize: 11, color: dish.tag.includes("Popular") ? "#ef4444" : dish.tag.includes("Estrella") ? ACCENT : "#16a34a" }}>{dish.tag}</span>}
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, color: ACCENT, flexShrink: 0 }}>{dish.price}</div>
    </div>
  );
}

function DishCardImpact({ dish, dark = true }: { dish: typeof DISHES[0]; dark?: boolean }) {
  return (
    <div style={{
      borderRadius: 16, overflow: "hidden", position: "relative",
      background: dark ? "#1a1a1a" : "#f0f0f0",
      boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
    }}>
      <img src={dish.photo} alt="" style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} />
      <div style={{ padding: "10px 12px" }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: dark ? "#fff" : "#111", marginBottom: 2, lineHeight: 1.3 }}>{dish.name}</div>
        <div style={{ fontWeight: 700, fontSize: 13, color: ACCENT }}>{dish.price}</div>
        {dish.tag && <div style={{ fontSize: 11, marginTop: 4, color: dish.tag.includes("Popular") ? "#ef4444" : dish.tag.includes("Estrella") ? ACCENT : "#16a34a" }}>{dish.tag}</div>}
      </div>
    </div>
  );
}

/* ───── Phone Frame ───── */
function Phone({ children, label, dark = false, highlight = false }: { children: React.ReactNode; label: string; dark?: boolean; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{
        fontSize: 13, fontWeight: 700, color: highlight ? ACCENT : "#666",
        background: highlight ? "rgba(244,166,35,0.1)" : "rgba(0,0,0,0.05)",
        border: `1.5px solid ${highlight ? "rgba(244,166,35,0.4)" : "transparent"}`,
        borderRadius: 8, padding: "4px 12px",
      }}>
        {highlight ? "★ " : ""}{label}
      </div>
      <div style={{
        width: 280, borderRadius: 36,
        background: dark ? "#0e0e0e" : "#f8f7f5",
        border: `3px solid ${highlight ? ACCENT : "#333"}`,
        boxShadow: highlight ? `0 8px 40px ${ACCENT}40, 0 2px 12px rgba(0,0,0,0.3)` : "0 8px 32px rgba(0,0,0,0.25)",
        overflow: "hidden",
        position: "relative",
        height: 560,
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Notch */}
        <div style={{ flexShrink: 0, height: 28, background: dark ? "#0e0e0e" : "#f8f7f5", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 80, height: 10, background: "#333", borderRadius: 999 }} />
        </div>
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ───── Opcion A: Filtros debajo de categorías (sticky) ───── */
function MockupListaOpcionA() {
  const [filter, setFilter] = useState<ActiveFilter>(null);
  const toggle = (id: string) => setFilter(f => f === id ? null : id);
  const dark = false;
  return (
    <Phone label="Opción A — Bajo nav categorías" highlight={false} dark={dark}>
      {/* Sticky header resto */}
      <div style={{ background: "#fff", padding: "8px 14px 0", flexShrink: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: "#111", marginBottom: 2 }}>El Rincón de Doña Rosa</div>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>Cocina Casera · Santiago</div>
      </div>
      {/* Sticky nav */}
      <div style={{ background: "#fff", borderBottom: "1px solid #eee", padding: "6px 14px", flexShrink: 0 }}>
        <CategoryNav dark={dark} />
      </div>
      {/* Sticky filter row */}
      <div style={{ background: "#fff", padding: "8px 14px 6px", borderBottom: "1px solid #f0f0f0", flexShrink: 0 }}>
        <FilterPills active={filter} onToggle={toggle} dark={dark} />
      </div>
      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 14px" }}>
        {DISHES.map((d, i) => <DishRowList key={i} dish={d} dark={dark} />)}
      </div>
    </Phone>
  );
}

/* ───── Opcion B: Filtros encima de categorías (sticky) ───── */
function MockupListaOpcionB() {
  const [filter, setFilter] = useState<ActiveFilter>(null);
  const toggle = (id: string) => setFilter(f => f === id ? null : id);
  const dark = false;
  return (
    <Phone label="Opción B — Sobre nav categorías" dark={dark}>
      <div style={{ background: "#fff", padding: "8px 14px 0", flexShrink: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: "#111", marginBottom: 2 }}>El Rincón de Doña Rosa</div>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>Cocina Casera · Santiago</div>
      </div>
      {/* Filters first */}
      <div style={{ background: "#fff", padding: "6px 14px 4px", borderBottom: "1px solid #f0f0f0", flexShrink: 0 }}>
        <FilterPills active={filter} onToggle={toggle} dark={dark} />
      </div>
      {/* Then categories */}
      <div style={{ background: "#fff", borderBottom: "1px solid #eee", padding: "6px 14px", flexShrink: 0 }}>
        <CategoryNav dark={dark} />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 14px" }}>
        {DISHES.map((d, i) => <DishRowList key={i} dish={d} dark={dark} />)}
      </div>
    </Phone>
  );
}

/* ───── Opcion C: Filtros combinados en misma fila que categorías (distintos) ───── */
function MockupListaOpcionC() {
  const [filter, setFilter] = useState<ActiveFilter>(null);
  const [cat, setCat] = useState("Todos");
  const dark = false;
  return (
    <Phone label="Opción C — Una sola fila mixta" dark={dark}>
      <div style={{ background: "#fff", padding: "8px 14px 0", flexShrink: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: "#111", marginBottom: 2 }}>El Rincón de Doña Rosa</div>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>Cocina Casera · Santiago</div>
      </div>
      {/* Combined row */}
      <div style={{ background: "#fff", borderBottom: "1px solid #eee", padding: "6px 14px", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", padding: "0 0 2px" }}>
          {CATS.map(c => {
            const isActive = cat === c;
            return (
              <button key={c} onClick={() => setCat(c)} style={{
                flexShrink: 0, padding: "6px 14px", borderRadius: 999,
                fontSize: 13, fontWeight: isActive ? 700 : 500, cursor: "pointer",
                background: isActive ? ACCENT : "rgba(0,0,0,0.06)",
                border: `1px solid ${isActive ? ACCENT : "rgba(0,0,0,0.09)"}`,
                color: isActive ? "#0a0a0a" : "rgba(0,0,0,0.55)",
                whiteSpace: "nowrap",
              }}>{c}</button>
            );
          })}
          {/* Separator dot */}
          <div style={{ width: 1, background: "#ddd", flexShrink: 0, margin: "4px 2px" }} />
          {FILTERS.map(f => {
            const isActive = filter === f.id;
            return (
              <button key={f.id} onClick={() => setFilter(p => p === f.id ? null : f.id)} style={{
                flexShrink: 0, display: "flex", alignItems: "center", gap: 4,
                padding: "6px 11px", borderRadius: 999,
                fontSize: 13, fontWeight: isActive ? 700 : 500, cursor: "pointer",
                background: isActive ? "rgba(244,166,35,0.13)" : "rgba(0,0,0,0.05)",
                border: `1px solid ${isActive ? "rgba(244,166,35,0.5)" : "rgba(0,0,0,0.09)"}`,
                color: isActive ? ACCENT : "rgba(0,0,0,0.4)",
                whiteSpace: "nowrap",
              }}>{f.emoji}</button>
            );
          })}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 14px" }}>
        {DISHES.map((d, i) => <DishRowList key={i} dish={d} dark={dark} />)}
      </div>
    </Phone>
  );
}

/* ───── IMPACT — Opción A: Filtros sticky bajo hero ───── */
function MockupImpactOpcionA() {
  const [filter, setFilter] = useState<ActiveFilter>(null);
  const toggle = (id: string) => setFilter(f => f === id ? null : id);
  const dark = true;
  return (
    <Phone label="Impact — A: Bajo hero, sobre categorías" dark={dark}>
      {/* Hero image area */}
      <div style={{ position: "relative", height: 140, flexShrink: 0, overflow: "hidden" }}>
        <img src={DISHES[0].photo} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.1) 50%)" }} />
        <div style={{ position: "absolute", bottom: 12, left: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>El Rincón</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>Cocina Casera</div>
        </div>
      </div>
      {/* Filter bar debajo del hero */}
      <div style={{ background: "#1a1a1a", padding: "8px 14px 6px", flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <FilterPills active={filter} onToggle={toggle} dark={dark} />
      </div>
      {/* Category nav */}
      <div style={{ background: "#1a1a1a", padding: "6px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
        <CategoryNav dark={dark} />
      </div>
      {/* Grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {DISHES.slice(0, 4).map((d, i) => <DishCardImpact key={i} dish={d} dark={dark} />)}
      </div>
    </Phone>
  );
}

/* ───── IMPACT — Opción B: Filtros debajo de categorías (recomendado) ───── */
function MockupImpactOpcionB() {
  const [filter, setFilter] = useState<ActiveFilter>(null);
  const toggle = (id: string) => setFilter(f => f === id ? null : id);
  const dark = true;
  return (
    <Phone label="Impact — B: Bajo categorías" highlight dark={dark}>
      <div style={{ position: "relative", height: 140, flexShrink: 0, overflow: "hidden" }}>
        <img src={DISHES[0].photo} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.1) 50%)" }} />
        <div style={{ position: "absolute", bottom: 12, left: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: "#fff" }}>El Rincón</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>Cocina Casera</div>
        </div>
      </div>
      {/* Category nav */}
      <div style={{ background: "#1a1a1a", padding: "8px 14px 6px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
        <CategoryNav dark={dark} />
      </div>
      {/* Filter bar debajo de categorías */}
      <div style={{ background: "#1a1a1a", padding: "6px 14px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
        <FilterPills active={filter} onToggle={toggle} dark={dark} />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {DISHES.slice(0, 4).map((d, i) => <DishCardImpact key={i} dish={d} dark={dark} />)}
      </div>
    </Phone>
  );
}

/* ───── IMPACT — Opción C: Filtros como botón flotante ───── */
function MockupImpactOpcionC() {
  const [filter, setFilter] = useState<ActiveFilter>(null);
  const [open, setOpen] = useState(false);
  const dark = true;
  const activeCount = filter ? 1 : 0;
  return (
    <Phone label="Impact — C: Botón flotante" dark={dark}>
      <div style={{ position: "relative", height: 140, flexShrink: 0, overflow: "hidden" }}>
        <img src={DISHES[0].photo} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.1) 50%)" }} />
        <div style={{ position: "absolute", bottom: 12, left: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: "#fff" }}>El Rincón</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>Cocina Casera</div>
        </div>
      </div>
      <div style={{ background: "#1a1a1a", padding: "8px 14px 6px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
        <CategoryNav dark={dark} />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, position: "relative" }}>
        {DISHES.slice(0, 4).map((d, i) => <DishCardImpact key={i} dish={d} dark={dark} />)}
        {/* FAB de filtros */}
        <div style={{ position: "absolute", bottom: 16, right: 14 }}>
          {open && (
            <div style={{
              position: "absolute", bottom: 48, right: 0,
              background: "#2a2a2a", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 14, padding: "8px 6px", minWidth: 140,
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              display: "flex", flexDirection: "column", gap: 4,
            }}>
              {FILTERS.map(f => (
                <button key={f.id} onClick={() => { setFilter(p => p === f.id ? null : f.id); setOpen(false); }} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                  background: filter === f.id ? "rgba(244,166,35,0.12)" : "transparent",
                  border: "none", borderRadius: 10, cursor: "pointer",
                  fontSize: 13, color: filter === f.id ? ACCENT : "rgba(255,255,255,0.7)",
                  fontWeight: filter === f.id ? 700 : 400,
                }}>{f.emoji} {f.label}</button>
              ))}
            </div>
          )}
          <button onClick={() => setOpen(p => !p)} style={{
            width: 46, height: 46, borderRadius: "50%",
            background: activeCount > 0 ? ACCENT : "#333",
            border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            position: "relative",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={activeCount > 0 ? "#0a0a0a" : "#fff"} strokeWidth="2.5" strokeLinecap="round">
              <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
              <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
              <line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>
            </svg>
            {activeCount > 0 && (
              <span style={{
                position: "absolute", top: -2, right: -2,
                background: "#ef4444", color: "#fff",
                borderRadius: 999, fontSize: 10, fontWeight: 700,
                width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center",
              }}>{activeCount}</span>
            )}
          </button>
        </div>
      </div>
    </Phone>
  );
}

/* ───── FREE / Esencial ───── */
function MockupFreeOpcionA() {
  const [filter, setFilter] = useState<ActiveFilter>(null);
  const toggle = (id: string) => setFilter(f => f === id ? null : id);
  const dark = false;
  return (
    <Phone label="Free — A: Bajo categorías" dark={dark}>
      <div style={{ background: "#fff", padding: "10px 14px 6px", flexShrink: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: "#111", marginBottom: 1 }}>El Rincón de Doña Rosa</div>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>Cocina Casera · Santiago</div>
      </div>
      <div style={{ background: "#fff", borderBottom: "1px solid #eee", padding: "6px 14px", flexShrink: 0 }}>
        <CategoryNav dark={dark} />
      </div>
      <div style={{ background: "#fff", padding: "6px 14px 6px", borderBottom: "1px solid #f0f0f0", flexShrink: 0 }}>
        <FilterPills active={filter} onToggle={toggle} dark={dark} />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 14px" }}>
        {DISHES.map((d, i) => <DishRowList key={i} dish={d} dark={dark} />)}
      </div>
    </Phone>
  );
}

function MockupFreeOpcionB() {
  const [filter, setFilter] = useState<ActiveFilter>(null);
  const toggle = (id: string) => setFilter(f => f === id ? null : id);
  const dark = false;
  return (
    <Phone label="Free — B: En barra categorías (icons)" dark={dark} highlight>
      <div style={{ background: "#fff", padding: "10px 14px 6px", flexShrink: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: "#111", marginBottom: 1 }}>El Rincón de Doña Rosa</div>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>Cocina Casera · Santiago</div>
      </div>
      {/* Nav + filters en misma línea pero separados */}
      <div style={{ background: "#fff", borderBottom: "1px solid #eee", padding: "6px 14px", flexShrink: 0 }}>
        <CategoryNav dark={dark} />
      </div>
      {/* Solo iconos, compacto */}
      <div style={{ background: "#fafafa", padding: "6px 14px", borderBottom: "1px solid #f0f0f0", flexShrink: 0, display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 10, color: "#aaa", fontWeight: 600, letterSpacing: "0.05em", flexShrink: 0 }}>FILTRAR</span>
        {FILTERS.map(f => {
          const isActive = filter === f.id;
          return (
            <button key={f.id} onClick={() => setFilter(p => p === f.id ? null : f.id)} style={{
              padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: isActive ? 700 : 400,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
              background: isActive ? "rgba(244,166,35,0.13)" : "rgba(0,0,0,0.05)",
              border: `1px solid ${isActive ? "rgba(244,166,35,0.5)" : "rgba(0,0,0,0.08)"}`,
              color: isActive ? ACCENT : "rgba(0,0,0,0.45)",
            }}>{f.emoji} {f.label}</button>
          );
        })}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 14px" }}>
        {DISHES.map((d, i) => <DishRowList key={i} dish={d} dark={dark} />)}
      </div>
    </Phone>
  );
}

/* ───── PAGE ───── */
export default function MockupFiltrosQRPage() {
  const [section, setSection] = useState<"lista" | "impact" | "free">("lista");

  return (
    <div style={{ minHeight: "100vh", background: "#f5f4f1", fontFamily: "'DM Sans', system-ui, sans-serif", padding: "32px 24px 80px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111", margin: "0 0 4px" }}>
          Mockup — Filtros en carta QR
        </h1>
        <p style={{ fontSize: 14, color: "#666", margin: "0 0 28px" }}>
          Propuestas de posición y estilo para las pills de filtro. La marcada con <strong style={{ color: ACCENT }}>★</strong> es la que más me convence. Toca las pills para ver el efecto activo.
        </p>

        {/* Tab selector */}
        <div style={{ display: "flex", gap: 8, marginBottom: 36 }}>
          {(["lista", "impact", "free"] as const).map(s => (
            <button key={s} onClick={() => setSection(s)} style={{
              padding: "8px 20px", borderRadius: 999, fontSize: 14, fontWeight: 700, cursor: "pointer",
              background: section === s ? "#111" : "rgba(0,0,0,0.06)",
              border: "none", color: section === s ? "#fff" : "#555",
            }}>
              {s === "lista" ? "Vista Lista" : s === "impact" ? "Vista Impact" : "Vista Free"}
            </button>
          ))}
        </div>

        {section === "lista" && (
          <>
            <p style={{ fontSize: 13, color: "#888", margin: "0 0 24px" }}>
              Vista Lista — fondo claro, scroll vertical. Las categorías son sticky en top:0, los filtros irían justo debajo.
            </p>
            <div style={{ display: "flex", gap: 32, flexWrap: "wrap", justifyContent: "center" }}>
              <MockupListaOpcionA />
              <MockupListaOpcionB />
              <MockupListaOpcionC />
            </div>
          </>
        )}

        {section === "impact" && (
          <>
            <p style={{ fontSize: 13, color: "#888", margin: "0 0 24px" }}>
              Vista Impact — fondo oscuro, hero con foto, grid 2 columnas. Opción B es la que mejor aprovecha el espacio sin saturar.
            </p>
            <div style={{ display: "flex", gap: 32, flexWrap: "wrap", justifyContent: "center" }}>
              <MockupImpactOpcionA />
              <MockupImpactOpcionB />
              <MockupImpactOpcionC />
            </div>
          </>
        )}

        {section === "free" && (
          <>
            <p style={{ fontSize: 13, color: "#888", margin: "0 0 24px" }}>
              Vista Free (CartaBasic / CartaEsencial) — misma estructura que Lista pero sin personalización. Los filtros agregan valor sin requerir plan pagado.
            </p>
            <div style={{ display: "flex", gap: 32, flexWrap: "wrap", justifyContent: "center" }}>
              <MockupFreeOpcionA />
              <MockupFreeOpcionB />
            </div>
          </>
        )}

        <div style={{ marginTop: 48, padding: "20px 24px", background: "#fff", borderRadius: 16, border: "1px solid #eee" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111", margin: "0 0 12px" }}>Resumen de opciones</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Lista A / Impact B / Free A: Filtros bajo nav categorías", rec: true, desc: "La más natural. Categorías = dónde estoy. Filtros = cómo quiero ver. Dos niveles claros. Sticky juntos." },
              { label: "Lista B: Filtros sobre categorías", rec: false, desc: "Invertido — la categoría queda visualmente secundaria siendo lo más importante." },
              { label: "Lista C: Todo en una fila", rec: false, desc: "Muy compacto pero confunde las categorías con los filtros." },
              { label: "Impact C: Botón flotante", rec: false, desc: "Ocupas menos espacio pero el descubrimiento es bajo — el usuario no sabe que hay filtros." },
            ].map(o => (
              <div key={o.label} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 14px", borderRadius: 10, background: o.rec ? "rgba(244,166,35,0.06)" : "#fafafa", border: `1px solid ${o.rec ? "rgba(244,166,35,0.25)" : "#eee"}` }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{o.rec ? "★" : "○"}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: o.rec ? "#a07000" : "#333", marginBottom: 2 }}>{o.label}</div>
                  <div style={{ fontSize: 12, color: "#888" }}>{o.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
