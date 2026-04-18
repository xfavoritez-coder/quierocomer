"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import Image from "next/image";
import type { Restaurant, Category, Dish, RestaurantPromotion } from "@prisma/client";
import { groupDishesByCategory, isGeniePick, getDishPhoto } from "./utils/dishHelpers";
import { Sparkles, Bell, User } from "lucide-react";
import DishDetail from "./DishDetail";
import ViewSelector from "./ViewSelector";
import WaiterButton from "../garzon/WaiterButton";
import GenioOnboarding from "../genio/GenioOnboarding";
import { useCartaView } from "./hooks/useCartaView";

interface Review { id: string; dishId: string; rating: number; customerId: string; createdAt: Date; }
interface Props {
  restaurant: Restaurant;
  categories: Category[];
  dishes: Dish[];
  promotions: RestaurantPromotion[];
  ratingMap: Record<string, { avg: number; count: number }>;
  reviews: Review[];
  tableId?: string;
}

type SlideVariant = "hero" | "split" | "light" | "spotlight";
type Palette = "ocean" | "earth" | "fire" | "cream";

const CHAPTER_WORDS = ["uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce"];

function getVariant(dish: Dish, idx: number): SlideVariant {
  if (isGeniePick(dish)) return "spotlight";
  const rotation: SlideVariant[] = ["hero", "split", "light"];
  return rotation[idx % 3];
}

function getPalette(name: string): Palette {
  const n = name.toLowerCase();
  if (/mar|pescad|mariscos|ostra|ceviche|sushi|roll|chirashi/.test(n)) return "ocean";
  if (/carne|parrilla|brasa|fuego|asado|hot/.test(n)) return "fire";
  if (/postre|dulce|helado|torta|café|mocktail/.test(n)) return "cream";
  return "earth";
}

function getPoeticName(name: string): { prefix: string; accent: string } {
  const n = name.toLowerCase();
  if (/entrada/.test(n)) return { prefix: "Para", accent: "empezar" };
  if (/mar|pescad|mariscos|ceviche/.test(n)) return { prefix: "Del", accent: "mar" };
  if (/carne|parrilla|brasa|fuego/.test(n)) return { prefix: "Del", accent: "fuego" };
  if (/pasta/.test(n)) return { prefix: "De la", accent: "masa" };
  if (/postre|dulce/.test(n)) return { prefix: "Del", accent: "final dulce" };
  if (/sushi|roll/.test(n)) return { prefix: "Del", accent: "mar" };
  return { prefix: "", accent: name };
}

function placeholderGradient(id: string) {
  const h = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue = (h * 37) % 40 + 20;
  return `radial-gradient(ellipse at ${30 + (h % 40)}% ${25 + (h % 30)}%, hsl(${hue},50%,55%) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, hsl(${hue},30%,25%) 0%, hsl(${hue},30%,10%) 100%)`;
}

function PhotoBg({ dish, className, style }: { dish: Dish; className?: string; style?: React.CSSProperties }) {
  const photo = getDishPhoto(dish);
  if (photo) return <Image src={photo} alt={dish.name} fill className={`object-cover ${className || ""}`} sizes="100vw" style={style} />;
  return <div style={{ position: "absolute", inset: 0, background: placeholderGradient(dish.id), ...style }} />;
}

export default function CartaViaje({ restaurant, categories, dishes, ratingMap, reviews, tableId }: Props) {
  const grouped = useMemo(() => groupDishesByCategory(dishes, categories), [dishes, categories]);
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [genioOpen, setGenioOpen] = useState(false);
  const [activeRail, setActiveRail] = useState(-1);
  const [railLight, setRailLight] = useState(false);
  const { setView } = useCartaView();

  const sortedDishes = useMemo(() => {
    const r: Dish[] = [];
    for (const g of grouped) r.push(...g.dishes);
    return r;
  }, [grouped]);

  const totalDishes = grouped.reduce((a, g) => a + g.dishes.length, 0);

  return (
    <>
      <style>{CSS}</style>
      <div className="vj-root">
        {/* Top right: user profile */}
        <button
          className="fixed z-50 flex items-center justify-center"
          style={{
            top: 16, right: 16, width: 44, height: 44, borderRadius: "50%",
            background: "rgba(0,0,0,0.35)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)",
          }}
        >
          <User size={16} />
        </button>

        {/* Floating buttons — cinematic style */}
        <div className="fixed z-50 flex flex-col items-center" style={{ right: 20, bottom: 32, gap: 12 }}>
          <button
            onClick={() => setGenioOpen(true)}
            className="flex items-center justify-center rounded-full active:scale-95 transition-transform"
            style={{
              width: 48, height: 48,
              background: "rgba(244,166,35,0.2)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(244,166,35,0.3)", boxShadow: "0 0 20px rgba(244,166,35,0.15)",
            }}
          >
            <Sparkles size={20} color="#F4A623" fill="#F4A623" />
          </button>
          <button
            onClick={async () => {
              try {
                const res = await fetch("/api/qr/waiter/call", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ restaurantId: restaurant.id, tableId: tableId || "general", tableName: tableId ? `Mesa ${tableId}` : "Cliente" }),
                });
                if (res.ok) alert("¡Garzón en camino!");
              } catch { /* ignore */ }
            }}
            className="flex items-center justify-center rounded-full active:scale-95 transition-transform"
            style={{
              width: 48, height: 48,
              background: "rgba(0,0,0,0.4)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.08)", boxShadow: "none",
            }}
          >
            <Bell size={20} color="rgba(255,255,255,0.75)" fill="rgba(255,255,255,0.75)" />
          </button>
          <ViewSelector restaurantId={restaurant.id} />
        </div>

        {/* Rail */}
        <div className={`vj-rail ${railLight ? "light" : ""}`} id="vj-rail">
          {grouped.map((_, i) => (
            <div key={i} className={`vj-rail-dot ${i === activeRail ? "active" : ""}`} />
          ))}
        </div>

        {/* Reel */}
        <div className="vj-reel" id="vj-reel">

          {/* ===== COVER ===== */}
          <CoverSlide restaurant={restaurant} chapterCount={grouped.length} dishCount={totalDishes} allPhotos={dishes.map(getDishPhoto).filter(Boolean) as string[]} />

          {/* ===== CHAPTERS + TRACKS ===== */}
          {grouped.map((group, idx) => {
            const palette = getPalette(group.category.name);
            const poetic = getPoeticName(group.category.name);
            const hasGenie = group.dishes.some(isGeniePick);
            return (
              <CategoryTrack
                key={group.category.id}
                group={group}
                index={idx}
                palette={palette}
                poetic={poetic}
                totalChapters={grouped.length}
                dishes={group.dishes}
                hasGenie={hasGenie}
                categoryName={group.category.name}
                onActive={() => { setActiveRail(idx); setRailLight(palette === "cream"); }}
                onDishTap={setSelectedDish}
              />
            );
          })}

          {/* ===== OUTRO ===== */}
          <OutroSlide onSwitchView={() => setView("lista")} />
        </div>

        {/* Genio */}
        {genioOpen && (
          <GenioOnboarding
            restaurantId={restaurant.id}
            dishes={dishes}
            categories={categories}
            onClose={() => setGenioOpen(false)}
            onResult={(dish) => {
              setGenioOpen(false);
              setTimeout(() => setSelectedDish(dish), 250);
            }}
          />
        )}

        {/* DishDetail */}
        {selectedDish && (
          <DishDetail
            dish={selectedDish}
            allDishes={sortedDishes}
            categories={categories}
            restaurantId={restaurant.id}
            reviews={reviews}
            ratingMap={ratingMap}
            onClose={() => setSelectedDish(null)}
            onChangeDish={setSelectedDish}
          />
        )}
      </div>
    </>
  );
}

