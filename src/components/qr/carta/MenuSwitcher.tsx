"use client";

import { useState } from "react";

interface MenuGroupRef {
  slug: string;
  name: string;
}

interface Props {
  menuGroups: MenuGroupRef[];
  activeMenuSlug: string;
  accentColor?: string;
}

export default function MenuSwitcher({ menuGroups, activeMenuSlug, accentColor }: Props) {
  const [open, setOpen] = useState(false);
  const accent = accentColor || "#F4A623";
  const activeName = menuGroups.find(g => g.slug === activeMenuSlug)?.name || activeMenuSlug;

  const navigate = (slug: string | null) => {
    const url = new URL(window.location.href);
    if (slug) {
      url.searchParams.set("menu", slug);
    } else {
      url.searchParams.delete("menu");
    }
    window.location.href = url.toString();
  };

  return (
    <div style={{
      position: "relative",
      background: "var(--carta-bg, #0e0e0e)",
      borderBottom: "1px solid var(--carta-border, rgba(255,255,255,0.08))",
      padding: "0 14px",
      zIndex: 20,
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        height: 44,
        gap: 8,
      }}>
        {/* Back to all menus */}
        <button
          onClick={() => navigate(null)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: accent,
            fontFamily: "var(--font-dm)",
            fontSize: "13px", fontWeight: 600,
            padding: 0,
            display: "flex", alignItems: "center", gap: 4,
            flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Menús
        </button>

        <span style={{
          color: "var(--carta-text3, rgba(255,255,255,0.3))",
          fontSize: "13px",
        }}>·</span>

        {/* Current menu name + dropdown */}
        <button
          onClick={() => setOpen(!open)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--carta-text, #fff)",
            fontFamily: "var(--font-dm)",
            fontSize: "14px", fontWeight: 700,
            padding: 0,
            display: "flex", alignItems: "center", gap: 4,
            overflow: "hidden",
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {activeName}
          </span>
          {menuGroups.length > 1 && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{
              transition: "transform 0.2s",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              flexShrink: 0,
            }}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          )}
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 19 }}
          />
          <div style={{
            position: "absolute",
            top: "100%",
            left: 14, right: 14,
            zIndex: 21,
            background: "var(--carta-card, #1a1a1a)",
            border: "1px solid var(--carta-border, rgba(255,255,255,0.1))",
            borderRadius: 14,
            boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
            padding: "6px",
            marginTop: 4,
          }}>
            {menuGroups.map(g => (
              <button
                key={g.slug}
                onClick={() => { setOpen(false); if (g.slug !== activeMenuSlug) navigate(g.slug); }}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  background: g.slug === activeMenuSlug ? `${accent}15` : "transparent",
                  border: "none",
                  borderRadius: 10,
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "var(--font-dm)",
                  fontSize: "14px",
                  fontWeight: g.slug === activeMenuSlug ? 700 : 500,
                  color: g.slug === activeMenuSlug ? accent : "var(--carta-text, #fff)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {g.slug === activeMenuSlug && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {g.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
