"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Category, Dish } from "@prisma/client";
import { useLang } from "@/contexts/LangContext";
import { t } from "@/lib/qr/i18n";

interface Props {
  categories: Category[];
  dishes: Dish[];
  restaurantName: string;
  logoUrl?: string | null;
  accentColor?: string;
  featuredPromoDishIds?: string[];
  onSelectCategory: (categoryId: string) => void;
  onSkip: () => void;
}

/** Returns true if a hex color is "light" (luminance > 0.55) */
function isLightColor(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  // Perceived luminance
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.55;
}

function FeaturedHero({ dishes, accent, onSelect }: { dishes: Dish[]; accent: string; onSelect: (catId: string) => void }) {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef(0);
  const touchWasSwipe = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (dishes.length <= 1) return;
    timerRef.current = setTimeout(() => {
      setCurrent(c => (c + 1) % dishes.length);
    }, 4500);
  }, [dishes.length]);

  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [current, resetTimer]);

  const d = dishes[current];
  const accentIsLight = isLightColor(accent);
  // Badge: if accent is light use dark bg+text for legibility
  const badgeBg = accentIsLight ? "rgba(0,0,0,0.6)" : accent;
  const badgeColor = "#fff";
  // Price: if accent is light on dark overlay, use white instead
  const priceColor = accentIsLight ? "#fff" : (accent === "#F4A623" ? "#FFD580" : accent);

  return (
    <div style={{ padding: "0 14px 20px" }}>
      <div
        onClick={() => { if (!touchWasSwipe.current) onSelect(d.categoryId); touchWasSwipe.current = false; }}
        onTouchStart={e => { touchStartX.current = e.touches[0].clientX; touchWasSwipe.current = false; }}
        onTouchEnd={e => {
          const diff = e.changedTouches[0].clientX - touchStartX.current;
          if (Math.abs(diff) > 48) {
            touchWasSwipe.current = true;
            const next = diff < 0
              ? (current + 1) % dishes.length
              : (current - 1 + dishes.length) % dishes.length;
            setCurrent(next);
            resetTimer();
          }
        }}
        style={{
          position: "relative", borderRadius: 20, overflow: "hidden",
          height: "52vw", maxHeight: 260, minHeight: 180,
          cursor: "pointer",
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
        }}
      >
        {/* Photos — cross-fade */}
        {dishes.map((dish, i) => (
          <div key={dish.id} style={{
            position: "absolute", inset: 0, zIndex: 1,
            opacity: i === current ? 1 : 0,
            transition: "opacity 0.7s ease",
          }}>
            {dish.photos[0] ? (
              <img
                src={dish.photos[0]}
                alt={dish.name}
                loading={i === 0 ? "eager" : "lazy"}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${accent}30, ${accent}10)` }} />
            )}
          </div>
        ))}

        {/* Gradient overlay */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 2,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.18) 35%, rgba(0,0,0,0.75) 80%, rgba(0,0,0,0.88) 100%)",
        }} />

        {/* Badge top-left */}
        <div style={{
          position: "absolute", top: 14, left: 14, zIndex: 3,
          display: "inline-flex", alignItems: "center", gap: 5,
          background: badgeBg,
          backdropFilter: accentIsLight ? "blur(6px)" : undefined,
          color: badgeColor,
          fontSize: "10px", fontWeight: 900, letterSpacing: "0.5px",
          textTransform: "uppercase",
          padding: "5px 11px", borderRadius: 999,
          fontFamily: "var(--font-dm)",
        }}>
          ★ Destacado
        </div>

        {/* Content bottom */}
        <div style={{ position: "absolute", left: 16, right: 16, bottom: 14, zIndex: 3 }}>
          <p style={{
            margin: "0 0 4px",
            fontFamily: "var(--font-dm)",
            fontSize: "20px", fontWeight: 800, lineHeight: 1.15,
            color: "#fff",
            textShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}>
            {d.name}
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{
              fontFamily: "var(--font-dm)",
              fontSize: "15px", fontWeight: 800,
              color: priceColor,
            }}>
              ${Math.round((d.discountPrice ?? d.price) || 0).toLocaleString("es-CL")}
            </span>
            {/* Dots */}
            {dishes.length > 1 && (
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                {dishes.map((_, i) => (
                  <div key={i} style={{
                    width: i === current ? 14 : 5, height: 5, borderRadius: 3,
                    background: i === current ? "#fff" : "rgba(255,255,255,0.4)",
                    transition: "all 0.3s ease",
                  }} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CategoryLobby({ categories, dishes, restaurantName, logoUrl, accentColor, featuredPromoDishIds, onSelectCategory, onSkip }: Props) {
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const accent = accentColor || "#F4A623";
  const lang = useLang();

  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    const container = document.querySelector(".carta-dark, .carta-light");
    setIsDark(container?.classList.contains("carta-dark") ?? true);
    if (!container) return;
    const obs = new MutationObserver(() => {
      setIsDark(container.classList.contains("carta-dark"));
    });
    obs.observe(container, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  // Featured dishes: isHero (★ Recomendado) OR in a "featured" promotion — must have photo, no duplicates
  const promoFeaturedSet = new Set(featuredPromoDishIds || []);
  const seenIds = new Set<string>();
  const featuredDishes = dishes.filter(d => {
    if (!d.photos?.length || seenIds.has(d.id)) return false;
    if (d.isHero === true || promoFeaturedSet.has(d.id)) {
      seenIds.add(d.id);
      return true;
    }
    return false;
  });

  // Only show active categories with active dishes
  const visibleCategories = categories
    .filter(c => c.isActive)
    .map(c => {
      const catDishes = dishes.filter(d => d.categoryId === c.id && d.isActive);
      const coverPhoto = catDishes.find(d => d.photos?.length > 0)?.photos[0] || null;
      return { ...c, dishCount: catDishes.length, coverPhoto };
    })
    .filter(c => c.dishCount > 0);

  if (visibleCategories.length < 3) return null; // Not enough categories to justify a lobby

  return (
    <div style={{
      minHeight: "100dvh",
      background: "var(--carta-bg, #0e0e0e)",
      padding: "0 0 40px",
    }}>
      {/* Header with hero background */}
      {(() => {
        const heroPhoto = visibleCategories.find(c => c.coverPhoto)?.coverPhoto;
        return (
          <div style={{ position: "relative", overflow: "hidden", marginBottom: 8 }}>
            {/* Background image with blur */}
            {heroPhoto && (
              <div style={{ position: "absolute", inset: -20, filter: "blur(20px) saturate(1.2)", transform: "scale(1.1)" }}>
                <img src={heroPhoto} alt="" loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: isDark ? 0.4 : 0.5 }} />
              </div>
            )}
            <div style={{
              position: "absolute", inset: 0,
              background: heroPhoto
                ? isDark
                  ? "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 60%, var(--carta-bg, #0e0e0e) 100%)"
                  : "linear-gradient(to bottom, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.5) 60%, var(--carta-bg, #faf9f6) 100%)"
                : `linear-gradient(135deg, ${accent}15 0%, transparent 60%)`,
            }} />
            <div style={{ position: "relative", zIndex: 2, padding: "36px 20px 28px", textAlign: "center" }}>
              {logoUrl && (
                <div style={{
                  width: 68, height: 68, borderRadius: "50%", overflow: "hidden",
                  margin: "0 auto 16px",
                  border: isDark ? "3px solid rgba(255,255,255,0.2)" : "3px solid rgba(0,0,0,0.1)",
                  boxShadow: isDark ? "0 4px 24px rgba(0,0,0,0.4)" : "0 4px 24px rgba(0,0,0,0.12)",
                }}>
                  <img src={logoUrl} alt="" loading="lazy" style={{ width: 68, height: 68, objectFit: "cover" }} />
                </div>
              )}
              <h1 style={{
                fontFamily: "var(--font-dm)",
                fontSize: "26px", fontWeight: 800,
                color: isDark ? "#fff" : "var(--carta-text, #0e0e0e)",
                margin: "0 0 6px", letterSpacing: "-0.3px",
                textShadow: isDark ? "0 2px 12px rgba(0,0,0,0.5)" : "none",
              }}>
                {restaurantName}
              </h1>
              <p style={{
                fontFamily: "var(--font-dm)",
                fontSize: "13px",
                color: isDark ? "rgba(255,255,255,0.55)" : "var(--carta-text3, #999)",
                margin: 0, fontWeight: 500, letterSpacing: "0.8px",
                textTransform: "uppercase",
              }}>
                {t(lang, "ourMenu" as any)}
              </p>
            </div>
          </div>
        );
      })()}

      {/* Featured hero slider */}
      {featuredDishes.length > 0 && (
        <FeaturedHero dishes={featuredDishes} accent={accent} onSelect={onSelectCategory} />
      )}

      {/* Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
        padding: "0 14px",
      }}>
        {visibleCategories.map((cat) => {
          const hasCover = !!(cat.coverPhoto && !failedImages.has(cat.id));
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              style={{
                position: "relative",
                height: 140,
                borderRadius: 16,
                overflow: "hidden",
                border: "none",
                cursor: "pointer",
                background: isDark ? "#1a1a1a" : "#f0ede6",
                textAlign: "left",
              }}
            >
              {/* Cover photo */}
              {cat.coverPhoto && !failedImages.has(cat.id) ? (
                <img
                  src={cat.coverPhoto}
                  alt={cat.name}
                  loading="lazy"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                  onError={() => setFailedImages(prev => new Set(prev).add(cat.id))}
                />
              ) : null}
              {/* Overlay */}
              <div style={{
                position: "absolute", inset: 0,
                background: cat.coverPhoto && !failedImages.has(cat.id)
                  ? isDark
                    ? "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.15) 100%)"
                    : "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.05) 100%)"
                  : `linear-gradient(135deg, ${accent}15 0%, ${accent}08 100%)`,
              }} />
              {/* Text */}
              <div style={{
                position: "absolute", left: 14, right: 14, bottom: 14, zIndex: 2,
              }}>
                <p style={{
                  margin: "0 0 3px",
                  fontFamily: "var(--font-dm)",
                  fontSize: "16px",
                  fontWeight: 700,
                  color: hasCover ? "#fff" : isDark ? "#fff" : "var(--carta-text, #0e0e0e)",
                  lineHeight: 1.15,
                  textShadow: hasCover ? "0 2px 8px rgba(0,0,0,0.5)" : "none",
                }}>
                  {cat.name}
                </p>
                <span style={{
                  fontFamily: "var(--font-dm)",
                  fontSize: "13px",
                  color: hasCover ? "rgba(255,255,255,0.6)" : isDark ? "rgba(255,255,255,0.5)" : "var(--carta-text3, #999)",
                  fontWeight: 500,
                }}>
                  {cat.dishCount} {cat.dishCount === 1 ? "producto" : "productos"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Ver carta completa */}
      <div style={{ textAlign: "center", marginTop: 28, padding: "0 20px" }}>
        <button
          onClick={onSkip}
          style={{
            width: "100%",
            padding: "14px 24px",
            borderRadius: 999,
            border: `1.5px solid ${accent}40`,
            background: `${accent}10`,
            color: accent,
            fontSize: "0.88rem",
            fontWeight: 700,
            fontFamily: "var(--font-dm)",
            cursor: "pointer",
            letterSpacing: "0.3px",
          }}
        >
          Ver carta completa
        </button>
      </div>
    </div>
  );
}
