"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import Image from "next/image";
import type { Restaurant, Category, Dish, RestaurantPromotion } from "@prisma/client";
import { groupDishesByCategory, isGeniePick, getDishPhoto } from "./utils/dishHelpers";
import DishDetail from "./DishDetail";
import ViewSelector from "./ViewSelector";

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

type SlideVariant = "hero" | "light" | "split" | "spotlight";

function getVariant(dish: Dish, indexInCategory: number): SlideVariant {
  if (isGeniePick(dish)) return "spotlight";
  const cycle: SlideVariant[] = ["hero", "light", "split"];
  return cycle[indexInCategory % 3];
}

function getCategoryTheme(name: string) {
  const n = name.toLowerCase();
  if (n.includes("mar") || n.includes("pescado") || n.includes("mariscos") || n.includes("ceviche") || n.includes("chirashi"))
    return { bg: "#060a12", accent: "#7fa8c5", particles: "steam", navMode: "dark" as const };
  if (n.includes("parrilla") || n.includes("fuego") || n.includes("carne") || n.includes("brasa") || n.includes("hot"))
    return { bg: "#0f0604", accent: "#e8703a", particles: "ember", navMode: "dark" as const };
  if (n.includes("postre") || n.includes("dulce") || n.includes("helado"))
    return { bg: "#f8e4cc", accent: "#c9583a", particles: "none", navMode: "light" as const };
  if (n.includes("roll") || n.includes("sushi") || n.includes("nikkei") || n.includes("california"))
    return { bg: "#0a0e14", accent: "#90c0d8", particles: "steam", navMode: "dark" as const };
  return { bg: "#1a1210", accent: "#d4a574", particles: "gold-dust", navMode: "dark" as const };
}

// Deterministic gradient from dish ID
function placeholderGradient(id: string) {
  const hash = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue = (hash * 37) % 40 + 20; // warm tones 20-60
  return `radial-gradient(ellipse at ${30 + (hash % 40)}% ${25 + (hash % 30)}%, hsl(${hue}, 50%, 55%) 0%, transparent 50%), radial-gradient(ellipse at ${50 + (hash % 20)}% ${50 + (hash % 20)}%, hsl(${hue + 15}, 40%, 35%) 0%, hsl(${hue}, 30%, 15%) 100%)`;
}

export default function CartaViaje({ restaurant, categories, dishes, ratingMap, reviews, tableId }: Props) {
  const grouped = useMemo(() => groupDishesByCategory(dishes, categories), [dishes, categories]);
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [activeCategory, setActiveCategory] = useState(-1);
  const [navLight, setNavLight] = useState(false);
  const journeyRef = useRef<HTMLDivElement>(null);

  // Build sorted dishes for DishDetail navigation
  const sortedDishes = useMemo(() => {
    const result: Dish[] = [];
    for (const g of grouped) result.push(...g.dishes);
    return result;
  }, [grouped]);

  return (
    <>
      <style>{VIAJE_CSS}</style>
      <div className="viaje-root">
        {/* Nav */}
        <nav className={`viaje-nav ${navLight ? "light" : ""}`}>
          <span className="viaje-brand font-[family-name:var(--font-fraunces)]">
            {restaurant.name}
          </span>
          <ViewSelector restaurantId={restaurant.id} variant={navLight ? "light" : "dark"} />
        </nav>

        {/* Vertical rail */}
        <CategoryRail total={grouped.length} active={activeCategory} light={navLight} />

        {/* Journey */}
        <div className="viaje-journey" ref={journeyRef}>
          {/* Intro */}
          <IntroSlide restaurant={restaurant} groups={grouped} onActive={() => { setActiveCategory(-1); setNavLight(false); }} />

          {/* Categories */}
          {grouped.map((group, idx) => (
            <CategorySection
              key={group.category.id}
              group={group}
              index={idx}
              total={grouped.length}
              restaurantId={restaurant.id}
              onActive={() => {
                setActiveCategory(idx);
                setNavLight(getCategoryTheme(group.category.name).navMode === "light");
              }}
              onDishTap={setSelectedDish}
            />
          ))}

          {/* Outro */}
          <OutroSlide onActive={() => { setActiveCategory(-1); setNavLight(false); }} />
        </div>

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

/* ============ SUBCOMPONENTS ============ */

function CategoryRail({ total, active, light }: { total: number; active: number; light: boolean }) {
  return (
    <div className={`viaje-rail ${light ? "light" : ""}`}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`viaje-rail-dot ${i === active ? "active" : ""}`} />
      ))}
    </div>
  );
}