/* =============== COVER =============== */
function CoverSlide({ restaurant, chapterCount, dishCount, allPhotos }: { restaurant: Restaurant & { logoUrl?: string | null }; chapterCount: number; dishCount: number; allPhotos: string[] }) {
  const words = restaurant.name.split(" ");
  const w1 = words[0] || "";
  const w2 = words.slice(1).join(" ") || "";

  return (
    <section className="vj-cover" data-section="cover">
      <div className="vj-cover-bg" />
      <div className="vj-cover-grain" />
      {/* Floating photo constellation */}
      {allPhotos.length > 0 && (
        <div className="vj-cover-photos">
          {allPhotos.slice(0, 6).map((photo, i) => {
            // Position photos in the top half only (above the title area)
            const positions = [
              { top: "5%", left: "2%" },
              { top: "3%", left: "55%" },
              { top: "18%", left: "30%" },
              { top: "12%", left: "70%" },
              { top: "25%", left: "5%" },
              { top: "22%", left: "60%" },
            ];
            const pos = positions[i];
            return (
            <div
              key={i}
              className="vj-cover-photo-float"
              style={{
                animationDelay: `${i * -7}s`,
                animationDuration: `${40 + i * 4}s`,
                top: pos.top,
                left: pos.left,
              }}
            >
              <Image src={photo} alt="" width={160} height={110} className="object-cover" style={{ width: "100%", height: "100%", borderRadius: 12 }} />
            </div>
            );
          })}
        </div>
      )}
      <div className="vj-cover-bgtype top font-[family-name:var(--font-fraunces)]">{w1}</div>
      {w2 && <div className="vj-cover-bgtype bottom font-[family-name:var(--font-fraunces)]">{w2}</div>}
      <div className="vj-cover-content">
        {/* Logo */}
        {restaurant.logoUrl && (
          <div style={{ marginBottom: 20, opacity: 0, animation: "vj-fade-up 1s var(--vj-ease) 0.3s forwards" }}>
            <Image src={restaurant.logoUrl} alt={restaurant.name} width={56} height={56} className="rounded-full" style={{ border: "2px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }} />
          </div>
        )}
        <h1 className="vj-cover-title font-[family-name:var(--font-fraunces)]">
          <span className="vj-line"><span>{w1}</span></span>
          {w2 && <span className="vj-line"><span><em>{w2}</em></span></span>}
        </h1>
        <p className="vj-cover-sub font-[family-name:var(--font-fraunces)]">
          Un recorrido por {chapterCount} secciones. Desliza para comenzar.
        </p>
      </div>
      <div className="vj-cover-cue">Comenzar</div>
    </section>
  );
}

/* =============== CHAPTER OPENING =============== */
function ChapterOpening({
  index, palette, poetic, dishCount, hasGenie, categoryName, dishes, onActive,
}: {
  index: number; palette: Palette; poetic: { prefix: string; accent: string };
  dishCount: number; hasGenie: boolean; categoryName: string; dishes: Dish[]; onActive: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useInView(ref, (inView) => {
    if (inView) {
      ref.current?.classList.add("in-view");
      onActive();
    }
  });

  // Check for featured dish (RECOMMENDED)
  const featuredDish = dishes.find(isGeniePick);
  const featuredPhoto = featuredDish ? getDishPhoto(featuredDish) : null;

  // Get dish photos for mosaic background
  const mosaicPhotos = dishes
    .map((d) => getDishPhoto(d))
    .filter(Boolean)
    .slice(0, 6) as string[];

  return (
    <section className="vj-chapter" data-palette={palette} data-section="chapter" data-rail={index} ref={ref}>
      <div className="vj-chapter-bg" />

      {/* Featured photo reveal (for categories with RECOMMENDED dish) */}
      {featuredPhoto && (
        <div className="vj-chapter-featured">
          <Image src={featuredPhoto} alt={featuredDish?.name || ""} fill className="object-cover" sizes="100vw" />
        </div>
      )}

      {/* Photo mosaic background (when no featured dish) */}
      {!featuredPhoto && mosaicPhotos.length > 0 && (
        <div className="vj-chapter-mosaic">
          {mosaicPhotos.map((photo, i) => (
            <div key={i} className="vj-mosaic-cell" style={{ animationDelay: `${i * 0.15}s` }}>
              <Image src={photo} alt="" fill className="object-cover" sizes="50vw" />
            </div>
          ))}
        </div>
      )}

      <div className="vj-chapter-content">
        <div className="vj-chapter-num font-[family-name:var(--font-fraunces)]">
          Sección {CHAPTER_WORDS[index] || index + 1}
        </div>
        <h2 className="vj-chapter-name font-[family-name:var(--font-fraunces)]">
          {poetic.prefix}{poetic.prefix ? <br /> : ""}<em>{poetic.accent}</em>
        </h2>
        <div className="vj-chapter-count">
          {dishCount} {dishCount === 1 ? "plato" : "platos"}{hasGenie ? " · ✦ Genio" : ""}
        </div>
      </div>
      <div className="vj-chapter-hint">Desliza →</div>
    </section>
  );
}

/* =============== CATEGORY TRACK (chapter title + dishes in horizontal) =============== */
function CategoryTrack({
  group, index, palette, poetic, totalChapters, dishes, hasGenie, categoryName, onActive, onDishTap,
}: {
  group: ReturnType<typeof groupDishesByCategory>[0];
  index: number; palette: Palette;
  poetic: { prefix: string; accent: string };
  totalChapters: number; dishes: Dish[]; hasGenie: boolean; categoryName: string;
  onActive: () => void; onDishTap: (d: Dish) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const isLight = palette === "cream";
  const chapterNum = String(index + 1).padStart(2, "0");
  const totalSlides = group.dishes.length + 1; // +1 for chapter title slide

  // Get photos for mosaic
  const featuredDish = dishes.find(isGeniePick);
  const featuredPhoto = featuredDish ? getDishPhoto(featuredDish) : null;
  const mosaicPhotos = !featuredPhoto
    ? (dishes.map((d) => getDishPhoto(d)).filter(Boolean).slice(0, 6) as string[])
    : [];

  useInView(wrapRef, (inView) => { if (inView) onActive(); });

  // Horizontal observer
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const slides = track.querySelectorAll(".vj-slide-item");
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && e.intersectionRatio > 0.6) {
          slides.forEach((s) => { if (s !== e.target) s.classList.remove("in-view"); });
          e.target.classList.add("in-view");
          setActiveSlide(parseInt((e.target as HTMLElement).dataset.slideIdx || "0"));
        }
      });
    }, { root: track, threshold: [0.6] });
    slides.forEach((s) => obs.observe(s));
    if (slides[0]) slides[0].classList.add("in-view");
    return () => obs.disconnect();
  }, []);

  return (
    <div className="vj-track-wrap" data-section="track" data-rail={index} ref={wrapRef} style={{ background: isLight ? "#f5ecd8" : undefined }}>
      {/* Header — only show on dish slides (not chapter title) */}
      {activeSlide > 0 && (
        <div className={`vj-category-header ${isLight ? "light" : ""}`}>
          <div className="vj-category-label" style={isLight ? { background: "rgba(0,0,0,0.08)", color: "#3d2817" } : { background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", color: "white" }}>
            {chapterNum} · <strong className="font-[family-name:var(--font-fraunces)]" style={{ color: isLight ? "#8a4a1a" : "white" }}>{poetic.prefix} {poetic.accent}</strong>
          </div>
          <div className="vj-bullets" style={isLight ? { background: "rgba(0,0,0,0.08)" } : undefined}>
            {group.dishes.map((_, i) => (
              <div key={i} className={`vj-bullet ${i + 1 === activeSlide ? "active" : ""}`} style={isLight ? (i + 1 === activeSlide ? { background: "#c93010" } : { background: "rgba(0,0,0,0.25)" }) : undefined} />
            ))}
          </div>
        </div>
      )}
      <div className="vj-category-track" ref={trackRef}>
        {/* First slide: chapter title */}
        <div className="vj-slide-item vj-dish vj-chapter-slide" data-slide-idx="0" data-palette={palette} style={{
          flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 32px",
          background: isLight ? "linear-gradient(180deg, #f5ecd8 0%, #e8d4b0 100%)" : undefined,
          color: isLight ? "#2a1810" : undefined,
        }}>
          {/* Chapter background */}
          <div className="vj-chapter-bg" />

          {/* Featured photo or mosaic */}
          {featuredPhoto && (
            <div className="vj-chapter-featured">
              <Image src={featuredPhoto} alt={featuredDish?.name || ""} fill className="object-cover" sizes="100vw" />
            </div>
          )}
          {!featuredPhoto && mosaicPhotos.length > 0 && (
            <div className="vj-chapter-mosaic">
              {mosaicPhotos.map((photo, i) => (
                <div key={i} className="vj-mosaic-cell">
                  <Image src={photo} alt="" fill className="object-cover" sizes="50vw" />
                </div>
              ))}
            </div>
          )}

          <div style={{ position: "relative", zIndex: 2 }}>
            <div className="vj-chapter-num font-[family-name:var(--font-fraunces)]" style={{ color: isLight ? "#c93010" : "rgba(255,255,255,0.6)", opacity: 1, transform: "none" }}>
              Sección {CHAPTER_WORDS[index] || index + 1}
            </div>
            <h2 className="vj-chapter-name font-[family-name:var(--font-fraunces)]" style={{ opacity: 1, transform: "none", color: isLight ? "#2a1810" : undefined }}>
              {poetic.prefix}{poetic.prefix ? <br /> : ""}<em style={{ color: isLight ? "#c93010" : "#F4A623" }}>{poetic.accent}</em>
            </h2>
            <div style={{ fontSize: "16px", letterSpacing: "0.2em", textTransform: "uppercase" as const, opacity: 0.65 }}>
              {group.dishes.length} {group.dishes.length === 1 ? "plato" : "platos"}{hasGenie ? " · ✦ Genio" : ""}
            </div>
          </div>

          <div style={{ position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)", fontSize: "9.5px", letterSpacing: "0.3em", textTransform: "uppercase" as const, opacity: 0.45 }}>
            Desliza →
          </div>
        </div>

        {/* Dish slides */}
        {group.dishes.map((dish, i) => (
          <DishSlide
            key={dish.id}
            dish={dish}
            variant={getVariant(dish, i)}
            palette={palette}
            index={i + 1}
            onClick={() => onDishTap(dish)}
          />
        ))}
      </div>
    </div>
  );
}

/* =============== DISH SLIDE =============== */
function DishSlide({ dish, variant, palette, index, onClick }: {
  dish: Dish; variant: SlideVariant; palette: Palette; index: number; onClick: () => void;
}) {
  const pitch = dish.description || "";
  const genie = isGeniePick(dish);
  const isLight = palette === "cream" && variant === "light";
  const accentColor = palette === "ocean" ? "#7fbfdc" : palette === "cream" ? "#c93010" : "#F4A623";

  if (variant === "hero") return (
    <div className="vj-slide-item vj-dish vj-v-hero" data-slide-idx={index} onClick={onClick}>
      <div className="vj-hero-photo"><PhotoBg dish={dish} /></div>
      <div className="vj-hero-overlay" />
      <div className="vj-hero-info">
        <span className="vj-eyebrow" style={{ color: accentColor }}>{dish.ingredients?.split(/[,;]/)[0]?.trim() || ""}</span>
        <h3 className="vj-title font-[family-name:var(--font-fraunces)]">
          <span className="vj-ln"><span>{dish.name}</span></span>
        </h3>
        {pitch && <p className="vj-pitch font-[family-name:var(--font-fraunces)]">{pitch}</p>}
        <div className="vj-meta">
          <span className="vj-price font-[family-name:var(--font-fraunces)]">${dish.price?.toLocaleString("es-CL")}</span>
        </div>
      </div>
    </div>
  );

  if (variant === "split") return (
    <div className="vj-slide-item vj-dish vj-v-split" data-slide-idx={index} onClick={onClick}>
      <div className="vj-split-photo"><PhotoBg dish={dish} /><div className="vj-split-gradient" /></div>
      <div className="vj-split-info">
        <span className="vj-eyebrow" style={{ color: accentColor }}>{dish.allergens || ""}</span>
        <h3 className="vj-title font-[family-name:var(--font-fraunces)]" style={{ color: "white" }}>
          <span className="vj-ln"><span>{dish.name}</span></span>
        </h3>
        {pitch && <p className="vj-pitch font-[family-name:var(--font-fraunces)]" style={{ color: "white", opacity: 0.72 }}>{pitch}</p>}
        <div className="vj-meta" style={{ color: "white" }}>
          <span className="vj-price font-[family-name:var(--font-fraunces)]">${dish.price?.toLocaleString("es-CL")}</span>
        </div>
      </div>
    </div>
  );

  if (variant === "light") return (
    <div
      className="vj-slide-item vj-dish vj-v-light"
      data-slide-idx={index}
      onClick={onClick}
      style={isLight ? { background: "linear-gradient(180deg, #f8f0e0 0%, #ebddc4 100%)", color: "#2a1810" } : undefined}
    >
      <span className="vj-eyebrow" style={{ color: isLight ? "#8a5a2c" : accentColor }}>{dish.tags?.includes("NEW") ? "Nuevo" : ""}</span>
      <div className="vj-photo-wrap">
        <div className="vj-photo-circle"><PhotoBg dish={dish} /></div>
      </div>
      <h3 className="vj-title font-[family-name:var(--font-fraunces)]">
        <span className="vj-ln"><span>{dish.name}</span></span>
      </h3>
      {pitch && <p className="vj-pitch font-[family-name:var(--font-fraunces)]" style={{ fontSize: "22px", color: "#1a0e08" }}>{pitch}</p>}
      <div className="vj-meta" style={isLight ? { color: "#5a3d20" } : undefined}>
        <span className="vj-price font-[family-name:var(--font-fraunces)]" style={isLight ? { borderColor: "#3d2817", color: "#3d2817" } : undefined}>
          ${dish.price?.toLocaleString("es-CL")}
        </span>
      </div>
    </div>
  );

  // SPOTLIGHT (Genio)
  return (
    <div className="vj-slide-item vj-dish vj-v-spotlight" data-slide-idx={index} onClick={onClick} style={{ background: "radial-gradient(ellipse at center, #1a0a04 0%, #000 80%)" }}>
      <div className="vj-spot-wrap">
        <div className="vj-spot-photo"><PhotoBg dish={dish} /></div>
      </div>
      <span className="vj-eyebrow" style={{ color: "#F4A623" }}>{dish.ingredients?.split(/[,;]/)[0]?.trim() || ""}</span>
      <h3 className="vj-title vj-title-gradient font-[family-name:var(--font-fraunces)]">
        <span className="vj-ln"><span>{dish.name}</span></span>
      </h3>
      {pitch && <p className="vj-pitch font-[family-name:var(--font-fraunces)]">{pitch}</p>}
      <div className="vj-meta">
        <span className="vj-price font-[family-name:var(--font-fraunces)]">${dish.price?.toLocaleString("es-CL")}</span>
      </div>
    </div>
  );
}

/* =============== OUTRO =============== */
function OutroSlide({ onSwitchView }: { onSwitchView: () => void }) {
  return (
    <section className="vj-outro" data-section="outro">
      <div className="vj-outro-bg" />
      <div className="vj-outro-inner">
        <h3 className="font-[family-name:var(--font-fraunces)]">
          Hasta aquí llega el <em>recorrido</em>.<br />¿Qué vas a pedir?
        </h3>
        <p>Toca para ver la carta en otro formato.</p>
        <button className="vj-outro-cta" onClick={onSwitchView}>Ver en Lista →</button>
      </div>
    </section>
  );
}

/* =============== HOOKS =============== */
function useInView(ref: React.RefObject<HTMLElement | null>, cb: (inView: boolean) => void) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => cb(e.isIntersecting)),
      { threshold: 0.55 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, cb]);
}

