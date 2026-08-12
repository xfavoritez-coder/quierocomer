"use client";

import { useState, useEffect } from "react";
import type { Category, Dish } from "@prisma/client";
import { useLang } from "@/contexts/LangContext";
import { t } from "@/lib/qr/i18n";

interface Props {
  categories: Category[];
  dishes: Dish[];
  restaurantName: string;
  logoUrl?: string | null;
  accentColor?: string;
  onSelectCategory: (categoryId: string) => void;
  onSkip: () => void;
}

export default function CategoryLobby({ categories, dishes, restaurantName, logoUrl, accentColor, onSelectCategory, onSkip }: Props) {
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

      {/* Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
        padding: "0 14px",
      }}>
        {visibleCategories.map((cat, i) => {
          const isWide = i === 0; // First item full width
          const hasCover = !!(cat.coverPhoto && !failedImages.has(cat.id));
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              style={{
                position: "relative",
                gridColumn: isWide ? "1 / -1" : undefined,
                height: isWide ? 180 : 140,
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
                  fontSize: isWide ? "20px" : "16px",
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
