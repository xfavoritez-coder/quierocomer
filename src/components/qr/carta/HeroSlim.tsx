"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import type { Restaurant, Dish } from "@prisma/client";
import { trackHeroClick } from "./utils/cartaAnalytics";

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80";

function isReal(url: string | null | undefined): boolean {
  return !!url && !url.includes("picsum");
}

interface HeroSlimProps {
  restaurant: Pick<Restaurant, "name" | "logoUrl" | "bannerUrl"> & { id: string };
  heroDishes: Dish[];
  onDishSelect?: (dish: Dish) => void;
}

export default function HeroSlim({ restaurant, heroDishes, onDishSelect }: HeroSlimProps) {
  const [current, setCurrent] = useState(0);
  const hasSlides = heroDishes.length > 0;
  const dish = hasSlides ? heroDishes[current] : null;

  const logoSrc = isReal(restaurant.logoUrl) ? restaurant.logoUrl! : null;
  const initial = restaurant.name.charAt(0).toUpperCase();

  const bgSrc = dish
    ? isReal(dish.photos?.[0])
      ? dish.photos[0]
      : FALLBACK_IMG
    : isReal(restaurant.bannerUrl)
      ? restaurant.bannerUrl!
      : FALLBACK_IMG;

  // Auto-rotate every 5s
  useEffect(() => {
    if (heroDishes.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % heroDishes.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [heroDishes.length]);

  // Swipe
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) =>
    setTouchStart(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0)
        setCurrent((c) => (c + 1) % heroDishes.length);
      else
        setCurrent((c) => (c - 1 + heroDishes.length) % heroDishes.length);
    }
    setTouchStart(null);
  };

  const handleClick = () => {
    if (!dish) return;
    trackHeroClick(restaurant.id, dish.id, "lista");
    onDishSelect?.(dish);
  };

  return (
    <>
      <style>{`@keyframes heroKenBurns { 0% { transform: scale(1); } 100% { transform: scale(1.08); } }`}</style>
      <section
        className="relative w-full overflow-hidden"
        style={{ height: "32vh", maxHeight: "260px", cursor: dish ? "pointer" : undefined }}
        onClick={handleClick}
        onTouchStart={hasSlides ? handleTouchStart : undefined}
        onTouchEnd={hasSlides ? handleTouchEnd : undefined}
      >
        {/* Background image */}
        <Image
          src={bgSrc}
          alt={dish?.name || restaurant.name}
          fill
          className="object-cover object-center"
          priority
          sizes="100vw"
          key={bgSrc}
          style={{ animation: "heroKenBurns 12s ease-in-out infinite alternate" }}
        />

        {/* Lateral gradient */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)",
          }}
        />

        {/* Top left: logo + name */}
        <button
          onClick={(e) => { e.stopPropagation(); window.location.reload(); }}
          className="absolute z-10 flex items-center gap-2"
          style={{ top: 10, left: 14, height: 36, background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          {logoSrc ? (
            <Image src={logoSrc} alt={restaurant.name} width={24} height={24} className="rounded-full" style={{ border: "none" }} />
          ) : (
            <div
              className="flex items-center justify-center rounded-full"
              style={{ width: 24, height: 24, background: "#F4A623", fontSize: "0.65rem", fontWeight: 700, color: "#0e0e0e" }}
            >
              {initial}
            </div>
          )}
          <span
            className="text-white font-[family-name:var(--font-dm)]"
            style={{ fontSize: "1rem", fontWeight: 400, textShadow: "0 1px 3px rgba(0,0,0,0.4)", opacity: 0.85 }}
          >
            {restaurant.name}
          </span>
        </button>

        {/* Left-aligned content */}
        {dish && (
          <div className="absolute z-10" style={{ bottom: 20, left: 16, right: "30%" }}>
            <h2
              className="font-[family-name:var(--font-playfair)] text-white"
              style={{
                fontSize: "1.3rem",
                fontWeight: 800,
                lineHeight: 1.15,
                textShadow: "0 2px 6px rgba(0,0,0,0.5)",
                margin: 0,
              }}
            >
              {dish.name}
            </h2>
            {dish.description && (
              <p
                className="font-[family-name:var(--font-dm)] line-clamp-2"
                style={{
                  color: "rgba(255,255,255,0.75)",
                  fontSize: "0.94rem",
                  marginTop: 6,
                  lineHeight: 1.4,
                }}
              >
                {dish.description}
              </p>
            )}
          </div>
        )}

        {/* Swipe hint dots + progress bar */}
        {heroDishes.length > 1 && (
          <div className="absolute z-10" style={{ bottom: 10, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 5 }}>
            {heroDishes.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === current ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: i === current ? "#F4A623" : "rgba(255,255,255,0.4)",
                  transition: "all 0.35s ease",
                }}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
