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
  restaurant: Pick<Restaurant, "name" | "logoUrl" | "bannerUrl" | "instagram" | "website" | "whatsapp"> & { id: string };
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
            <Image src={logoSrc} alt={restaurant.name} width={25} height={25} className="rounded-full" style={{ border: "none" }} />
          ) : (
            <div
              className="flex items-center justify-center rounded-full"
              style={{ width: 25, height: 25, background: "#F4A623", fontSize: "0.65rem", fontWeight: 700, color: "#0e0e0e" }}
            >
              {initial}
            </div>
          )}
          <span
            className="text-white font-[family-name:var(--font-dm)]"
            style={{ fontSize: "1.12rem", fontWeight: 400, textShadow: "0 1px 3px rgba(0,0,0,0.4)", opacity: 0.85 }}
          >
            {restaurant.name}
          </span>
        </button>

        {/* Social icons */}
        {(restaurant.instagram || restaurant.website || restaurant.whatsapp) && (
          <div className="absolute z-10 flex items-center gap-1.5" style={{ top: 10, right: 14 }}>
            {restaurant.instagram && (
              <a href={`https://instagram.com/${restaurant.instagram}`} target="_blank" rel="noopener noreferrer" style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
              </a>
            )}
            {restaurant.whatsapp && (
              <a href={`https://wa.me/${restaurant.whatsapp.replace(/[^0-9+]/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
              </a>
            )}
            {restaurant.website && (
              <a href={restaurant.website.startsWith("http") ? restaurant.website : `https://${restaurant.website}`} target="_blank" rel="noopener noreferrer" style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              </a>
            )}
          </div>
        )}

        {/* Left-aligned content */}
        {dish && (
          <div className="absolute z-10" style={{ bottom: 28, left: 16, right: "30%" }}>
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
