"use client";

export type CartaFilterKey = "popular" | "veggie" | "estrella";

interface Props {
  active: CartaFilterKey | null;
  onToggle: (key: CartaFilterKey) => void;
  /** Free B style: shows "FILTRAR" label, slightly smaller pills */
  compact?: boolean;
}

const FILTERS: { key: CartaFilterKey; emoji: string; label: string }[] = [
  { key: "popular",  emoji: "🔥", label: "Popular" },
  { key: "estrella", emoji: "⭐", label: "Recomendados" },
  { key: "veggie",   emoji: "🌿", label: "Veggie" },
];

export default function CartaFilterBar({ active, onToggle, compact = false }: Props) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: compact ? 6 : 8 }}>
      {compact && (
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
          color: "var(--carta-text-muted)", flexShrink: 0, textTransform: "uppercase",
        }}>
          Filtrar
        </span>
      )}
      <div style={{
        display: "flex", gap: compact ? 5 : 7, flex: 1,
      }}>
        {FILTERS.map((f) => {
          const isActive = active === f.key;
          return (
            <button
              key={f.key}
              onClick={() => onToggle(f.key)}
              className="font-[family-name:var(--font-dm)]"
              style={{
                flex: 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                padding: compact ? "5px 8px" : "7px 8px",
                borderRadius: 999,
                fontSize: compact ? 12 : 13,
                fontWeight: isActive ? 700 : 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
                background: isActive
                  ? (f.key === "popular"
                      ? "color-mix(in srgb, #ef4444 12%, var(--carta-bg))"
                      : f.key === "veggie"
                        ? "color-mix(in srgb, #16a34a 12%, var(--carta-bg))"
                        : "color-mix(in srgb, var(--carta-accent) 13%, var(--carta-bg))")
                  : "color-mix(in srgb, var(--carta-text) 6%, var(--carta-bg))",
                border: isActive
                  ? (f.key === "popular"
                      ? "1px solid rgba(239,68,68,0.45)"
                      : f.key === "veggie"
                        ? "1px solid rgba(22,163,74,0.45)"
                        : "1px solid color-mix(in srgb, var(--carta-accent) 50%, transparent)")
                  : "1px solid color-mix(in srgb, var(--carta-text) 10%, transparent)",
                color: isActive
                  ? (f.key === "popular" ? "#ef4444" : f.key === "veggie" ? "#16a34a" : "var(--carta-accent)")
                  : "var(--carta-text-muted)",
              }}
            >
              <span>{f.emoji}</span>
              {f.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Apply a filter key to a dish array. Returns a new array. */
export function applyCartaFilter<D extends {
  tags?: string[];
  price: number;
  discountPrice?: number | null;
  id: string;
  categoryId: string;
  isActive?: boolean;
  dishDiet?: string | null;
}>(dishes: D[], filter: CartaFilterKey | null, popularDishIds: Set<string>): D[] {
  if (!filter) return dishes;
  if (filter === "popular")  return dishes.filter(d => popularDishIds.has(d.id));
  if (filter === "estrella") return dishes.filter(d => (d as any).tags?.includes("RECOMMENDED"));
  if (filter === "veggie")   return dishes.filter(d => (d as any).dishDiet === "VEGAN" || (d as any).dishDiet === "VEGETARIAN");
  return dishes;
}
