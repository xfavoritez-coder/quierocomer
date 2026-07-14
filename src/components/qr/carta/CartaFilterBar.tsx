"use client";
import { useLang } from "@/contexts/LangContext";
import { t } from "@/lib/qr/i18n";

export type CartaFilterKey = "popular" | "veggie" | "estrella" | "gluten-free";

interface Props {
  active: CartaFilterKey[];
  onToggle: (key: CartaFilterKey) => void;
  /** Free B style: shows "FILTRAR" label, slightly smaller pills */
  compact?: boolean;
  /** Glass style for dark backgrounds (Impact header) */
  glass?: boolean;
}

export default function CartaFilterBar({ active, onToggle, compact = false, glass = false }: Props) {
  const lang = useLang();

  const FILTERS: { key: CartaFilterKey; emoji: string; label: string }[] = [
    { key: "popular",     emoji: "🔥", label: t(lang, "filterPopular") },
    { key: "estrella",    emoji: "⭐", label: t(lang, "filterRecommended") },
    { key: "veggie",      emoji: "🌿", label: t(lang, "filterVeggie") },
    { key: "gluten-free", emoji: "🌾", label: t(lang, "filterGlutenFree" as any) },
  ];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: compact ? 6 : 8 }}>
      {compact && (
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
          color: glass ? "rgba(255,255,255,0.45)" : "var(--carta-text-muted)", flexShrink: 0, textTransform: "uppercase",
        }}>
          {t(lang, "filters")}
        </span>
      )}
      <div style={{
        display: "flex", gap: compact ? 5 : 7, flex: 1,
        overflowX: "auto", scrollbarWidth: "none",
      }}>
        {FILTERS.map((f) => {
          const isActive = active.includes(f.key);
          const activeColor = f.key === "popular" ? "#ef4444" : f.key === "veggie" ? "#16a34a" : f.key === "gluten-free" ? "#ca8a04" : "var(--carta-accent)";
          return (
            <button
              key={f.key}
              onClick={() => onToggle(f.key)}
              className="font-[family-name:var(--font-dm)]"
              style={{
                flexShrink: 0,
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
                      ? (glass ? "rgba(239,68,68,0.2)" : "color-mix(in srgb, #ef4444 12%, var(--carta-bg))")
                      : f.key === "veggie"
                        ? (glass ? "rgba(22,163,74,0.2)" : "color-mix(in srgb, #16a34a 12%, var(--carta-bg))")
                        : f.key === "gluten-free"
                          ? (glass ? "rgba(202,138,4,0.2)" : "color-mix(in srgb, #ca8a04 12%, var(--carta-bg))")
                          : (glass ? "rgba(244,166,35,0.2)" : "color-mix(in srgb, var(--carta-accent) 13%, var(--carta-bg))"))
                  : (glass ? "rgba(255,255,255,0.08)" : "color-mix(in srgb, var(--carta-text) 6%, var(--carta-bg))"),
                border: isActive
                  ? (f.key === "popular"
                      ? "1px solid rgba(239,68,68,0.45)"
                      : f.key === "veggie"
                        ? "1px solid rgba(22,163,74,0.45)"
                        : f.key === "gluten-free"
                          ? "1px solid rgba(202,138,4,0.45)"
                          : "1px solid color-mix(in srgb, var(--carta-accent) 50%, transparent)")
                  : (glass ? "1px solid rgba(255,255,255,0.18)" : "1px solid color-mix(in srgb, var(--carta-text) 10%, transparent)"),
                color: isActive
                  ? activeColor
                  : (glass ? "rgba(255,255,255,0.65)" : "var(--carta-text-muted)"),
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

/** Apply multiple filters to a dish array (AND logic). Returns a new array. */
export function applyCartaFilter<D extends {
  tags?: string[];
  price: number;
  discountPrice?: number | null;
  id: string;
  categoryId: string;
  isActive?: boolean;
  dishDiet?: string | null;
}>(dishes: D[], filters: CartaFilterKey[], popularDishIds: Set<string>): D[] {
  if (!filters.length) return dishes;
  let result = dishes;
  if (filters.includes("popular"))     result = result.filter(d => popularDishIds.has(d.id));
  if (filters.includes("estrella"))    result = result.filter(d => (d as any).tags?.includes("RECOMMENDED"));
  if (filters.includes("veggie"))      result = result.filter(d => (d as any).dishDiet === "VEGAN" || (d as any).dishDiet === "VEGETARIAN");
  if (filters.includes("gluten-free")) result = result.filter(d => (d as any).isGlutenFree === true);
  return result;
}
