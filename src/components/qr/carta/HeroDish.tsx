"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import type { Restaurant, Dish } from "@prisma/client";
import { User } from "lucide-react";
import { trackHeroClick } from "./utils/cartaAnalytics";
import { useLang } from "@/contexts/LangContext";
import { SUPPORTED_LANGS, type Lang } from "@/lib/qr/i18n";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80";

interface QRUserData {
  id: string;
  name: string | null;
  email: string;
}

function FlagCircle({ lang, size = 20 }: { lang: string; size?: number }) {
  const flags: Record<string, React.ReactNode> = {
    es: <svg viewBox="0 0 100 100" width={size} height={size}><clipPath id="fes"><circle cx="50" cy="50" r="50"/></clipPath><g clipPath="url(#fes)"><rect y="0" width="100" height="25" fill="#c60b1e"/><rect y="25" width="100" height="50" fill="#ffc400"/><rect y="75" width="100" height="25" fill="#c60b1e"/></g></svg>,
    en: <svg viewBox="0 0 100 100" width={size} height={size}><clipPath id="fen"><circle cx="50" cy="50" r="50"/></clipPath><g clipPath="url(#fen)"><rect width="100" height="100" fill="#002868"/><rect y="0" width="100" height="8" fill="#bf0a30"/><rect y="15" width="100" height="8" fill="white"/><rect y="30" width="100" height="8" fill="#bf0a30"/><rect y="45" width="100" height="8" fill="white"/><rect y="60" width="100" height="8" fill="#bf0a30"/><rect y="75" width="100" height="8" fill="white"/><rect y="90" width="100" height="10" fill="#bf0a30"/><rect width="45" height="55" fill="#002868"/></g></svg>,
    pt: <svg viewBox="0 0 100 100" width={size} height={size}><clipPath id="fpt"><circle cx="50" cy="50" r="50"/></clipPath><g clipPath="url(#fpt)"><rect width="100" height="100" fill="#009739"/><rect x="35" width="65" height="100" fill="#009739"/><rect width="40" height="100" fill="#002776"/><circle cx="40" cy="50" r="16" fill="#fedd00"/></g></svg>,
    it: <svg viewBox="0 0 100 100" width={size} height={size}><clipPath id="fit"><circle cx="50" cy="50" r="50"/></clipPath><g clipPath="url(#fit)"><rect x="0" width="33" height="100" fill="#009246"/><rect x="33" width="34" height="100" fill="white"/><rect x="67" width="33" height="100" fill="#ce2b37"/></g></svg>,
  };
  return <span style={{ display: "inline-flex", borderRadius: "50%", overflow: "hidden", width: size, height: size, flexShrink: 0 }}>{flags[lang] || <span style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.5, color: "white" }}>🌐</span>}</span>;
}

interface HeroDishProps {
  restaurant: Pick<Restaurant, "name" | "logoUrl" | "bannerUrl" | "instagram" | "website" | "whatsapp"> & { id: string };
  heroDishes: Dish[];
  qrUser?: QRUserData | null;
  onProfileOpen?: () => void;
  onDishSelect?: (dish: Dish) => void;
  viewSelectorSlot?: React.ReactNode;
  enabledLangs?: string[];
}

function isReal(url: string | null | undefined): boolean {
  return !!url && !url.includes("picsum");
}

export default function HeroDish({ restaurant, heroDishes, qrUser, onProfileOpen, onDishSelect, viewSelectorSlot, enabledLangs }: HeroDishProps) {
  const [current, setCurrent] = useState(0);
  const lang = useLang();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const availableLangs = enabledLangs ? SUPPORTED_LANGS.filter(l => enabledLangs.includes(l)) : [];
  const showLangSelector = availableLangs.length > 1;

  const handleLangChange = (next: Lang) => {
    localStorage.setItem("qc_lang", next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setLangOpen(false);
  };

  useEffect(() => {
    if (!langOpen) return;
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [langOpen]);

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
        style={{ height: "70vh", maxHeight: "60vh", cursor: dish ? "pointer" : undefined }}
        onClick={dish ? () => { trackHeroClick(restaurant.id, dish.id, "premium"); onDishSelect?.(dish); } : undefined}
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

        {/* Top left: logo + name — click reloads page */}
        <button onClick={() => window.location.reload()} className="absolute z-10 flex items-center gap-2" style={{ top: 12, left: 16, height: 44, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          {logoSrc ? (
            <Image src={logoSrc} alt={restaurant.name} width={30} height={30} className="rounded-full" style={{ border: "none" }} />
          ) : (
            <div className="flex items-center justify-center rounded-full" style={{ width: 30, height: 30, background: "#F4A623", fontSize: "0.8rem", fontWeight: 700, color: "#0e0e0e" }}>
              {initial}
            </div>
          )}
          <span className="text-white font-[family-name:var(--font-dm)]" style={{ fontSize: "1.14rem", fontWeight: 400, textShadow: "0 1px 4px rgba(0,0,0,0.4)", opacity: 0.9 }}>
            {restaurant.name}
          </span>
        </button>


        {/* Social icons + lang selector */}
        {(restaurant.instagram || restaurant.website || restaurant.whatsapp || showLangSelector) && (
          <div className="absolute z-10 flex items-center gap-2" style={{ top: 14, right: 16 }}>
            {restaurant.instagram && (
              <a href={`https://instagram.com/${restaurant.instagram}`} target="_blank" rel="noopener noreferrer" style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
              </a>
            )}
            {restaurant.whatsapp && (
              <a href={`https://wa.me/${restaurant.whatsapp.replace(/[^0-9+]/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
              </a>
            )}
            {restaurant.website && (
              <a href={restaurant.website.startsWith("http") ? restaurant.website : `https://${restaurant.website}`} target="_blank" rel="noopener noreferrer" style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              </a>
            )}
            {showLangSelector && (
              <div ref={langRef} style={{ position: "relative" }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setLangOpen(!langOpen); }}
                  style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer", fontSize: "0.9rem" }}
                >
                  <FlagCircle lang={lang} size={20} />
                </button>
                {langOpen && (
                  <div style={{ position: "absolute", top: 38, right: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderRadius: 12, padding: 4, display: "flex", flexDirection: "column", gap: 2, minWidth: 120 }}>
                    {availableLangs.map(l => (
                      <button
                        key={l}
                        onClick={(e) => { e.stopPropagation(); handleLangChange(l); }}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: l === lang ? "rgba(244,166,35,0.2)" : "transparent", border: "none", borderRadius: 8, cursor: "pointer", color: "white", fontSize: "0.82rem", fontWeight: l === lang ? 600 : 400 }}
                      >
                        <FlagCircle lang={l} size={18} />
                        {l === "es" ? "Español" : l === "en" ? "English" : l === "pt" ? "Português" : "Italiano"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
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
                onClick={() => { trackHeroClick(restaurant.id, dish.id, "premium"); onDishSelect?.(dish); }}
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
                Ver
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