/* =============== ALL CSS =============== */
const CSS = `
  :root { --vj-ease: cubic-bezier(0.16,1,0.3,1); }
  .vj-root { background: #000; color: #fff; overflow: hidden; user-select: none; -webkit-font-smoothing: antialiased; }


  /* Reel */
  .vj-reel { height: 100vh; height: 100dvh; overflow-y: scroll; scroll-snap-type: y mandatory; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
  .vj-reel::-webkit-scrollbar { display: none; }

  /* Rail */
  .vj-rail { position: fixed; right: 8px; top: 50%; transform: translateY(-50%); z-index: 50; display: flex; flex-direction: column; gap: 6px; pointer-events: none; }
  .vj-rail-dot { width: 3px; height: 10px; background: rgba(255,255,255,0.22); border-radius: 2px; transition: all 0.5s ease; }
  .vj-rail-dot.active { background: #F4A623; height: 22px; }
  .vj-rail.light .vj-rail-dot { background: rgba(0,0,0,0.2); }
  .vj-rail.light .vj-rail-dot.active { background: #c93010; }

  /* ===== COVER ===== */
  .vj-cover { height: 100vh; height: 100dvh; scroll-snap-align: start; scroll-snap-stop: always; position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; }
  .vj-cover-bg { position: absolute; inset: -5%; background: radial-gradient(ellipse 80% 50% at 50% 30%, rgba(244,166,35,0.12) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 30% 70%, rgba(200,80,40,0.15) 0%, transparent 50%), radial-gradient(ellipse at center, #1a0a04 0%, #000 80%); animation: vj-cover-drift 20s ease-in-out infinite alternate; }
  @keyframes vj-cover-drift { 0% { transform: scale(1) translate(0,0); } 100% { transform: scale(1.1) translate(-2%,-1%); } }
  .vj-cover-grain { position: absolute; inset: 0; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/></svg>"); opacity: 0.08; mix-blend-mode: overlay; pointer-events: none; z-index: 2; }
  /* Floating photo constellation */
  .vj-cover-photos { position: absolute; inset: 0; z-index: 1; overflow: hidden; pointer-events: none; }
  .vj-cover-photo-float {
    position: absolute;
    width: 140px; height: 95px;
    border-radius: 12px;
    overflow: hidden;
    opacity: 0;
    filter: blur(1px);
    box-shadow: 0 12px 40px rgba(0,0,0,0.4);
    animation: vjPhotoFloat 60s ease-in-out infinite;
  }
  @keyframes vjPhotoFloat {
    0% { opacity: 0; transform: translateX(-60px) translateY(40px) scale(0.8) rotate(-5deg); }
    10% { opacity: 0.12; }
    30% { opacity: 0.15; transform: translateX(40px) translateY(-30px) scale(1.05) rotate(3deg); filter: blur(0px); }
    50% { opacity: 0.1; transform: translateX(80px) translateY(15px) scale(0.92) rotate(-2deg); filter: blur(1px); }
    70% { opacity: 0.14; transform: translateX(20px) translateY(-40px) scale(1.08) rotate(4deg); filter: blur(0px); }
    90% { opacity: 0.11; transform: translateX(-40px) translateY(10px) scale(0.95) rotate(-3deg); }
    100% { opacity: 0; transform: translateX(-60px) translateY(40px) scale(0.8) rotate(-5deg); }
  }

  .vj-cover-bgtype { position: absolute; font-weight: 200; font-style: italic; font-size: 32vw; line-height: 0.85; letter-spacing: -0.05em; color: rgba(244,166,35,0.04); white-space: nowrap; pointer-events: none; z-index: 1; }
  .vj-cover-bgtype.top { top: 10%; left: -10%; }
  .vj-cover-bgtype.bottom { bottom: 15%; right: -10%; }
  .vj-cover-content { position: relative; z-index: 5; padding: 0 28px calc(180px + env(safe-area-inset-bottom)); }
  .vj-cover-kicker { display: inline-flex; align-items: center; gap: 8px; font-size: 10px; letter-spacing: 0.4em; text-transform: uppercase; color: #F4A623; margin-bottom: 20px; font-weight: 500; opacity: 0; animation: vj-kicker-in 1s var(--vj-ease) 0.5s forwards; }
  .vj-cover-kicker::before, .vj-cover-kicker::after { content: ''; width: 24px; height: 1px; background: currentColor; opacity: 0.5; }
  @keyframes vj-kicker-in { from { opacity: 0; letter-spacing: 0.1em; } to { opacity: 1; letter-spacing: 0.4em; } }
  .vj-cover-title { font-weight: 200; font-size: clamp(54px, 16vw, 92px); line-height: 0.88; letter-spacing: -0.04em; margin-bottom: 16px; }
  .vj-line { display: block; overflow: hidden; }
  .vj-line span { display: block; transform: translateY(110%); animation: vj-line-up 1.2s var(--vj-ease) forwards; }
  .vj-line:nth-child(2) span { animation-delay: 0.2s; }
  .vj-line:nth-child(2) span em { font-style: italic; font-weight: 300; background: linear-gradient(135deg, #F4A623 0%, #e85530 60%, #c93010 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  @keyframes vj-line-up { to { transform: translateY(0); } }
  .vj-cover-sub { font-style: italic; font-weight: 300; font-size: 22px; line-height: 1.35; opacity: 0; max-width: 30ch; margin-bottom: 28px; animation: vj-fade-up 1.2s var(--vj-ease) 0.9s forwards; }
  @keyframes vj-fade-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 0.85; transform: translateY(0); } }
  .vj-cover-meta { display: flex; gap: 20px; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; opacity: 0; animation: vj-fade-up 1.2s var(--vj-ease) 1.2s forwards; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.12); }
  .vj-cover-meta strong { display: block; font-weight: 400; font-size: 22px; text-transform: none; letter-spacing: -0.01em; margin-top: 4px; }
  .vj-cover-cue { position: absolute; bottom: calc(20px + env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%); z-index: 6; font-size: 10px; letter-spacing: 0.3em; text-transform: uppercase; opacity: 0; animation: vj-fade-up 1s ease-out 2s forwards, vj-cue-float 2.5s ease-in-out 3s infinite; }
  .vj-cover-cue::after { content: ''; display: block; width: 1px; height: 24px; background: linear-gradient(180deg, rgba(255,255,255,0.5), transparent); margin: 10px auto 0; }
  @keyframes vj-cue-float { 0%,100% { transform: translateX(-50%) translateY(0); opacity: 0.4; } 50% { transform: translateX(-50%) translateY(6px); opacity: 0.9; } }

  /* ===== CHAPTER OPENING ===== */
  .vj-chapter { height: 100vh; height: 100dvh; scroll-snap-align: start; scroll-snap-stop: always; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; padding: 0 32px; }
  .vj-chapter-bg { position: absolute; inset: 0; }
  .vj-chapter[data-palette="ocean"] .vj-chapter-bg { background: radial-gradient(ellipse at 30% 40%, rgba(100,180,220,0.15) 0%, transparent 60%), radial-gradient(ellipse at 70% 70%, rgba(20,80,120,0.2) 0%, transparent 50%), linear-gradient(180deg, #061020 0%, #020810 100%); }
  .vj-chapter[data-palette="earth"] .vj-chapter-bg { background: radial-gradient(ellipse at 40% 30%, rgba(200,130,60,0.18) 0%, transparent 55%), radial-gradient(ellipse at 60% 80%, rgba(100,50,20,0.25) 0%, transparent 50%), linear-gradient(180deg, #1a0c04 0%, #0a0502 100%); }
  .vj-chapter[data-palette="fire"] .vj-chapter-bg { background: radial-gradient(ellipse at 50% 50%, rgba(244,100,40,0.2) 0%, transparent 55%), radial-gradient(ellipse at 20% 80%, rgba(200,50,10,0.25) 0%, transparent 50%), linear-gradient(180deg, #200804 0%, #080200 100%); }
  .vj-chapter[data-palette="cream"] .vj-chapter-bg { background: radial-gradient(ellipse at 30% 30%, rgba(255,240,220,0.9) 0%, transparent 60%), linear-gradient(180deg, #f5ecd8 0%, #e8d4b0 100%); }
  .vj-chapter[data-palette="cream"] { color: #2a1810; }
  .vj-chapter[data-palette="cream"] .vj-chapter-num, .vj-chapter[data-palette="cream"] .vj-chapter-name em { color: #c93010; }
  .vj-chapter::before { content: ''; position: absolute; top: 50%; left: 50%; width: 0; height: 1px; background: currentColor; opacity: 0.3; transform: translate(-50%,-50%); transition: width 1.5s var(--vj-ease); }
  .vj-chapter.in-view::before { width: 60%; max-width: 400px; }
  .vj-chapter-content { text-align: center; position: relative; z-index: 2; max-width: 500px; }
  .vj-chapter-num { font-style: italic; font-weight: 300; font-size: 12px; letter-spacing: 0.4em; color: rgba(255,255,255,0.6); text-transform: uppercase; margin-bottom: 20px; opacity: 0; transform: translateY(20px); transition: all 1s var(--vj-ease) 0.3s; }
  .vj-chapter.in-view .vj-chapter-num { opacity: 1; transform: translateY(0); }
  .vj-chapter-name { font-weight: 400; font-size: clamp(44px, 13vw, 72px); line-height: 0.95; letter-spacing: -0.035em; margin: 16px 0 24px; opacity: 0; transform: translateY(40px); transition: all 1.4s var(--vj-ease) 0.6s; }
  .vj-chapter-name em { font-style: italic; font-weight: 500; display: block; color: #F4A623; }
  .vj-chapter.in-view .vj-chapter-name { opacity: 1; transform: translateY(0); }
  .vj-chapter-desc { font-style: italic; font-weight: 300; font-size: 16px; line-height: 1.5; opacity: 0; max-width: 28ch; margin: 0 auto 32px; transition: opacity 1s var(--vj-ease) 1.2s; }
  .vj-chapter.in-view .vj-chapter-desc { opacity: 0.75; }
  .vj-chapter-count { display: inline-flex; align-items: center; gap: 10px; font-size: 16px; letter-spacing: 0.2em; text-transform: uppercase; opacity: 0; transform: translateY(16px); transition: all 1s var(--vj-ease) 1.2s; }
  .vj-chapter.in-view .vj-chapter-count { opacity: 0.65; transform: translateY(0); }
  .vj-chapter-count::before, .vj-chapter-count::after { content: ''; width: 20px; height: 1px; background: currentColor; opacity: 0.5; }
  .vj-chapter-hint { position: absolute; bottom: calc(30px + env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%); font-size: 9.5px; letter-spacing: 0.3em; text-transform: uppercase; opacity: 0; transition: opacity 1s ease 2s; }
  .vj-chapter.in-view .vj-chapter-hint { opacity: 0.45; animation: vj-cue-float 2.5s ease-in-out 2.5s infinite; }

  /* Featured photo reveal */
  .vj-chapter-featured {
    position: absolute;
    inset: 0;
    z-index: 0;
    filter: blur(20px) brightness(0.4);
    transform: scale(1.15);
    opacity: 0;
    transition: filter 3s cubic-bezier(0.16,1,0.3,1), opacity 1.5s ease, transform 8s cubic-bezier(0.16,1,0.3,1);
  }
  .vj-chapter-featured img { object-fit: cover; }
  .vj-chapter.in-view .vj-chapter-featured {
    filter: blur(6px) brightness(0.35);
    opacity: 0.7;
    transform: scale(1.05);
  }

  /* Photo mosaic */
  .vj-chapter-mosaic {
    position: absolute;
    inset: -20%;
    z-index: 0;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    gap: 3px;
    opacity: 0;
    filter: blur(3px);
    transform: scale(1.8) rotate(2deg);
    animation: none;
  }
  .vj-chapter.in-view .vj-chapter-mosaic {
    opacity: 0.3;
    animation: vjMosaicAlive 12s cubic-bezier(0.16,1,0.3,1) forwards;
  }
  @keyframes vjMosaicAlive {
    0% { transform: scale(1.8) rotate(2deg); filter: blur(3px); }
    30% { transform: scale(1.2) rotate(0deg); filter: blur(1px); }
    60% { transform: scale(1.05) rotate(-0.5deg); filter: blur(0px); }
    100% { transform: scale(1.1) rotate(0.5deg); filter: blur(0.5px); }
  }
  /* Dark overlay */
  .vj-chapter-mosaic::after {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.4);
    z-index: 1;
  }
  .vj-mosaic-cell {
    position: relative;
    overflow: hidden;
  }
  .vj-mosaic-cell img { object-fit: cover; }

  /* ===== CATEGORY TRACK ===== */
  .vj-track-wrap { height: 100vh; height: 100dvh; scroll-snap-align: start; scroll-snap-stop: always; position: relative; overflow: hidden; }
  .vj-category-track { display: flex; height: 100%; width: 100%; overflow-x: scroll; scroll-snap-type: x mandatory; scrollbar-width: none; -webkit-overflow-scrolling: touch; overscroll-behavior-x: contain; }
  .vj-category-track::-webkit-scrollbar { display: none; }
  .vj-category-header { position: absolute; top: calc(max(12px, env(safe-area-inset-top)) + 50px); left: 16px; right: 16px; z-index: 20; display: flex; justify-content: space-between; align-items: center; pointer-events: none; }
  .vj-category-header.light { color: #2a1810; }
  .vj-category-header.light .vj-category-label { background: rgba(0,0,0,0.06); color: #3d2817; }
  .vj-category-header.light .vj-category-label strong { color: #8a4a1a; }
  .vj-category-header.light .vj-bullets { background: rgba(0,0,0,0.08); }
  .vj-category-label { font-size: 11px; letter-spacing: 0.28em; text-transform: uppercase; opacity: 1; font-weight: 600; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); padding: 6px 12px; border-radius: 50px; }
  .vj-category-label strong { font-style: italic; font-weight: 600; font-size: 14px; letter-spacing: 0.02em; text-transform: none; margin-left: 6px; }
  .vj-bullets { display: flex; gap: 4px; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); padding: 6px 10px; border-radius: 50px; }
  .vj-bullet { width: 16px; height: 3px; background: rgba(255,255,255,0.6); border-radius: 3px; transition: all 0.4s ease; box-shadow: 0 1px 4px rgba(0,0,0,0.5); }
  .vj-bullet.active { background: #F4A623; width: 28px; box-shadow: 0 1px 6px rgba(244,166,35,0.5); }
  .vj-category-header.light .vj-bullet { background: rgba(0,0,0,0.25); }
  .vj-category-header.light .vj-bullet.active { background: #c93010; }

  /* ===== DISH (shared) ===== */
  .vj-dish { flex: 0 0 100%; width: 100vw; height: 100%; scroll-snap-align: start; scroll-snap-stop: always; position: relative; overflow: hidden; display: flex; cursor: pointer; }
  .vj-eyebrow { font-size: 10px; letter-spacing: 0.3em; text-transform: uppercase; opacity: 0; margin-bottom: 12px; font-weight: 500; display: inline-block; transform: translateY(20px); transition: all 1s var(--vj-ease) 0.3s; }
  .vj-dish.in-view .vj-eyebrow { opacity: 0.7; transform: translateY(0); }
  .vj-title { font-weight: 200; font-size: clamp(36px, 10vw, 52px); line-height: 0.95; letter-spacing: -0.025em; margin-bottom: 16px; }
  .vj-title em { font-style: italic; font-weight: 300; }
  .vj-title-gradient em { background: linear-gradient(135deg, #f5d4a0 0%, #e8a06a 50%, #c9785a 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .vj-ln { display: block; overflow: hidden; }
  .vj-ln span { display: block; transform: translateY(110%); transition: transform 1.1s var(--vj-ease); }
  .vj-dish.in-view .vj-ln span { transform: translateY(0); }
  .vj-dish.in-view .vj-ln:nth-child(2) span { transition-delay: 0.15s; }
  .vj-pitch { font-weight: 300; font-style: italic; font-size: 18px; line-height: 1.45; opacity: 0; max-width: 32ch; margin-bottom: 24px; transform: translateY(20px); transition: all 1.1s var(--vj-ease) 0.5s; }
  .vj-dish.in-view .vj-pitch { opacity: 0.9; transform: translateY(0); }
  .vj-v-light .vj-pitch { margin-left: auto; margin-right: auto; color: #1a0e08; }
  .vj-v-spotlight .vj-pitch { margin-left: auto; margin-right: auto; }
  .vj-meta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; opacity: 0; transform: translateY(16px); transition: all 1s var(--vj-ease) 0.7s; }
  .vj-v-light .vj-meta, .vj-v-spotlight .vj-meta { justify-content: center; }
  .vj-dish.in-view .vj-meta { opacity: 1; transform: translateY(0); }
  .vj-price { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; padding: 6px 16px; border: 1px solid currentColor; border-radius: 100px; opacity: 0.92; }
  .vj-price::before { content: ''; width: 4px; height: 4px; border-radius: 50%; background: currentColor; }

  /* HERO */
  .vj-v-hero { flex-direction: column; justify-content: flex-end; }
  .vj-hero-photo { position: absolute; inset: 0; transform: scale(1.12); transition: transform 14s var(--vj-ease); }
  .vj-hero-photo img { object-fit: cover; }
  .vj-v-hero.in-view .vj-hero-photo { transform: scale(1); }
  .vj-hero-overlay { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.2) 0%, transparent 30%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,0.98) 100%); }
  .vj-hero-info { position: relative; z-index: 3; padding: 0 28px calc(60px + env(safe-area-inset-bottom)); width: 100%; }

  /* SPLIT */
  .vj-v-split { flex-direction: column; background: #0a0604; }
  .vj-split-photo { flex: 1; min-height: 52vh; position: relative; overflow: hidden; }
  .vj-split-photo img { object-fit: cover; }
  .vj-split-gradient { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 50%, #0a0604 100%); }
  .vj-split-info { padding: 24px 28px calc(60px + env(safe-area-inset-bottom)); position: relative; z-index: 3; }

  /* LIGHT */
  .vj-v-light { background: linear-gradient(180deg, #f8f0e0 0%, #ebddc4 100%); color: #2a1810; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 110px 24px 60px; }
  .vj-photo-wrap { position: relative; width: min(68vw, 300px); aspect-ratio: 1; margin-bottom: 32px; }
  .vj-photo-wrap::before, .vj-photo-wrap::after { content: ''; position: absolute; inset: -18px; border-radius: 50%; border: 1px solid rgba(138,90,44,0.2); pointer-events: none; }
  .vj-photo-wrap::after { inset: -34px; border-style: dashed; opacity: 0.5; }
  .vj-photo-circle { position: relative; width: 100%; height: 100%; border-radius: 50%; overflow: hidden; box-shadow: 0 30px 60px -15px rgba(60,30,0,0.25), 0 0 0 8px rgba(255,255,255,0.5); transform: scale(0.9); transition: transform 1.8s var(--vj-ease); }
  .vj-photo-circle img { object-fit: cover; }
  .vj-v-light.in-view .vj-photo-circle { transform: scale(1); }

  /* SPOTLIGHT */
  .vj-v-spotlight { flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 110px 24px 60px; }
  .vj-spot-wrap { position: relative; width: min(72vw, 320px); aspect-ratio: 1; margin-bottom: 32px; }
  .vj-spot-wrap::before { content: ''; position: absolute; inset: -50px; background: radial-gradient(circle, rgba(244,166,35,0.35) 0%, rgba(232,80,40,0.15) 40%, transparent 70%); filter: blur(30px); animation: vj-halo-pulse 4s ease-in-out infinite; z-index: -1; }
  @keyframes vj-halo-pulse { 0%,100% { opacity: 0.7; transform: scale(1); } 50% { opacity: 1; transform: scale(1.15); } }
  .vj-spot-wrap::after { content: ''; position: absolute; inset: -10px; border-radius: 50%; border: 1px solid rgba(244,166,35,0.3); animation: vj-orbit 30s linear infinite; }
  @keyframes vj-orbit { to { transform: rotate(360deg); } }
  .vj-spot-photo { width: 100%; height: 100%; border-radius: 50%; overflow: hidden; box-shadow: 0 0 0 1px rgba(255,255,255,0.1), 0 40px 80px -20px rgba(0,0,0,0.8); transform: scale(0.88); transition: transform 1.8s var(--vj-ease); }
  .vj-spot-photo img { object-fit: cover; }
  .vj-v-spotlight.in-view .vj-spot-photo { transform: scale(1); }
  .vj-genie-badge { display: inline-flex; align-items: center; gap: 8px; padding: 7px 16px; background: rgba(244,166,35,0.12); border: 1px solid rgba(244,166,35,0.5); border-radius: 100px; font-size: 10px; letter-spacing: 0.3em; text-transform: uppercase; color: #F4A623; font-weight: 500; margin-bottom: 28px; backdrop-filter: blur(10px); z-index: 2; position: relative; }
  .vj-genie-badge::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: #F4A623; box-shadow: 0 0 12px #F4A623; animation: vj-pulse 2s ease-in-out infinite; }
  @keyframes vj-pulse { 0%,100% { opacity: 0.7; transform: scale(1); } 50% { opacity: 1; transform: scale(1.3); } }

  /* OUTRO */
  .vj-outro { height: 100vh; height: 100dvh; scroll-snap-align: start; scroll-snap-stop: always; position: relative; background: radial-gradient(ellipse at center, #1a0a04 0%, #000 80%); display: flex; align-items: center; justify-content: center; text-align: center; padding: 0 32px; }
  .vj-outro-bg { position: absolute; inset: 0; background: radial-gradient(circle at 50% 30%, rgba(244,166,35,0.12), transparent 50%); animation: vj-cover-drift 8s ease-in-out infinite alternate; }
  .vj-outro-inner { position: relative; z-index: 2; }
  .vj-outro-inner h3 { font-weight: 200; font-style: italic; font-size: clamp(32px, 9vw, 48px); line-height: 1.05; margin-bottom: 20px; letter-spacing: -0.02em; }
  .vj-outro-inner h3 em { font-style: normal; font-weight: 300; color: #F4A623; }
  .vj-outro-inner p { opacity: 0.6; font-size: 15px; margin-bottom: 32px; font-weight: 300; }
  .vj-outro-cta { display: inline-flex; align-items: center; gap: 10px; padding: 14px 32px; background: linear-gradient(135deg, #F4A623 0%, #e85530 100%); color: #0a0604; border-radius: 100px; font-size: 13px; font-weight: 600; letter-spacing: 0.03em; border: none; cursor: pointer; font-family: inherit; box-shadow: 0 10px 30px -8px rgba(244,166,35,0.5); }

  /* Reduce motion */
  @media (prefers-reduced-motion: reduce) {
    .vj-cover-bg, .vj-outro-bg { animation: none; }
    .vj-spot-wrap::before, .vj-spot-wrap::after { animation: none; }
    .vj-photo-wrap::before, .vj-photo-wrap::after { animation: none; }
    .vj-genie-badge::before { animation: none; }
    .vj-cover-kicker, .vj-cover-sub, .vj-cover-meta, .vj-cover-cue { animation: none; opacity: 1; }
    .vj-line span { animation: none; transform: none; }
    .vj-chapter-num, .vj-chapter-name, .vj-chapter-desc, .vj-chapter-count { opacity: 1; transform: none; transition: none; }
    .vj-eyebrow, .vj-pitch, .vj-meta { opacity: 1; transform: none; transition: none; }
    .vj-ln span { transform: none; transition: none; }
  }
`;
