"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Restaurant, Dish } from "@prisma/client";
import { User, Search } from "lucide-react";
import { trackHeroClick } from "./utils/cartaAnalytics";
import LangSelector from "./LangSelector";
import { useLang } from "@/contexts/LangContext";
import { t } from "@/lib/qr/i18n";
import DishPlaceholderIcon from "./DishPlaceholderIcon";

interface QRUserData {
  id: string;
  name: string | null;
  email: string;
}


interface HeroDishProps {
  restaurant: Pick<Restaurant, "name" | "logoUrl" | "bannerUrl" | "instagram" | "website" | "whatsapp"> & { id: string };
  heroDishes: Dish[];
  qrUser?: QRUserData | null;
  onProfileOpen?: () => void;
  onDishSelect?: (dish: Dish) => void;
  enabledLangs?: string[];
  variant?: "full" | "compact";
  onSearchClick?: () => void;
  /** Slot rendered between the top nav bar and the hero image (e.g. announcement banner). */
  belowNavSlot?: React.ReactNode;
  /** Hace que el nav bar quede sticky al top (visible mientras scrolleas) */
  stickyNav?: boolean;
  /** Ref para medir el alto del nav bar desde el componente padre */
  navRef?: React.RefObject<HTMLDivElement | null>;
  /** Si el restaurante tiene pedidos online activos, muestra ícono de carrito verde */
  orderingEnabled?: boolean;
  restaurantSlug?: string;
}

function isReal(url: string | null | undefined): boolean {
  return !!url && !url.includes("picsum");
}

export default function HeroDish({ restaurant, heroDishes, qrUser, onProfileOpen, onDishSelect, enabledLangs, variant = "full", onSearchClick, belowNavSlot, stickyNav, navRef, orderingEnabled, restaurantSlug }: HeroDishProps) {
  const lang = useLang();
  const isCompact = variant === "compact";
  const [current, setCurrent] = useState(0);

  const logoSrc = isReal(restaurant.logoUrl) ? restaurant.logoUrl! : null;
  const initial = restaurant.name.charAt(0).toUpperCase();
  const hasSlides = heroDishes.length > 0;
  const dish = hasSlides ? heroDishes[current] : null;

  const rawBg = dish
    ? isReal(dish.photos?.[0])
      ? dish.photos[0]
      : null
    : isReal(restaurant.bannerUrl)
      ? restaurant.bannerUrl!
      : null;
  const bgSrc = rawBg
    ? rawBg.includes("images.unsplash.com")
      ? rawBg.split("?")[0] + "?w=1200&q=85&fm=webp&fit=crop&crop=entropy&auto=compress"
      : rawBg
    : null;

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

      {/* Nav bar — logo + name left, social + lang right */}
      <div ref={navRef} className="w-full flex items-center justify-between" style={{ background: "var(--carta-nav-bg, var(--carta-bg-solid, #1a1a1a))", borderBottom: "1px solid var(--carta-border)", padding: "10px 16px", zIndex: 50, position: stickyNav ? "sticky" : "relative", top: stickyNav ? 0 : undefined }}>
        <button onClick={() => window.location.reload()} className="flex items-center gap-2" style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          {logoSrc ? (
            <img src={logoSrc} alt={restaurant.name} loading="lazy" style={{ width: 28, height: 28, borderRadius: "50%", border: "none" }} />
          ) : (
            <div className="flex items-center justify-center rounded-full" style={{ width: 28, height: 28, background: "var(--carta-accent, #F4A623)", fontSize: "0.7rem", fontWeight: 700, color: "#0e0e0e" }}>
              {initial}
            </div>
          )}
          <span className="font-[family-name:var(--font-dm)]" style={{ fontSize: "1.05rem", fontWeight: 500, color: "var(--carta-text)" }}>
            {restaurant.name}
          </span>
        </button>
        <div className="flex items-center" style={{ gap: 8 }}>
          {onSearchClick && (
            <button
              onClick={onSearchClick}
              style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--carta-search-bg)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}
              aria-label="Buscar"
            >
              <Search size={18} color="var(--carta-text2)" />
            </button>
          )}
          {orderingEnabled && restaurantSlug && (
            <a
              href={`/pedir/${restaurantSlug}`}
              aria-label="Pedir online"
              style={{
                width: 42, height: 42, borderRadius: "50%",
                background: "#25D366",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, textDecoration: "none",
                boxShadow: "0 2px 8px rgba(37,211,102,0.4)",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="9" cy="21" r="1" fill="#fff"/>
                <circle cx="20" cy="21" r="1" fill="#fff"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          )}
          <LangSelector enabledLangs={enabledLangs} />
        </div>
      </div>

      {belowNavSlot}

      <section
        className="relative w-full overflow-hidden"
        style={{ height: isCompact ? "38vh" : "50vh", maxHeight: isCompact ? 300 : 400, marginTop: isCompact ? 8 : 12 }}
        onTouchStart={hasSlides ? handleTouchStart : undefined}
        onTouchEnd={hasSlides ? handleTouchEnd : undefined}
      >
        {/* Background image or gradient fallback */}
        {bgSrc ? (
          <>
            <img
              src={bgSrc}
              alt={dish?.name || restaurant.name}
              key={bgSrc}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", animation: "heroKenBurns 12s ease-in-out infinite alternate" }}
            />
            <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.2)" }} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 0%, transparent 35%, rgba(0,0,0,0.6) 100%)" }} />
          </>
        ) : (
          <div className="absolute inset-0" style={{
            background: "linear-gradient(135deg, color-mix(in srgb, var(--carta-accent, #F4A623) 18%, #1a1a2e), color-mix(in srgb, var(--carta-accent, #F4A623) 6%, #0f3460))",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <DishPlaceholderIcon size={80} opacity={0.35} />
          </div>
        )}



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
                  fontSize: isCompact ? "2rem" : "2.4rem",
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
                    fontSize: isCompact ? "1rem" : "1.2rem",
                    lineHeight: 1.45,
                    marginTop: isCompact ? 6 : 8,
                    maxWidth: 300,
                  }}
                >
                  {shortDesc}
                </p>
              )}

              {/* CTA button */}
              <button
                onClick={() => { trackHeroClick(restaurant.id, dish.id, "premium"); onDishSelect?.(dish); }}
                className="font-[family-name:var(--font-dm)] active:scale-95 transition-transform"
                style={{
                  marginTop: 12,
                  background: "transparent",
                  color: "white",
                  fontSize: "0.95rem",
                  fontWeight: 500,
                  padding: "6px 24px",
                  borderRadius: 50,
                  border: "2px solid rgba(255,255,255,0.5)",
                }}
              >
                {t(lang, "heroView" as any)}
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
                        background: i === current ? "var(--carta-accent, #F4A623)" : "color-mix(in srgb, var(--carta-accent, #F4A623) 35%, transparent)",
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
