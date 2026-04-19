"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import type { Restaurant, Dish } from "@prisma/client";
import { User } from "lucide-react";

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80";

interface QRUserData {
  id: string;
  name: string | null;
  email: string;
}

interface HeroDishProps {
  restaurant: Pick<Restaurant, "name" | "logoUrl" | "bannerUrl"> & { id: string };
  heroDishes: Dish[];
  qrUser?: QRUserData | null;
  onProfileOpen?: () => void;
  onDishSelect?: (dish: Dish) => void;
  viewSelectorSlot?: React.ReactNode;
}

function isReal(url: string | null | undefined): boolean {
  return !!url && !url.includes("picsum");
}

export default function HeroDish({ restaurant, heroDishes, qrUser, onProfileOpen, onDishSelect, viewSelectorSlot }: HeroDishProps) {
  const [current, setCurrent] = useState(0);

  const logoSrc = isReal(restaurant.logoUrl) ? restaurant.logoUrl! : null;
  const initial = restaurant.name.charAt(0).toUpperCase();
  const hasSlides = heroDishes.length > 0;
  const dish = hasSlides ? heroDishes[current] : null;

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

  const scrollToDish = useCallback((dishId: string) => {
    // Find the card wrapper in the scroll sections
    const allCards = document.querySelectorAll(`[data-dish-id="${dishId}"]`);
    if (allCards.length > 0) {
      const card = allCards[0] as HTMLElement;
      const navHeight = 44;
      const top = card.getBoundingClientRect().top + window.scrollY - navHeight - 20;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, []);

  const desc = dish?.description || "";
  const shortDesc = desc.length > 65 ? desc.slice(0, 65) + "..." : desc;

  return (
    <>
      <style>{`
        @keyframes subtlePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.3); }
          50% { box-shadow: 0 0 0 6px rgba(255,255,255,0); }
        }
      `}</style>

      <section
        className="relative w-full overflow-hidden"
        style={{ height: "70vh", maxHeight: "60vh" }}
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

        {/* Overlay 1: subtle darkening */}
        <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.2)" }} />

        {/* Overlay 2: gradient bottom heavy */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, transparent 35%, rgba(0,0,0,0.6) 100%)",
          }}
        />

        {/* Top left: logo + name */}
        <div className="absolute z-10 flex items-center gap-2" style={{ top: 12, left: 16, height: 44 }}>
          {logoSrc ? (
            <Image src={logoSrc} alt={restaurant.name} width={30} height={30} className="rounded-full" style={{ border: "none" }} />
          ) : (
            <div className="flex items-center justify-center rounded-full" style={{ width: 30, height: 30, background: "#F4A623", fontSize: "0.8rem", fontWeight: 700, color: "#0e0e0e" }}>
              {initial}
            </div>
          )}
          <span className="text-white font-[family-name:var(--font-dm)]" style={{ fontSize: "1.3rem", fontWeight: 600, textShadow: "0 1px 4px rgba(0,0,0,0.4)", opacity: 0.9 }}>
            {restaurant.name}
          </span>
        </div>

        {/* Top right: profile icon */}
        <button
          onClick={onProfileOpen}
          className="absolute z-10 flex items-center justify-center"
          style={{
            top: 12, right: 16,
            width: 40, height: 40, borderRadius: "50%",
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          {qrUser?.name ? (
            <span style={{ color: "rgba(255,255,255,0.9)", fontSize: "14px", fontWeight: 700, fontFamily: "var(--font-dm)" }}>
              {qrUser.name.charAt(0).toUpperCase()}
            </span>
          ) : (
            <User size={16} color="rgba(255,255,255,0.7)" />
          )}
        </button>

        {/* Badges */}
        {dish && (
          <div className="absolute z-10 flex flex-col items-end gap-2" style={{ top: 60, right: 16 }}>
            {dish.stockCountdown != null && dish.stockCountdown > 0 && (
              <span
                className="font-[family-name:var(--font-dm)]"
                style={{
                  background: "rgba(0,0,0,0.55)",
                  backdropFilter: "blur(4px)",
                  WebkitBackdropFilter: "blur(4px)",
                  color: "white",
                  fontSize: "0.62rem",
                  fontWeight: 600,
                  padding: "3px 8px",
                  borderRadius: 6,
                }}
              >
                🔥 Solo quedan {dish.stockCountdown}
              </span>
            )}
          </div>
        )}

        {/* Center content */}
        <div
          className="absolute z-10 flex flex-col items-center justify-center"
          style={{ inset: "60px 20px 20px" }}
        >
          {dish ? (
            <>
              {/* Dish name centered */}
              <h1
                className="font-[family-name:var(--font-playfair)] text-white text-center"
                style={{
                  fontSize: "2.4rem",
                  fontWeight: 900,
                  lineHeight: 1.1,
                  textShadow: "0 2px 8px rgba(0,0,0,0.5)",
                }}
              >
                {dish.name}
              </h1>

              {/* Short description */}
              {shortDesc && (
                <p
                  className="font-[family-name:var(--font-dm)] text-center line-clamp-2"
                  style={{
                    color: "rgba(255,255,255,0.75)",
                    fontSize: "1.2rem",
                    lineHeight: 1.45,
                    marginTop: 8,
                    maxWidth: 300,
                  }}
                >
                  {shortDesc}
                </p>
              )}

              {/* CTA button */}
              <button
                onClick={() => onDishSelect?.(dish)}
                className="font-[family-name:var(--font-dm)] active:scale-95 transition-transform"
                style={{
                  marginTop: 12,
                  background: "transparent",
                  color: "white",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  padding: "5px 22px",
                  borderRadius: 50,
                  border: "2px solid rgba(255,255,255,0.5)",
                }}
              >
                Ver plato
              </button>

              {/* Carousel dots */}
              {heroDishes.length > 1 && (
                <div className="flex" style={{ gap: 6, marginTop: 14 }}>
                  {heroDishes.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrent(i)}
                      style={{
                        width: i === current ? 18 : 6,
                        height: 6,
                        borderRadius: 3,
                        background: i === current ? "white" : "rgba(255,255,255,0.4)",
                        border: "none",
                        padding: 0,
                        transition: "all 0.3s ease",
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <h1
              className="font-[family-name:var(--font-playfair)] text-white text-center"
              style={{
                fontSize: "2rem",
                fontWeight: 900,
                lineHeight: 1.1,
                textShadow: "0 2px 8px rgba(0,0,0,0.5)",
              }}
            >
              {restaurant.name}
            </h1>
          )}
        </div>

      </section>
      <style>{`@keyframes heroKenBurns { 0% { transform: scale(1); } 100% { transform: scale(1.08); } }`}</style>
    </>
  );
}
