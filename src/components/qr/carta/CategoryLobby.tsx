"use client";

import { useState } from "react";
import type { Category, Dish } from "@prisma/client";
import Image from "next/image";

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
                <Image src={heroPhoto} alt="" fill className="object-cover" style={{ opacity: 0.4 }} />
              </div>
            )}
            <div style={{
              position: "absolute", inset: 0,
              background: heroPhoto
                ? "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 60%, var(--carta-bg, #0e0e0e) 100%)"
                : `linear-gradient(135deg, ${accent}15 0%, transparent 60%)`,
            }} />
            <div style={{ position: "relative", zIndex: 2, padding: "36px 20px 28px", textAlign: "center" }}>
              {logoUrl && (
                <div style={{
                  width: 68, height: 68, borderRadius: "50%", overflow: "hidden",
                  margin: "0 auto 16px", border: "3px solid rgba(255,255,255,0.2)",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
                }}>
                  <Image src={logoUrl} alt="" width={68} height={68} className="object-cover" />
                </div>
              )}
              <h1 style={{
                fontFamily: "var(--font-dm)",
                fontSize: "26px", fontWeight: 800,
                color: "#fff",
                margin: "0 0 6px", letterSpacing: "-0.3px",
                textShadow: "0 2px 12px rgba(0,0,0,0.5)",
              }}>
                {restaurantName}
              </h1>
              <p style={{
                fontSize: "13px", color: "rgba(255,255,255,0.55)",
                margin: 0, fontWeight: 500, letterSpacing: "0.8px",
                textTransform: "uppercase",
              }}>
                Nuestra carta
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
                background: "#1a1a1a",
                textAlign: "left",
              }}
            >
              {/* Cover photo */}
              {cat.coverPhoto && !failedImages.has(cat.id) ? (
                <Image
                  src={cat.coverPhoto}
                  alt={cat.name}
                  fill
                  sizes={isWide ? "100vw" : "50vw"}
                  className="object-cover"
                  onError={() => setFailedImages(prev => new Set(prev).add(cat.id))}
                />
              ) : null}
              {/* Overlay */}
              <div style={{
                position: "absolute", inset: 0,
                background: cat.coverPhoto && !failedImages.has(cat.id)
                  ? "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.15) 100%)"
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
                  color: "#fff",
                  lineHeight: 1.15,
                  textShadow: "0 2px 8px rgba(0,0,0,0.5)",
                }}>
                  {cat.name}
                </p>
                <span style={{
                  fontSize: "11px",
                  color: "rgba(255,255,255,0.55)",
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
            fontFamily: "var(--font-display)",
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
