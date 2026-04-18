"use client";

import { useRef, useEffect } from "react";
import type { Category } from "@prisma/client";

interface CategoryNavProps {
  categories: Category[];
  activeCategory: string;
  onCategoryChange: (id: string) => void;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export default function CategoryNav({
  categories,
  activeCategory,
  onCategoryChange,
  leftSlot,
  rightSlot,
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
      const navHeight = 44;
      const top = section.getBoundingClientRect().top + window.scrollY - navHeight;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <nav
      className="sticky top-0 z-40"
      style={{ position: "sticky", top: 0, background: "#ffffff", borderBottom: "1px solid #f0f0f0", height: 44, WebkitBackfaceVisibility: "hidden", display: "flex", alignItems: "center" }}
    >
      {leftSlot && (
        <div style={{ flexShrink: 0, paddingLeft: 12 }}>
          {leftSlot}
        </div>
      )}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto"
        style={{
          flex: 1,
          height: "100%",
          paddingLeft: leftSlot ? 8 : 16,
          paddingRight: rightSlot ? 8 : 16,
          gap: 24,
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
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
                height: "100%",
                display: "flex",
                alignItems: "center",
                padding: "0 2px",
                fontSize: "0.95rem",
                fontWeight: isActive ? 700 : 500,
                color: isActive ? "#0e0e0e" : "#999",
                background: "none",
                border: "none",
                borderBottom: isActive ? "2px solid #F4A623" : "2px solid transparent",
                transition: "color 0.15s ease, border-color 0.15s ease",
                cursor: "pointer",
              }}
            >
              {cat.name}
            </button>
          );
        })}
      </div>
      {rightSlot && (
        <div style={{ flexShrink: 0, paddingRight: 12 }}>
          {rightSlot}
        </div>
      )}
    </nav>
  );
}