function IntroSlide({ restaurant, groups, onActive }: { restaurant: Restaurant; groups: ReturnType<typeof groupDishesByCategory>; onActive: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useInViewTrigger(ref, onActive);

  return (
    <section className="viaje-section">
      <div className="viaje-track">
        <div className="viaje-slide viaje-intro" ref={ref}>
          <div className="viaje-intro-bg" />
          <div className="viaje-intro-inner">
            <div className="viaje-eyebrow viaje-anim viaje-up">{restaurant.address || "Carta QR Viva"}</div>
            <h1 className="viaje-intro-title font-[family-name:var(--font-fraunces)]">
              <span className="viaje-line-mask"><span className="viaje-anim viaje-reveal-line viaje-d1">{restaurant.name}</span></span>
            </h1>
            <p className="viaje-anim viaje-up viaje-d3" style={{ fontSize: 15, opacity: 0.65, maxWidth: 280, margin: "0 auto 28px", lineHeight: 1.55, fontWeight: 300 }}>
              {groups.length} capítulos. {groups.reduce((a, g) => a + g.dishes.length, 0)} platos. Una historia.
            </p>
            <div className="viaje-intro-chapters viaje-anim viaje-up viaje-d4">
              {groups.map((g, i) => (
                <span key={g.category.id}>
                  <small>{String(i + 1).padStart(2, "0")}</small> {g.category.name}
                </span>
              ))}
            </div>
          </div>
          <div className="viaje-intro-cue">Desliza ↓</div>
        </div>
      </div>
    </section>
  );
}

function CategorySection({
  group, index, total, restaurantId, onActive, onDishTap,
}: {
  group: ReturnType<typeof groupDishesByCategory>[0];
  index: number;
  total: number;
  restaurantId: string;
  onActive: () => void;
  onDishTap: (dish: Dish) => void;
}) {
  const theme = getCategoryTheme(group.category.name);
  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeDish, setActiveDish] = useState(0);
  const [hintHidden, setHintHidden] = useState(false);

  useInViewTrigger(sectionRef, onActive);

  // Observe horizontal slides
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const slides = track.querySelectorAll(".viaje-slide");
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && e.intersectionRatio > 0.6) {
          const el = e.target as HTMLElement;
          // Animate in
          slides.forEach((s) => { if (s !== el) s.classList.remove("in-view"); });
          el.classList.add("in-view");
          const idx = parseInt(el.dataset.dishIdx || "0");
          setActiveDish(idx);
          if (idx > 0) setHintHidden(true);
        }
      });
    }, { root: track, threshold: [0.6] });
    slides.forEach((s) => obs.observe(s));
    if (slides[0]) slides[0].classList.add("in-view");
    return () => obs.disconnect();
  }, []);

  const isLight = theme.navMode === "light";
  const chapterNum = String(index + 1).padStart(2, "0");

  return (
    <section
      className="viaje-section"
      ref={sectionRef}
      style={{ background: theme.bg }}
    >
      {/* Category header */}
      <div className={`viaje-cat-header ${isLight ? "light" : ""}`}>
        <div className="viaje-cat-label">
          Capítulo {chapterNum} · <strong className="font-[family-name:var(--font-fraunces)]">{group.category.name}</strong>
        </div>
        <div className="viaje-cat-progress">
          {group.dishes.map((_, i) => (
            <div key={i} className={`viaje-bullet ${i === activeDish ? "active" : ""}`} />
          ))}
        </div>
      </div>

      {/* Swipe hint */}
      {group.dishes.length > 1 && !hintHidden && (
        <div className="viaje-swipe-hint">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
          Desliza
        </div>
      )}

      {/* Horizontal track */}
      <div className="viaje-track" ref={trackRef}>
        {group.dishes.map((dish, i) => (
          <DishSlide
            key={dish.id}
            dish={dish}
            variant={getVariant(dish, i)}
            theme={theme}
            index={i}
            onClick={() => onDishTap(dish)}
          />
        ))}
      </div>
    </section>
  );
}

