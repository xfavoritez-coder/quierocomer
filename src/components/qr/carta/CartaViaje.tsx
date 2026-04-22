"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import Image from "next/image";
import type { Restaurant, Category, Dish, RestaurantPromotion } from "@prisma/client";
import { trackDishEnter, trackDishLeave, trackCategoryDwell } from "@/lib/sessionTracker";
import { groupDishesByCategory, isGeniePick, getDishPhoto } from "./utils/dishHelpers";
import { Sparkles, User } from "lucide-react";
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
  qrUser?: any;
  onProfileOpen?: () => void;
  onReady?: () => void;
  readyKey?: number;
  showWaiter?: boolean;
}

type SlideVariant = "hero" | "split" | "light" | "spotlight";
type Palette = "ocean" | "earth" | "fire" | "cream";

const CHAPTER_WORDS = ["uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce"];

function getVariant(dish: Dish, idx: number): SlideVariant {
  if (isGeniePick(dish)) return "spotlight";
  const rotation: SlideVariant[] = ["hero", "split", "light"];
  return rotation[idx % 3];
}

function getPalette(_name: string): Palette {
  return "earth";
}

function getPoeticName(name: string): { prefix: string; accent: string } {
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

export default function CartaViaje({ restaurant, categories, dishes, ratingMap, reviews, tableId, qrUser, onProfileOpen, onReady, readyKey, showWaiter }: Props) {
  useEffect(() => { onReady?.(); }, [readyKey]);
  const grouped = useMemo(() => groupDishesByCategory(dishes, categories), [dishes, categories]);
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [genioOpen, setGenioOpen] = useState(false);
  const [activeRail, setActiveRail] = useState(-1);
  const [railLight, setRailLight] = useState(false);
  const { setView } = useCartaView();

  const handleDishTap = useCallback((dish: Dish) => {
    setSelectedDish(dish);
  }, []);

  const sortedDishes = useMemo(() => {
    const r: Dish[] = [];
    for (const g of grouped) r.push(...g.dishes);
    return r;
  }, [grouped]);


  return (
    <>
      <style>{CSS}</style>
      <div className="vj-root">
        {/* Top left: logo + restaurant name */}
        <button
          onClick={() => document.getElementById("vj-reel")?.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed z-50 flex items-center"
          style={{
            top: 17, left: 16, gap: 8,
            background: "rgba(0,0,0,0.35)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.08)", borderRadius: 50,
            padding: "3px 11px 3px 8px", cursor: "pointer",
          }}
        >
          {restaurant.logoUrl ? (
            <Image src={restaurant.logoUrl} alt={restaurant.name} width={29} height={29} className="rounded-full" style={{ flexShrink: 0 }} />
          ) : (
            <div style={{ width: 29, height: 29, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.7)", flexShrink: 0 }}>
              {restaurant.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span style={{ fontSize: "1rem", fontWeight: 400, color: "rgba(255,255,255,0.7)", letterSpacing: "0.02em" }}>
            {restaurant.name}
          </span>
        </button>

        {/* Top right: user profile */}
        <button
          onClick={onProfileOpen}
          className="fixed z-50 flex items-center justify-center"
          style={{
            top: 18, right: 18, width: 35, height: 35, borderRadius: "50%",
            ...(qrUser?.name
              ? { background: "#F4A623", border: "none" }
              : { background: "rgba(0,0,0,0.35)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)" }),
            color: "rgba(255,255,255,0.6)",
          }}
        >
          {qrUser?.name ? (
            <span style={{ color: "white", fontSize: "15px", fontWeight: 700, fontFamily: "var(--font-dm)" }}>
              {qrUser.name.charAt(0).toUpperCase()}
            </span>
          ) : (
            <User size={16} />
          )}
        </button>

        {/* Floating buttons — cinematic style */}
        <div className="fixed z-50 flex flex-col items-center" style={{ right: 12, bottom: "calc(24px + env(safe-area-inset-bottom))", gap: 8 }}>
          <button
            onClick={() => setGenioOpen(true)}
            className="flex items-center justify-center rounded-full active:scale-95 transition-transform"
            style={{
              width: 48, height: 48,
              background: "rgba(244,166,35,0.2)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(244,166,35,0.3)", boxShadow: "0 0 20px rgba(244,166,35,0.15)",
            }}
          >
            <span style={{ fontSize: "20px", lineHeight: 1 }}>🧞</span>
          </button>
          <WaiterButton restaurantId={restaurant.id} tableId={tableId} tableName={tableId ? `Mesa ${tableId}` : undefined} size={48} waiterPanelActive={showWaiter} />
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
          <CoverSlide restaurant={restaurant} chapterCount={grouped.length} />

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
                onActive={() => { setActiveRail(idx); setRailLight(palette === "cream"); trackCategoryDwell(group.category.id, 1000); }}
                onDishTap={handleDishTap}
              />
            );
          })}

          {/* ===== OUTRO ===== */}
          <OutroSlide onGenio={() => setGenioOpen(true)} onSwitchView={() => setView("lista")} />
        </div>

        {/* Genio */}
        {genioOpen && (
          <GenioOnboarding
            restaurantId={restaurant.id}
            dishes={dishes}
            categories={categories}
            qrUser={qrUser}
            onClose={() => setGenioOpen(false)}
            onResult={(dish) => {
              setGenioOpen(false);
              setTimeout(() => handleDishTap(dish), 250);
            }}
          />
        )}

        {/* Dish detail */}
        {selectedDish && (
          <DishDetail
            dish={selectedDish}
            allDishes={dishes}
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
function CoverSlide({ restaurant, chapterCount }: { restaurant: Restaurant; chapterCount: number }) {
  const words = restaurant.name.split(" ");
  const w1 = words[0] || "";
  const w2 = words.slice(1).join(" ") || "";

  return (
    <section className="vj-cover" data-section="cover">
      <div className="vj-cover-bg" />
      <div className="vj-cover-grain" />
      <div className="vj-cover-center">
        <div className="vj-cover-kicker">LA CARTA</div>
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

  const recommendedDish = dishes.find(isGeniePick);
  const bgPhoto = (recommendedDish ? getDishPhoto(recommendedDish) : null)
    || (dishes.map((d) => getDishPhoto(d)).filter(Boolean) as string[])[0]
    || null;

  return (
    <section className="vj-chapter" data-palette={palette} data-section="chapter" data-rail={index} ref={ref}>
      <div className="vj-chapter-bg" />

      {/* Single background photo */}
      {bgPhoto && (
        <div className="vj-chapter-featured">
          <Image src={bgPhoto} alt="" fill className="object-cover" sizes="100vw" />
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
          {dishCount} {dishCount === 1 ? "plato" : "platos"}
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
  const chapterNum = String(index + 1).padStart(2, "0");
  const totalSlides = group.dishes.length + 1; // +1 for chapter title slide

  // Background photo: prefer recommended dish, fallback to any dish with photo
  const recommendedDish = dishes.find(isGeniePick);
  const bgPhoto = (recommendedDish ? getDishPhoto(recommendedDish) : null)
    || (dishes.map((d) => getDishPhoto(d)).filter(Boolean) as string[])[0]
    || null;

  useInView(wrapRef, (inView) => { if (inView) onActive(); });

  // Track dish dwell when slide changes
  useEffect(() => {
    if (activeSlide > 0) {
      const dish = group.dishes[activeSlide - 1];
      if (dish) trackDishEnter(dish.id);
    } else {
      trackDishLeave();
    }
  }, [activeSlide, group.dishes]);

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
    <div className="vj-track-wrap" data-section="track" data-rail={index} ref={wrapRef}>
      {/* Top gradient for legibility */}
      {activeSlide > 0 && (
        <div className="pointer-events-none absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/60 via-black/20 to-transparent" style={{ height: 160 }} />
      )}
      {/* Header — only show on dish slides (not chapter title) */}
      {activeSlide > 0 && (
        <div className="vj-category-header">
          <button
            onClick={() => trackRef.current?.scrollTo({ left: 0, behavior: "smooth" })}
            className="vj-category-label-plain"
            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", pointerEvents: "auto", color: "white", textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}
          >
            <strong className="font-[family-name:var(--font-fraunces)]">{poetic.prefix} {poetic.accent}</strong>
          </button>
          <div className="vj-bullets-plain">
            {group.dishes.map((_, i) => (
              <div key={i} className={`vj-bullet ${i + 1 === activeSlide ? "active" : ""}`} />
            ))}
          </div>
        </div>
      )}
      <div className="vj-category-track" ref={trackRef}>
        {/* First slide: chapter title */}
        <div className="vj-slide-item vj-dish vj-chapter-slide" data-slide-idx="0" data-palette={palette} style={{
          flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 32px",
        }}>
          {/* Chapter background */}
          <div className="vj-chapter-bg" />

          {/* Single background photo */}
          {bgPhoto && (
            <div className="vj-chapter-featured">
              <Image src={bgPhoto} alt="" fill className="object-cover" sizes="100vw" />
            </div>
          )}

          <div style={{ position: "relative", zIndex: 2 }}>
            <div style={{ color: "rgba(255,255,255,0.25)", fontSize: "10px", letterSpacing: "0.5em", opacity: 1, marginBottom: 12 }}>✦ ✦ ✦</div>
            <h2 className="vj-chapter-name font-[family-name:var(--font-fraunces)]" style={{ opacity: 1, transform: "none" }}>
              {poetic.prefix}{poetic.prefix ? <br /> : ""}<em>{poetic.accent}</em>
            </h2>
            <div style={{ fontSize: "16px", letterSpacing: "0.2em", textTransform: "uppercase" as const, opacity: 0.65 }}>
              {group.dishes.length} {group.dishes.length === 1 ? "plato" : "platos"}
            </div>
          </div>

          <div style={{ position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)", fontSize: "11px", letterSpacing: "0.3em", textTransform: "uppercase" as const, opacity: 0.45 }}>
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

function VjNewBadge({ inline }: { inline?: boolean }) {
  if (inline) {
    return (
      <span style={{
        display: "inline-flex", marginLeft: 8, verticalAlign: "middle",
        background: "#e85530", color: "white",
        fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em",
        padding: "3px 8px", borderRadius: 50, textTransform: "uppercase",
      }}>
        NUEVO
      </span>
    );
  }
  return null;
}

/* =============== DISH SLIDE =============== */
function DishSlide({ dish, variant, palette, index, onClick }: {
  dish: Dish; variant: SlideVariant; palette: Palette; index: number; onClick: () => void;
}) {
  const pitch = dish.description || "";
  const genie = isGeniePick(dish);
  const isNew = dish.tags?.includes("NEW");
  const d = dish as any;
  const isRec = dish.tags?.includes("RECOMMENDED");
  const vjBadges = (
    <>
      {isRec && <span style={{ display: "inline-flex", alignItems: "center", marginLeft: 8, fontSize: "14px", verticalAlign: "middle" }}>⭐</span>}
      {isNew && <VjNewBadge inline />}
      {d.dishDiet === "VEGAN" && <span style={{ display: "inline-flex", marginLeft: 6, fontSize: "12px", verticalAlign: "middle" }}>🌿</span>}
      {d.dishDiet === "VEGETARIAN" && <span style={{ display: "inline-flex", marginLeft: 6, fontSize: "12px", verticalAlign: "middle" }}>🌱</span>}
      {d.isSpicy && <span style={{ display: "inline-flex", marginLeft: 4, fontSize: "12px", verticalAlign: "middle" }}>🌶️</span>}
    </>
  );
  const accentColor = "#F4A623";

  if (variant === "hero") {
    const longDesc = pitch.length > 60;
    const heroGradient = longDesc
      ? "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, transparent 25%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.7) 80%, rgba(0,0,0,0.8) 100%)"
      : undefined;
    return (
    <div className="vj-slide-item vj-dish vj-v-hero" data-slide-idx={index} onClick={onClick}>
      <div className="vj-hero-photo"><PhotoBg dish={dish} /></div>
      <div className="vj-hero-overlay" style={heroGradient ? { background: heroGradient } : undefined} />
      <div className="vj-hero-info">
        <span className="vj-eyebrow" style={{ color: accentColor }}>{dish.ingredients?.split(/[,;]/)[0]?.trim() || ""}</span>
        <h3 className="vj-title font-[family-name:var(--font-fraunces)]">
          <span className="vj-ln"><span>{dish.name}{vjBadges}</span></span>
        </h3>
        {pitch && <p className="vj-pitch font-[family-name:var(--font-fraunces)]">{pitch}</p>}
        <div className="vj-meta">
          <span className="vj-price font-[family-name:var(--font-fraunces)]">${dish.price?.toLocaleString("es-CL")}</span>
        </div>
      </div>
    </div>
  );}

  if (variant === "split") {
    // Split name: first word normal, rest italic gold
    const words = dish.name.split(" ");
    const firstWord = words[0];
    const restWords = words.slice(1).join(" ");
    const eyebrowText = dish.ingredients?.split(/[,;]/)[0]?.trim() || "";
    // Dynamic photo height: shorter when description is long
    const descLen = pitch.length;
    const photoHeight = descLen > 80 ? "52%" : descLen > 40 ? "57%" : "62%";
    return (
      <div className="vj-slide-item vj-dish vj-v-split" data-slide-idx={index} onClick={onClick}>
        <div className="vj-split-photo" style={{ height: photoHeight }}><PhotoBg dish={dish} /><div className="vj-split-gradient" /></div>
        <div className="vj-split-info">
          <div className="vj-split-divider" />
          {eyebrowText && <span className="vj-split-eyebrow">{eyebrowText}</span>}
          <h3 className="vj-title font-[family-name:var(--font-fraunces)]">
            <span className="vj-ln"><span>{firstWord}{restWords ? <><br /><em>{restWords}</em></> : null}{vjBadges}</span></span>
          </h3>
          {pitch && <p className="vj-pitch font-[family-name:var(--font-fraunces)]">{pitch}</p>}
          <div className="vj-split-price font-[family-name:var(--font-fraunces)]">
            <span className="vj-split-price-dot" />${dish.price?.toLocaleString("es-CL")}
          </div>
        </div>
      </div>
    );
  }

  if (variant === "light") return (
    <div
      className="vj-slide-item vj-dish vj-v-light"
      data-slide-idx={index}
      onClick={onClick}
    >
      <span className="vj-eyebrow" style={{ color: accentColor }}>{dish.tags?.includes("NEW") ? "Nuevo" : ""}</span>
      <div className="vj-photo-wrap">
        <div className="vj-photo-circle"><PhotoBg dish={dish} /></div>
      </div>
      <h3 className="vj-title font-[family-name:var(--font-fraunces)]">
        <span className="vj-ln"><span>{dish.name}{vjBadges}</span></span>
      </h3>
      {pitch && <p className="vj-pitch font-[family-name:var(--font-fraunces)]" style={{ fontSize: "22px" }}>{pitch}</p>}
      <div className="vj-meta">
        <span className="vj-price font-[family-name:var(--font-fraunces)]">
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
        <span className="vj-ln"><span>{dish.name}{vjBadges}</span></span>
      </h3>
      {pitch && <p className="vj-pitch font-[family-name:var(--font-fraunces)]">{pitch}</p>}
      <div className="vj-meta">
        <span className="vj-price font-[family-name:var(--font-fraunces)]">${dish.price?.toLocaleString("es-CL")}</span>
      </div>
    </div>
  );
}

/* =============== OUTRO =============== */
function OutroSlide({ onGenio, onSwitchView }: { onGenio: () => void; onSwitchView: () => void }) {
  return (
    <section className="vj-outro" data-section="outro">
      <div className="vj-outro-bg" />
      <div className="vj-outro-inner">
        <div style={{ fontSize: "3rem", marginBottom: 24, animation: "genioOutroFloat 2s ease-in-out infinite" }}>🧞</div>
        <h3 className="font-[family-name:var(--font-fraunces)]">
          ¿No te decides <em>qué pedir</em>?
        </h3>
        <p>El Genio te puede ayudar a elegir.</p>
        <button className="vj-outro-cta" onClick={onGenio}>Preguntar al Genio ✦</button>
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
  .vj-cover { height: 100vh; height: 100dvh; scroll-snap-align: start; scroll-snap-stop: always; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; }
  .vj-cover-bg { position: absolute; inset: -5%; background: radial-gradient(ellipse 80% 50% at 50% 30%, rgba(244,166,35,0.12) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 30% 70%, rgba(200,80,40,0.15) 0%, transparent 50%), radial-gradient(ellipse at center, #1a0a04 0%, #000 80%); animation: vj-cover-drift 20s ease-in-out infinite alternate; }
  @keyframes vj-cover-drift { 0% { transform: scale(1) translate(0,0); } 100% { transform: scale(1.1) translate(-2%,-1%); } }
  .vj-cover-grain { position: absolute; inset: 0; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/></svg>"); opacity: 0.08; mix-blend-mode: overlay; pointer-events: none; z-index: 2; }
  .vj-cover-center { position: relative; z-index: 5; text-align: center; padding: 0 24px; }
  .vj-cover-kicker { display: inline-flex; align-items: center; gap: 8px; font-size: 10px; letter-spacing: 0.4em; text-transform: uppercase; color: #F4A623; font-weight: 500; margin-bottom: 24px; opacity: 0; animation: vj-kicker-in 1s var(--vj-ease) 0.5s forwards; }
  .vj-cover-kicker::before, .vj-cover-kicker::after { content: ''; width: 24px; height: 1px; background: currentColor; opacity: 0.5; }
  @keyframes vj-kicker-in { from { opacity: 0; letter-spacing: 0.1em; } to { opacity: 1; letter-spacing: 0.4em; } }
  .vj-cover-title { font-weight: 200; font-size: clamp(80px, 22vw, 180px); line-height: 0.88; letter-spacing: -0.04em; margin-bottom: 24px; color: #f5ede0; }
  .vj-line { display: block; overflow: hidden; }
  .vj-line span { display: block; transform: translateY(110%); animation: vj-line-up 1.2s var(--vj-ease) forwards; }
  .vj-line:nth-child(2) span { animation-delay: 0.2s; }
  .vj-line:nth-child(2) span em { font-style: italic; font-weight: 300; }
  @keyframes vj-line-up { to { transform: translateY(0); } }
  .vj-cover-sub { font-style: italic; font-weight: 300; font-size: 18px; line-height: 1.35; opacity: 0; max-width: 30ch; margin: 0 auto; animation: vj-fade-up 1.2s var(--vj-ease) 0.9s forwards; color: rgba(245,237,224,0.6); }
  @keyframes vj-fade-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  .vj-cover-meta { display: flex; gap: 20px; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; opacity: 0; animation: vj-fade-up 1.2s var(--vj-ease) 1.2s forwards; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.12); }
  .vj-cover-meta strong { display: block; font-weight: 400; font-size: 22px; text-transform: none; letter-spacing: -0.01em; margin-top: 4px; }
  .vj-cover-cue { position: absolute; bottom: calc(60px + env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%); z-index: 6; font-size: 10px; letter-spacing: 0.3em; text-transform: uppercase; opacity: 0; animation: vj-fade-up 1s ease-out 2s forwards, vj-cue-float 2.5s ease-in-out 3s infinite; }
  .vj-cover-cue::after { content: ''; display: block; width: 1px; height: 24px; background: linear-gradient(180deg, rgba(255,255,255,0.5), transparent); margin: 10px auto 0; }
  @keyframes vj-cue-float { 0%,100% { transform: translateX(-50%) translateY(0); opacity: 0.4; } 50% { transform: translateX(-50%) translateY(6px); opacity: 0.9; } }

  /* ===== CHAPTER OPENING ===== */
  .vj-chapter { height: 100vh; height: 100dvh; scroll-snap-align: start; scroll-snap-stop: always; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; padding: 0 32px; }
  .vj-chapter-bg { position: absolute; inset: 0; }
  .vj-chapter[data-palette="ocean"] .vj-chapter-bg { background: radial-gradient(ellipse at 30% 40%, rgba(100,180,220,0.15) 0%, transparent 60%), radial-gradient(ellipse at 70% 70%, rgba(20,80,120,0.2) 0%, transparent 50%), linear-gradient(180deg, #061020 0%, #020810 100%); }
  .vj-chapter[data-palette="earth"] .vj-chapter-bg { background: radial-gradient(ellipse at 40% 30%, rgba(200,130,60,0.18) 0%, transparent 55%), radial-gradient(ellipse at 60% 80%, rgba(100,50,20,0.25) 0%, transparent 50%), linear-gradient(180deg, #1a0c04 0%, #0a0502 100%); }
  .vj-chapter[data-palette="fire"] .vj-chapter-bg { background: radial-gradient(ellipse at 50% 50%, rgba(244,100,40,0.2) 0%, transparent 55%), radial-gradient(ellipse at 20% 80%, rgba(200,50,10,0.25) 0%, transparent 50%), linear-gradient(180deg, #200804 0%, #080200 100%); }
  .vj-chapter[data-palette="cream"] .vj-chapter-bg { background: radial-gradient(ellipse at 40% 30%, rgba(200,130,60,0.18) 0%, transparent 55%), linear-gradient(180deg, #1a0c04 0%, #0a0502 100%); }
  .vj-chapter::before { content: ''; position: absolute; top: 50%; left: 50%; width: 0; height: 1px; background: currentColor; opacity: 0.3; transform: translate(-50%,-50%); transition: width 1.5s var(--vj-ease); }
  .vj-chapter.in-view::before { width: 60%; max-width: 400px; }
  .vj-chapter-content { text-align: center; position: relative; z-index: 2; max-width: 500px; }
  .vj-chapter-num { font-style: italic; font-weight: 300; font-size: 12px; letter-spacing: 0.4em; color: rgba(255,255,255,0.6); text-transform: uppercase; margin-bottom: 20px; opacity: 0; transform: translateY(20px); transition: all 1s var(--vj-ease) 0.3s; }
  .vj-chapter.in-view .vj-chapter-num { opacity: 1; transform: translateY(0); }
  .vj-chapter-name { font-weight: 400; font-size: clamp(44px, 13vw, 72px); line-height: 0.95; letter-spacing: -0.035em; margin: 16px 0 24px; opacity: 0; transform: translateY(40px); transition: all 1.4s var(--vj-ease) 0.6s; text-shadow: 2px 2px 0 rgba(0,0,0,0.2); }
  .vj-chapter-name em { font-style: italic; font-weight: 400; display: block; color: #F4A623; }
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
  .vj-chapter.in-view .vj-chapter-featured,
  .vj-chapter-slide.in-view .vj-chapter-featured {
    filter: blur(3px) brightness(0.4);
    opacity: 0.7;
    animation: vjBgDrift 12s ease-in-out infinite alternate;
  }
  @keyframes vjBgDrift {
    0% { transform: scale(1.05) translate(0, 0); }
    100% { transform: scale(1.15) translate(-2%, -1%); }
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
  .vj-chapter.in-view .vj-chapter-mosaic,
  .vj-chapter-slide.in-view .vj-chapter-mosaic {
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
  .vj-category-header { position: absolute; top: calc(max(12px, env(safe-area-inset-top)) + 58px); left: 16px; right: 16px; z-index: 20; display: flex; justify-content: space-between; align-items: center; pointer-events: none; }
  .vj-category-header.light { color: #2a1810; }
  .vj-category-header.light .vj-category-label { background: rgba(0,0,0,0.06); color: #3d2817; }
  .vj-category-header.light .vj-category-label strong { color: #8a4a1a; }
  .vj-category-header.light .vj-bullets { background: rgba(0,0,0,0.08); }
  .vj-category-label { font-size: 11px; letter-spacing: 0.28em; text-transform: uppercase; opacity: 1; font-weight: 600; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); padding: 6px 12px; border-radius: 50px; }
  .vj-category-label strong { font-style: italic; font-weight: 600; font-size: 14px; letter-spacing: 0.02em; text-transform: none; margin-left: 6px; }
  .vj-category-label-plain { font-size: 11px; letter-spacing: 0.28em; text-transform: uppercase; font-weight: 400; padding: 6px 0; text-align: left; }
  .vj-category-label-plain strong { font-style: italic; font-weight: 400; font-size: 14px; letter-spacing: 0.02em; text-transform: none; margin-left: 6px; }
  .vj-bullets { display: flex; gap: 4px; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); padding: 6px 10px; border-radius: 50px; }
  .vj-bullets-plain { display: flex; gap: 4px; padding: 6px 0; text-shadow: 0 1px 2px rgba(0,0,0,0.4); }
  .vj-bullet { width: 16px; height: 3px; background: rgba(255,255,255,0.6); border-radius: 3px; transition: all 0.4s ease; box-shadow: 0 1px 4px rgba(0,0,0,0.5); }
  .vj-bullet.active { background: #F4A623; width: 28px; box-shadow: 0 1px 6px rgba(244,166,35,0.5); }
  .vj-category-header.light .vj-bullet { background: rgba(0,0,0,0.25); }
  .vj-category-header.light .vj-bullet.active { background: #c93010; }

  /* ===== DISH (shared) ===== */
  .vj-dish { flex: 0 0 100%; width: 100vw; height: 100%; scroll-snap-align: start; scroll-snap-stop: always; position: relative; overflow: hidden; display: flex; }
  .vj-eyebrow { font-size: 10px; letter-spacing: 0.3em; text-transform: uppercase; opacity: 0; margin-bottom: 12px; font-weight: 500; display: inline-block; transform: translateY(20px); transition: all 1s var(--vj-ease) 0.3s; }
  .vj-dish.in-view .vj-eyebrow { opacity: 0.7; transform: translateY(0); }
  .vj-title { font-weight: 200; font-size: clamp(36px, 10vw, 52px); line-height: 0.95; letter-spacing: -0.025em; margin-bottom: 16px; }
  .vj-title em { font-style: italic; font-weight: 300; }
  .vj-title-gradient em { background: linear-gradient(135deg, #f5d4a0 0%, #e8a06a 50%, #c9785a 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .vj-ln { display: block; overflow: hidden; }
  .vj-ln span { display: inline-block; transform: translateY(110%); transition: transform 1.1s var(--vj-ease); }
  .vj-dish.in-view .vj-ln span { transform: translateY(0); }
  .vj-dish.in-view .vj-ln:nth-child(2) span { transition-delay: 0.15s; }
  .vj-pitch { font-weight: 300; font-style: italic; font-size: 19px; line-height: 1.45; opacity: 0; max-width: 32ch; margin-bottom: 24px; transform: translateY(20px); transition: all 1.1s var(--vj-ease) 0.5s; text-shadow: 0 1px 3px rgba(0,0,0,0.4); }
  .vj-dish.in-view .vj-pitch { opacity: 0.9; transform: translateY(0); }
  .vj-v-light .vj-pitch { margin-left: auto; margin-right: auto; color: #1a0e08; }
  .vj-v-spotlight .vj-pitch { margin-left: auto; margin-right: auto; }
  .vj-meta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; opacity: 0; transform: translateY(16px); transition: all 1s var(--vj-ease) 0.7s; }
  .vj-v-light .vj-meta, .vj-v-spotlight .vj-meta { justify-content: center; }
  .vj-dish.in-view .vj-meta { opacity: 1; transform: translateY(0); }
  .vj-price { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; padding: 6px 16px; border: 1px solid currentColor; border-radius: 100px; opacity: 0.92; }

  /* HERO */
  .vj-v-hero { flex-direction: column; justify-content: flex-end; }
  .vj-hero-photo { position: absolute; inset: 0; transform: scale(1.12); transition: transform 14s var(--vj-ease); }
  .vj-hero-photo img { object-fit: cover; }
  .vj-v-hero.in-view .vj-hero-photo { transform: scale(1); }
  .vj-hero-overlay { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.15) 0%, transparent 30%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.75) 100%); }
  .vj-hero-info { position: relative; z-index: 3; padding: 0 28px calc(60px + env(safe-area-inset-bottom)); width: 100%; }

  /* SPLIT */
  .vj-v-split { flex-direction: column; background: radial-gradient(ellipse at 50% 80%, rgba(244,166,35,0.08), transparent 50%), linear-gradient(180deg, #0a0604 0%, #1a0f08 100%); }
  .vj-split-photo { height: 58%; position: relative; overflow: hidden; flex-shrink: 0; }
  .vj-split-photo img { object-fit: cover; }
  .vj-split-gradient { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 40%, rgba(10,6,4,0.5) 70%, rgba(10,6,4,0.9) 100%); }
  .vj-split-info { flex: 1; padding: 0 28px calc(60px + env(safe-area-inset-bottom)); text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; z-index: 3; }
  .vj-split-divider { width: 40px; height: 1px; background: linear-gradient(90deg, transparent, #F4A623, transparent); margin-bottom: 16px; }
  .vj-split-eyebrow { font-size: 9px; letter-spacing: 0.35em; text-transform: uppercase; color: #F4A623; margin-bottom: 12px; font-weight: 600; }
  .vj-v-split .vj-title { font-weight: 200; font-size: clamp(34px, 10vw, 42px); line-height: 0.9; letter-spacing: -0.025em; color: white; margin-bottom: 14px; text-align: center; }
  .vj-v-split .vj-title em { font-style: italic; font-weight: 300; color: #F4A623; display: block; }
  .vj-v-split .vj-pitch { font-style: italic; font-weight: 300; font-size: 16px; line-height: 1.45; color: rgba(255,255,255,0.65); margin-bottom: 18px; max-width: 280px; text-align: center; margin-left: auto; margin-right: auto; }
  .vj-split-price { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; padding: 6px 14px; border: 1px solid rgba(255,255,255,0.25); border-radius: 100px; color: white; }
  .vj-split-price-dot { width: 4px; height: 4px; border-radius: 50%; background: currentColor; }

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
  @keyframes genioOutroFloat { 0%,100% { transform: translateY(0) scale(1); opacity: 0.8; } 50% { transform: translateY(-6px) scale(1.1); opacity: 1; } }

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
