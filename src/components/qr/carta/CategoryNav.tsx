"use client";

import { useRef, useEffect } from "react";
import type { Category } from "@prisma/client";

interface CategoryNavProps {
  categories: Category[];
  activeCategory: string;
  onCategoryChange: (id: string) => void;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  stickyTop?: number;
}

export default function CategoryNav({
  categories,
  activeCategory,
  onCategoryChange,
  leftSlot,
  rightSlot,
  stickyTop = 0,
}: CategoryNavProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const el = activeRef.current;
      const offset = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
      container.scrollTo({ left: offset, behavior: "smooth" });
    }
  }, [activeCategory]);

  const handleClick = (id: string) => {
    onCategoryChange(id);
    const section = document.getElementById(`cat-${id}`);
    if (section) {
      const navHeight = 50;
      const top = section.getBoundingClientRect().top + window.scrollY - navHeight;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <nav
      data-category-nav
      className="z-40"
      style={{ position: "sticky", top: stickyTop, background: "var(--carta-glass-bg, rgba(13,13,13,0.88))", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderBottom: "1px solid var(--carta-border)", display: "flex", alignItems: "center", transform: "translateZ(0)", WebkitTransform: "translateZ(0)" }}
    >
      {leftSlot && (
        <div style={{ flexShrink: 0, paddingLeft: 12, paddingRight: 4, display: "flex", alignItems: "center" }}>
          {leftSlot}
        </div>
      )}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto"
        style={{
          flex: 1,
          paddingLeft: leftSlot ? 8 : 12,
          paddingRight: rightSlot ? 8 : 12,
          paddingTop: 8,
          paddingBottom: 8,
          gap: 6,
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
          maskImage: rightSlot ? "linear-gradient(to right, black 0%, black calc(100% - 24px), transparent 100%)" : "none",
          WebkitMaskImage: rightSlot ? "linear-gradient(to right, black 0%, black calc(100% - 24px), transparent 100%)" : "none",
        }}
      >
        {categories.map((cat) => {
          const isActive = cat.id === activeCategory;
          return (
            <button
              key={cat.id}
              ref={isActive ? activeRef : null}
              onClick={() => handleClick(cat.id)}
              className="shrink-0 font-[family-name:var(--font-dm)]"
              style={{
                whiteSpace: "nowrap",
                padding: "7px 14px",
                borderRadius: 999,
                fontSize: 14,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? "var(--carta-accent, #F4A623)" : "var(--carta-text3)",
                background: isActive ? "color-mix(in srgb, var(--carta-accent, #F4A623) 10%, transparent)" : "transparent",
                border: isActive
                  ? "1px solid color-mix(in srgb, var(--carta-accent, #F4A623) 45%, transparent)"
                  : "1px solid var(--carta-border)",
                transition: "all 0.15s ease",
                cursor: "pointer",
              }}
            >
              {cat.name}
            </button>
          );
        })}
      </div>
      {rightSlot && (
        <div style={{ flexShrink: 0, paddingRight: 12, paddingLeft: 4 }}>
          {rightSlot}
        </div>
      )}
    </nav>
  );
}