function DishSlide({
  dish, variant, theme, index, onClick,
}: {
  dish: Dish;
  variant: SlideVariant;
  theme: ReturnType<typeof getCategoryTheme>;
  index: number;
  onClick: () => void;
}) {
  const photo = getDishPhoto(dish);
  const ref = useRef<HTMLDivElement>(null);
  const genie = isGeniePick(dish);
  const pitch = dish.description || "";

  // Particles
  useEffect(() => {
    const el = ref.current?.querySelector(".viaje-particles");
    if (!el) return;
    const type = genie ? "gold-dust" : theme.particles;
    if (type === "none") return;
    const count = type === "ember" ? 10 : type === "gold-dust" ? 14 : 5;
    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      p.className = `viaje-particle viaje-${type}`;
      p.style.left = `${Math.random() * 100}%`;
      const dur = type === "ember" ? 2.5 + Math.random() * 2.5 : type === "gold-dust" ? 7 + Math.random() * 6 : 5 + Math.random() * 4;
      p.style.animationDuration = `${dur}s`;
      p.style.animationDelay = `${-Math.random() * dur}s`;
      el.appendChild(p);
    }
    return () => { el.innerHTML = ""; };
  }, [genie, theme.particles]);

  const photoEl = photo ? (
    <Image src={photo} alt={dish.name} fill className="object-cover" sizes="100vw" />
  ) : (
    <div style={{ position: "absolute", inset: 0, background: placeholderGradient(dish.id) }} />
  );

  if (variant === "hero") return (
    <div className="viaje-slide viaje-slide-hero" data-dish-idx={index} ref={ref} onClick={onClick}>
      <div className="viaje-hero-bg">{photoEl}</div>
      <div className="viaje-particles" />
      <div className="viaje-hero-gradient" />
      <div className="viaje-hero-content">
        <div className="viaje-eyebrow viaje-anim viaje-up" style={{ color: theme.accent }}>{dish.ingredients ? dish.ingredients.split(/[,;]/)[0]?.trim() : ""}</div>
        <h2 className="viaje-dish-title font-[family-name:var(--font-fraunces)] viaje-anim">
          <span className="viaje-line-mask"><span className="viaje-anim viaje-reveal-line viaje-d1">{dish.name}</span></span>
        </h2>
        {pitch && <p className="viaje-pitch font-[family-name:var(--font-fraunces)] viaje-anim viaje-up viaje-d3">{pitch}</p>}
        <div className="viaje-meta viaje-anim viaje-up viaje-d4">
          <span className="viaje-price-chip font-[family-name:var(--font-fraunces)]">${dish.price?.toLocaleString("es-CL")}</span>
        </div>
      </div>
    </div>
  );

  if (variant === "light") {
    const isLightBg = theme.navMode === "light";
    return (
      <div
        className="viaje-slide viaje-slide-light"
        data-dish-idx={index}
        ref={ref}
        onClick={onClick}
        style={{
          background: isLightBg ? theme.bg : "radial-gradient(ellipse at 30% 20%, #fff8ee 0%, transparent 50%), linear-gradient(180deg, #f8f0e0 0%, #ebddc4 100%)",
          color: "#2a1810",
        }}
      >
        <div className="viaje-eyebrow viaje-anim viaje-up" style={{ color: theme.accent }}>{dish.tags?.includes("NEW") ? "Nuevo" : ""}</div>
        <div className="viaje-circle-wrap viaje-anim viaje-scale viaje-d1">
          <div className="viaje-photo-circle">{photoEl}</div>
        </div>
        <h2 className="viaje-dish-title font-[family-name:var(--font-fraunces)] viaje-anim">
          <span className="viaje-line-mask"><span className="viaje-anim viaje-reveal-line viaje-d2">{dish.name}</span></span>
        </h2>
        {pitch && <p className="viaje-pitch font-[family-name:var(--font-fraunces)] viaje-anim viaje-up viaje-d3">{pitch}</p>}
        <div className="viaje-meta viaje-anim viaje-up viaje-d4" style={{ color: "#5a3d20" }}>
          <span className="viaje-price-chip font-[family-name:var(--font-fraunces)]" style={{ borderColor: "#3d2817", color: "#3d2817" }}>
            ${dish.price?.toLocaleString("es-CL")}
          </span>
        </div>
      </div>
    );
  }

  if (variant === "split") return (
    <div className="viaje-slide viaje-slide-split" data-dish-idx={index} ref={ref} onClick={onClick}>
      <div className="viaje-split-photo">{photoEl}<div className="viaje-particles" /></div>
      <div className="viaje-split-text" style={{ background: theme.bg }}>
        <div className="viaje-eyebrow viaje-anim viaje-up" style={{ color: theme.accent }}>{dish.allergens || ""}</div>
        <h2 className="viaje-dish-title font-[family-name:var(--font-fraunces)] viaje-anim" style={{ color: "white" }}>
          <span className="viaje-line-mask"><span className="viaje-anim viaje-reveal-line viaje-d1">{dish.name}</span></span>
        </h2>
        {pitch && <p className="viaje-pitch font-[family-name:var(--font-fraunces)] viaje-anim viaje-up viaje-d3" style={{ color: "white", opacity: 0.72 }}>{pitch}</p>}
        <div className="viaje-meta viaje-anim viaje-up viaje-d4" style={{ color: "white" }}>
          <span className="viaje-price-chip font-[family-name:var(--font-fraunces)]">${dish.price?.toLocaleString("es-CL")}</span>
        </div>
      </div>
    </div>
  );

  // spotlight (Genio)
  return (
    <div className="viaje-slide viaje-slide-spotlight" data-dish-idx={index} ref={ref} onClick={onClick} style={{ background: `radial-gradient(ellipse at 50% 40%, ${theme.bg} 0%, #050302 80%)` }}>
      <div className="viaje-particles" />
      <div className="viaje-genie-badge viaje-anim viaje-down">El Genio elige</div>
      <div className="viaje-spot-wrap viaje-anim viaje-scale viaje-d1">
        <div className="viaje-spot-photo">{photoEl}</div>
      </div>
      <h2 className="viaje-dish-title viaje-dish-title-gradient font-[family-name:var(--font-fraunces)] viaje-anim">
        <span className="viaje-line-mask"><span className="viaje-anim viaje-reveal-line viaje-d2">{dish.name}</span></span>
      </h2>
      {pitch && <p className="viaje-pitch font-[family-name:var(--font-fraunces)] viaje-anim viaje-up viaje-d3">{pitch}</p>}
      <div className="viaje-meta viaje-anim viaje-up viaje-d4">
        <span className="viaje-price-chip font-[family-name:var(--font-fraunces)]">${dish.price?.toLocaleString("es-CL")}</span>
      </div>
    </div>
  );
}

