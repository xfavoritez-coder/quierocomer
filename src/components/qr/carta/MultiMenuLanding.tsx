"use client";

import { useState, useEffect } from "react";
import type { Dish } from "@prisma/client";

interface MenuGroupData {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  categories: { id: string }[];
}

interface Props {
  menuGroups: MenuGroupData[];
  restaurantName: string;
  logoUrl?: string | null;
  accentColor?: string;
  dishes: Dish[];
  categories: { id: string; menuGroupId?: string | null }[];
}

export default function MultiMenuLanding({ menuGroups, restaurantName, logoUrl, accentColor, dishes, categories }: Props) {
  const accent = accentColor || "#F4A623";
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

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

  // For each group, find a cover photo from its categories' dishes or use fallback
  const groupsWithCover = menuGroups.map(g => {
    const catIds = new Set(g.categories.map(c => c.id));
    const groupDishes = dishes.filter(d => catIds.has(d.categoryId));
    const dishPhoto = groupDishes.find(d => d.photos?.length > 0)?.photos[0] || null;
    const coverPhoto = g.imageUrl || dishPhoto;
    return { ...g, coverPhoto };
  });

  const heroPhoto = groupsWithCover.find(g => g.coverPhoto)?.coverPhoto;

  const handleSelect = (slug: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("menu", slug);
    window.location.href = url.toString();

    // Track stat event
    fetch("/api/qr/stat-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType: "MENU_GROUP_SELECTED", metadata: { menuGroupSlug: slug } }),
      keepalive: true,
    }).catch(() => {});
  };

  return (
    <div style={{
      minHeight: "100dvh",
      background: "var(--carta-bg, #0e0e0e)",
      padding: "0 0 40px",
    }}>
      {/* Header */}
      <div style={{ position: "relative", overflow: "hidden", marginBottom: 8 }}>
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
            Nuestras cartas
          </p>
        </div>
      </div>

      {/* Menu group cards */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "0 14px",
      }}>
        {groupsWithCover.map((g) => {
          const hasCover = !!(g.coverPhoto && !failedImages.has(g.id));
          return (
            <button
              key={g.id}
              onClick={() => handleSelect(g.slug)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: 12,
                borderRadius: 16,
                overflow: "hidden",
                border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
                cursor: "pointer",
                background: isDark ? "#1a1a1a" : "#f0ede6",
                textAlign: "left",
                width: "100%",
              }}
            >
              {/* Square logo/image */}
              <div style={{
                width: 72, height: 72, borderRadius: 14, overflow: "hidden",
                flexShrink: 0,
                background: hasCover ? undefined : `linear-gradient(135deg, ${accent}30 0%, ${accent}10 100%)`,
                display: "grid", placeItems: "center",
                border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.06)",
              }}>
                {hasCover ? (
                  <img
                    src={g.coverPhoto!}
                    alt={g.name}
                    loading="lazy"
                    style={{ width: 72, height: 72, objectFit: "cover" }}
                    onError={() => setFailedImages(prev => new Set(prev).add(g.id))}
                  />
                ) : (
                  <span style={{
                    fontFamily: "var(--font-dm)",
                    fontSize: "28px", fontWeight: 800,
                    color: accent,
                    opacity: 0.6,
                  }}>
                    {g.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: "0 0 2px",
                  fontFamily: "var(--font-dm)",
                  fontSize: "18px",
                  fontWeight: 700,
                  color: isDark ? "#fff" : "var(--carta-text, #0e0e0e)",
                  lineHeight: 1.2,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {g.name}
                </p>
                {g.description && (
                  <p style={{
                    margin: 0,
                    fontFamily: "var(--font-dm)",
                    fontSize: "13px",
                    color: isDark ? "rgba(255,255,255,0.5)" : "var(--carta-text3, #999)",
                    fontWeight: 500,
                    lineHeight: 1.3,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {g.description}
                  </p>
                )}
              </div>

              {/* Arrow */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.35 }}>
                <path d="M9 6l6 6-6 6" stroke={isDark ? "#fff" : "#000"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}