function OutroSlide({ onActive }: { onActive: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useInViewTrigger(ref, onActive);

  return (
    <section className="viaje-section">
      <div className="viaje-track">
        <div className="viaje-slide viaje-outro" ref={ref}>
          <div className="viaje-outro-bg" />
          <div className="viaje-outro-inner">
            <h3 className="font-[family-name:var(--font-fraunces)] viaje-anim viaje-up">
              Hasta aquí llega el <em>recorrido</em>.
            </h3>
            <p className="viaje-anim viaje-up viaje-d1">Ahora sí: ¿qué vas a pedir?</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============ HOOKS ============ */

function useInViewTrigger(ref: React.RefObject<HTMLElement | null>, callback: () => void) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) callback(); },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, callback]);
}

/* ============ CSS ============ */

const VIAJE_CSS = `
  .viaje-root { position: relative; background: black; color: white; font-family: var(--font-dm), 'Inter Tight', sans-serif; -webkit-font-smoothing: antialiased; overflow: hidden; user-select: none; }

  /* Nav */
  .viaje-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; padding: max(12px, env(safe-area-inset-top)) 20px 12px; display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.55); backdrop-filter: blur(24px) saturate(180%); -webkit-backdrop-filter: blur(24px) saturate(180%); border-bottom: 1px solid rgba(255,255,255,0.06); transition: all 0.6s cubic-bezier(0.4,0,0.2,1); }
  .viaje-nav.light { background: rgba(255,255,255,0.72); border-bottom-color: rgba(0,0,0,0.06); color: #1d1d1f; }
  .viaje-brand { font-weight: 500; font-size: 16px; letter-spacing: -0.01em; }

  /* Journey */
  .viaje-journey { height: 100vh; height: 100dvh; overflow-y: scroll; scroll-snap-type: y mandatory; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
  .viaje-journey::-webkit-scrollbar { display: none; }

  /* Section = one category (vertical snap) */
  .viaje-section { height: 100vh; height: 100dvh; scroll-snap-align: start; scroll-snap-stop: always; position: relative; overflow: hidden; }

  /* Track = horizontal slides inside a section */
  .viaje-track { display: flex; height: 100%; width: 100%; overflow-x: scroll; scroll-snap-type: x mandatory; scrollbar-width: none; -webkit-overflow-scrolling: touch; overscroll-behavior-x: contain; }
  .viaje-track::-webkit-scrollbar { display: none; }

  /* Slide = one dish (horizontal snap) */
  .viaje-slide { flex: 0 0 100%; width: 100vw; height: 100%; scroll-snap-align: start; scroll-snap-stop: always; position: relative; overflow: hidden; display: flex; cursor: pointer; }

  /* Rail */
  .viaje-rail { position: fixed; left: 10px; top: 50%; transform: translateY(-50%); z-index: 50; display: flex; flex-direction: column; gap: 8px; pointer-events: none; }
  .viaje-rail-dot { width: 3px; height: 14px; background: rgba(255,255,255,0.22); border-radius: 2px; transition: all 0.5s cubic-bezier(0.4,0,0.2,1); }
  .viaje-rail-dot.active { background: white; height: 28px; }
  .viaje-rail.light .viaje-rail-dot { background: rgba(0,0,0,0.2); }
  .viaje-rail.light .viaje-rail-dot.active { background: #1d1d1f; }

  /* Category header */
  .viaje-cat-header { position: absolute; top: calc(max(12px, env(safe-area-inset-top)) + 56px); left: 20px; right: 20px; z-index: 20; display: flex; justify-content: space-between; align-items: center; pointer-events: none; }
  .viaje-cat-label { display: flex; align-items: center; gap: 10px; font-size: 10.5px; letter-spacing: 0.3em; text-transform: uppercase; font-weight: 500; opacity: 0.85; }
  .viaje-cat-label::before { content: ''; width: 14px; height: 1px; background: currentColor; opacity: 0.5; }
  .viaje-cat-label strong { font-weight: 400; font-style: italic; font-size: 14px; letter-spacing: 0; text-transform: none; opacity: 0.9; }
  .viaje-cat-header.light { color: #3d2817; }

  /* Bullets */
  .viaje-cat-progress { display: flex; gap: 4px; }
  .viaje-bullet { width: 16px; height: 2px; background: rgba(255,255,255,0.3); border-radius: 2px; transition: all 0.4s cubic-bezier(0.4,0,0.2,1); }
  .viaje-bullet.active { background: white; width: 24px; }
  .viaje-cat-header.light .viaje-bullet { background: rgba(0,0,0,0.25); }
  .viaje-cat-header.light .viaje-bullet.active { background: #1d1d1f; }

  /* Swipe hint */
  .viaje-swipe-hint { position: absolute; top: 50%; right: 20px; transform: translateY(-50%); z-index: 15; font-size: 9.5px; letter-spacing: 0.3em; text-transform: uppercase; opacity: 0.5; pointer-events: none; display: flex; flex-direction: column; align-items: center; gap: 8px; animation: viaje-swipe-pulse 2.5s ease-in-out infinite; }
  .viaje-swipe-hint svg { animation: viaje-swipe-x 1.8s ease-in-out infinite; }
  @keyframes viaje-swipe-pulse { 0%,100% { opacity: 0.3; } 50% { opacity: 0.8; } }
  @keyframes viaje-swipe-x { 0%,100% { transform: translateX(0); } 50% { transform: translateX(6px); } }

  /* Common elements */
  .viaje-eyebrow { font-size: 10.5px; letter-spacing: 0.35em; text-transform: uppercase; font-weight: 500; opacity: 0.8; }
  .viaje-dish-title { font-weight: 200; font-size: clamp(42px, 12vw, 62px); line-height: 0.92; letter-spacing: -0.03em; margin-bottom: 16px; }
  .viaje-dish-title em { font-style: italic; font-weight: 300; }
  .viaje-dish-title-gradient em { background: linear-gradient(135deg, #f5d4a0 0%, #e8a06a 50%, #c9785a 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .viaje-pitch { font-weight: 300; font-style: italic; font-size: 17px; line-height: 1.42; opacity: 0.82; max-width: 28ch; margin-bottom: 24px; }
  .viaje-meta { display: flex; align-items: center; gap: 14px; font-size: 12px; opacity: 0.7; }
  .viaje-price-chip { display: inline-flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 500; padding: 7px 16px; border: 1px solid currentColor; border-radius: 100px; opacity: 0.92; letter-spacing: -0.01em; }
  .viaje-price-chip::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: currentColor; opacity: 0.8; }
  .viaje-line-mask { display: block; overflow: hidden; line-height: 1; padding-bottom: 0.08em; }

  /* Animations */
  .viaje-slide.in-view .viaje-anim { opacity: 1; transform: translate(0,0) scale(1) rotate(0); filter: blur(0); }
  .viaje-anim { opacity: 0; transition: opacity 1.1s cubic-bezier(0.16,1,0.3,1), transform 1.2s cubic-bezier(0.16,1,0.3,1), filter 1.1s cubic-bezier(0.16,1,0.3,1); }
  .viaje-up { transform: translateY(40px); }
  .viaje-down { transform: translateY(-20px); }
  .viaje-scale { transform: scale(0.9); filter: blur(4px); }
  .viaje-reveal-line { transform: translateY(110%); display: inline-block; }
  .viaje-d1 { transition-delay: 0.12s; }
  .viaje-d2 { transition-delay: 0.28s; }
  .viaje-d3 { transition-delay: 0.44s; }
  .viaje-d4 { transition-delay: 0.6s; }
  .viaje-d5 { transition-delay: 0.76s; }

  /* INTRO */
  .viaje-intro { flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 0 24px; background: radial-gradient(ellipse at center, #1a1210 0%, #000 80%); }
  .viaje-intro-bg { position: absolute; inset: 0; background: radial-gradient(circle at 30% 20%, rgba(212,165,116,0.2), transparent 40%), radial-gradient(circle at 70% 80%, rgba(232,112,58,0.15), transparent 40%); animation: viaje-breathe 8s ease-in-out infinite; }
  @keyframes viaje-breathe { 0%,100% { opacity: 0.7; transform: scale(1); } 50% { opacity: 1; transform: scale(1.1); } }
  .viaje-intro-inner { position: relative; z-index: 2; }
  .viaje-intro-title { font-weight: 200; font-size: clamp(48px, 14vw, 88px); line-height: 0.88; letter-spacing: -0.04em; margin-bottom: 22px; }
  .viaje-intro-chapters { display: flex; flex-direction: column; gap: 6px; max-width: 200px; margin: 0 auto; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; opacity: 0.45; font-weight: 400; }
  .viaje-intro-chapters span { display: flex; justify-content: space-between; }
  .viaje-intro-cue { position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%); font-size: 9.5px; letter-spacing: 0.35em; opacity: 0.4; text-transform: uppercase; animation: viaje-cue-bounce 2.8s ease-in-out infinite; z-index: 3; }
  @keyframes viaje-cue-bounce { 0%,100% { opacity: 0.3; } 50% { opacity: 0.9; } }

  /* HERO slide */
  .viaje-slide-hero { flex-direction: column; justify-content: flex-end; }
  .viaje-hero-bg { position: absolute; inset: 0; transform: scale(1.12); transition: transform 14s cubic-bezier(0.16,1,0.3,1); }
  .viaje-hero-bg img { object-fit: cover; }
  .viaje-slide-hero.in-view .viaje-hero-bg { transform: scale(1); }
  .viaje-hero-gradient { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(6,10,18,0.2) 0%, transparent 35%, rgba(6,10,18,0.65) 70%, rgba(6,10,18,0.98) 100%); z-index: 1; }
  .viaje-hero-content { position: relative; z-index: 3; padding: 0 28px 80px; }

  /* LIGHT slide */
  .viaje-slide-light { flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 120px 24px 60px; }
  .viaje-circle-wrap { position: relative; width: min(66vw, 300px); aspect-ratio: 1; margin-bottom: 32px; z-index: 2; }
  .viaje-circle-wrap::before { content: ''; position: absolute; inset: -18px; border-radius: 50%; border: 1px solid rgba(138,90,44,0.22); animation: viaje-rotate 40s linear infinite; }
  .viaje-circle-wrap::after { content: ''; position: absolute; inset: -34px; border-radius: 50%; border: 1px dashed rgba(138,90,44,0.18); animation: viaje-rotate 60s linear infinite reverse; }
  @keyframes viaje-rotate { 0% { transform: rotate(0); } 100% { transform: rotate(360deg); } }
  .viaje-photo-circle { position: relative; width: 100%; height: 100%; border-radius: 50%; overflow: hidden; box-shadow: 0 40px 80px -20px rgba(60,30,0,0.25), 0 0 0 8px rgba(255,255,255,0.5); }
  .viaje-photo-circle img { object-fit: cover; }

  /* SPLIT slide */
  .viaje-slide-split { flex-direction: column; }
  .viaje-split-photo { flex: 1; min-height: 50vh; position: relative; overflow: hidden; }
  .viaje-split-photo img { object-fit: cover; }
  .viaje-split-text { padding: 24px 28px calc(60px + env(safe-area-inset-bottom)); position: relative; z-index: 3; flex-shrink: 0; color: white; }

  /* SPOTLIGHT (Genio) */
  .viaje-slide-spotlight { flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 120px 24px 60px; color: white; }
  .viaje-spot-wrap { position: relative; width: min(72vw, 320px); aspect-ratio: 1; margin-bottom: 32px; z-index: 2; }
  .viaje-spot-wrap::before { content: ''; position: absolute; inset: -60px; background: radial-gradient(circle, rgba(232,130,60,0.35) 0%, rgba(212,140,60,0.15) 40%, transparent 70%); filter: blur(40px); animation: viaje-halo-pulse 5s ease-in-out infinite; z-index: -1; }
  @keyframes viaje-halo-pulse { 0%,100% { opacity: 0.7; transform: scale(1); } 50% { opacity: 1; transform: scale(1.15); } }
  .viaje-spot-wrap::after { content: ''; position: absolute; inset: -12px; border-radius: 50%; border: 1px solid rgba(232,112,58,0.3); animation: viaje-rotate 50s linear infinite; }
  .viaje-spot-photo { width: 100%; height: 100%; border-radius: 50%; overflow: hidden; box-shadow: 0 0 0 1px rgba(255,255,255,0.1), 0 40px 80px -20px rgba(0,0,0,0.8); }
  .viaje-spot-photo img { object-fit: cover; }

  /* Genie badge */
  .viaje-genie-badge { display: inline-flex; align-items: center; gap: 10px; padding: 7px 16px; background: rgba(232,112,58,0.14); border: 1px solid rgba(232,112,58,0.45); border-radius: 100px; font-size: 10px; letter-spacing: 0.28em; text-transform: uppercase; color: #e8a06a; font-weight: 500; backdrop-filter: blur(10px); margin-bottom: 28px; z-index: 2; position: relative; }
  .viaje-genie-badge::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: #ff8040; box-shadow: 0 0 14px #ff6020, 0 0 28px #e8703a; animation: viaje-pulse 2s ease-in-out infinite; }
  @keyframes viaje-pulse { 0%,100% { opacity: 0.7; transform: scale(1); } 50% { opacity: 1; transform: scale(1.25); } }

  /* OUTRO */
  .viaje-outro { flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 0 24px; background: radial-gradient(ellipse at center, #1a1210 0%, #000 80%); }
  .viaje-outro-bg { position: absolute; inset: 0; background: radial-gradient(circle at 50% 30%, rgba(232,112,58,0.12), transparent 50%); animation: viaje-breathe 6s ease-in-out infinite; }
  .viaje-outro-inner { position: relative; z-index: 2; }
  .viaje-outro-inner h3 { font-weight: 200; font-style: italic; font-size: clamp(32px, 8vw, 44px); line-height: 1.1; margin-bottom: 18px; letter-spacing: -0.015em; }
  .viaje-outro-inner h3 em { font-style: normal; font-weight: 300; background: linear-gradient(135deg, #f5d4a0 0%, #e8703a 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .viaje-outro-inner p { opacity: 0.55; font-size: 15px; font-weight: 300; }

  /* Particles */
  .viaje-particles { position: absolute; inset: 0; pointer-events: none; z-index: 2; }
  .viaje-steam { position: absolute; bottom: -20px; width: 40px; height: 40px; background: radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%); border-radius: 50%; animation: viaje-rise 5s ease-in infinite; opacity: 0; }
  @keyframes viaje-rise { 0% { transform: translateY(0) scale(0.5); opacity: 0; } 20% { opacity: 0.55; } 100% { transform: translateY(-80vh) scale(2); opacity: 0; } }
  .viaje-gold-dust { position: absolute; width: 3px; height: 3px; background: #d4a574; border-radius: 50%; box-shadow: 0 0 6px #d4a574; animation: viaje-drift 9s linear infinite; opacity: 0; }
  @keyframes viaje-drift { 0% { transform: translate(0, 100%) scale(0); opacity: 0; } 10% { opacity: 0.8; transform: translate(10px, 80%) scale(1); } 90% { opacity: 0.6; } 100% { transform: translate(40px, -20%) scale(0.5); opacity: 0; } }
  .viaje-ember { position: absolute; width: 4px; height: 4px; background: #ff6a1a; border-radius: 50%; box-shadow: 0 0 10px #ff6a1a, 0 0 20px #e8703a; animation: viaje-ember-rise 3.5s ease-out infinite; opacity: 0; }
  @keyframes viaje-ember-rise { 0% { transform: translate(0,0) scale(0); opacity: 0; } 15% { opacity: 1; transform: translate(5px, -10vh) scale(1); } 100% { transform: translate(-20px, -100vh) scale(0.3); opacity: 0; } }

  /* Reduce motion */
  @media (prefers-reduced-motion: reduce) {
    .viaje-particle, .viaje-steam, .viaje-ember, .viaje-gold-dust { display: none; }
    .viaje-anim { transition-duration: 0.1s; }
    .viaje-intro-bg, .viaje-outro-bg { animation: none; }
  }
`;
