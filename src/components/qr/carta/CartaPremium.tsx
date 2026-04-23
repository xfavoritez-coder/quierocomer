"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { Restaurant, Category, Dish, RestaurantPromotion } from "@prisma/client";
import HeroDish from "./HeroDish";
import CategoryNav from "./CategoryNav";
import DishCard from "./DishCard";
import DishDetail from "./DishDetail";
import GenioOnboarding from "../genio/GenioOnboarding";
import { Sparkles, Search, X } from "lucide-react";
import WaiterButton from "../garzon/WaiterButton";
import BirthdayBanner from "../capture/BirthdayBanner";
import { norm } from "@/lib/normalize";
import ProfileDrawer from "../auth/ProfileDrawer";
import ViewSelector from "./ViewSelector";
import GenioTip from "../genio/GenioTip";
import { getGuestId } from "@/lib/guestId";
import { trackDishEnter, trackDishLeave, trackCategoryDwell } from "@/lib/sessionTracker";
import { trackSearchPerformed } from "./utils/cartaAnalytics";
import PromoCarousel from "../capture/PromoCarousel";
import ExperienceBanner from "../capture/ExperienceBanner";

interface Review {
  id: string;
  dishId: string;
  rating: number;
  customerId: string;
  createdAt: Date;
}

interface CartaProps {
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
  marketingPromos?: any[];
}

function ScrollFade({ color = "#f7f7f5" }: { color?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(true);

  useEffect(() => {
    const el = scrollRef.current?.parentElement?.querySelector("[data-scroll-container]") as HTMLElement | null;
    if (!el) return;
    const check = () => {
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 10;
      setShowFade(!atEnd);
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    return () => el.removeEventListener("scroll", check);
  }, []);

  return (
    <div
      ref={scrollRef}
      className="absolute top-0 right-0 pointer-events-none"
      style={{
        width: 30,
        height: "100%",
        background: showFade ? `linear-gradient(to right, transparent, ${color}80)` : "transparent",
        zIndex: 1,
        transition: "background 0.2s",
      }}
    />
  );
}

export default function CartaPremium({
  restaurant,
  categories,
  dishes,
  ratingMap,
  reviews,
  tableId,
  qrUser: qrUserProp,
  onProfileOpen: onProfileOpenProp,
  onReady,
  readyKey,
  showWaiter,
  marketingPromos,
}: CartaProps) {
  const hasPromos = marketingPromos && marketingPromos.length > 0;
  const [activeCategory, setActiveCategory] = useState(hasPromos ? "promos" : (categories[0]?.id || ""));
  const [genioExpanded, setGenioExpanded] = useState(false);
  const lastScrollY = useRef(0);
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const nearBottom = y + window.innerHeight >= document.documentElement.scrollHeight - 200;
        setGenioExpanded(y < lastScrollY.current && y > 100 && !nearBottom);
        lastScrollY.current = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const catStartRef = useRef<{ id: string; start: number }>({ id: categories[0]?.id || "", start: Date.now() });

  // Track category dwell time when active category changes
  useEffect(() => {
    const prev = catStartRef.current;
    if (prev.id && prev.id !== activeCategory) {
      const dwellMs = Date.now() - prev.start;
      if (dwellMs > 1000) trackCategoryDwell(prev.id, dwellMs);
    }
    catStartRef.current = { id: activeCategory, start: Date.now() };
  }, [activeCategory]);

  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [genioOpen, setGenioOpen] = useState(false);
  const [qrUserLocal, setQrUserLocal] = useState<any>(null);
  const [profileOpenLocal, setProfileOpenLocal] = useState(false);
  const qrUser = qrUserProp ?? qrUserLocal;
  const profileOpen = onProfileOpenProp ? false : profileOpenLocal;
  const handleProfileOpen = onProfileOpenProp ?? (() => setProfileOpenLocal(true));

  useEffect(() => { onReady?.(); }, [readyKey]);

  const [showVerifiedModal, setShowVerifiedModal] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("verified") === "1") {
      setShowVerifiedModal(true);
      // Clean URL without reload
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const [birthdayCountdown, setBirthdayCountdown] = useState<number | null>(null);

  const [showSecondVisitToast, setShowSecondVisitToast] = useState(false);
  const [showVerifiedToast, setShowVerifiedToast] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [captureName, setCaptureName] = useState("");
  const [captureEmail, setCaptureEmail] = useState("");
  const [captureStatus, setCaptureStatus] = useState<"idle" | "loading" | "success">("idle");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Track search with debounce
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      const q = norm(searchQuery.trim());
      const count = dishes.filter((d) => norm(d.name || "").includes(q) || norm(d.description || "").includes(q) || norm(d.ingredients || "").includes(q)).length;
      trackSearchPerformed(restaurant.id, q, count);
    }, 500);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery, dishes, restaurant.id]);

  // Single fetch for user data — used for birthday countdown, second visit detection, and local user state
  useEffect(() => {
    const cookieKey = `qr_visited_${restaurant.id}`;
    const dismissKey = `qr_toast_dismissed_${restaurant.id}`;

    // Check verified param
    if (typeof window !== "undefined" && window.location.search.includes("verified=true")) {
      setShowVerifiedToast(true);
      setTimeout(() => setShowVerifiedToast(false), 4000);
      window.history.replaceState({}, "", window.location.pathname);
    }

    // Determine if second visit check is needed
    const visited = localStorage.getItem(cookieKey);
    const dismissed = localStorage.getItem(dismissKey);
    const hasPrefs = localStorage.getItem("qr_diet") || localStorage.getItem("qr_restrictions");
    const viewTipNotSeen = !localStorage.getItem("quierocomer_carta_view_tooltip_shown");
    const needsSecondVisitCheck = visited && !dismissed && hasPrefs && !viewTipNotSeen && !sessionStorage.getItem("qr_capture_shown");

    if (!visited) localStorage.setItem(cookieKey, String(Date.now()));

    // Single fetch for all user-related data
    fetch("/api/qr/user/me")
      .then((r) => r.json())
      .then((d) => {
        // Set local user state if not provided via prop
        if (qrUserProp === undefined && d.user) {
          setQrUserLocal(d.user);
        }

        // Birthday countdown
        if (d.user?.birthDate) {
          const today = new Date();
          const birth = new Date(d.user.birthDate);
          const thisYear = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
          if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1);
          const days = Math.ceil((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (days <= 30) setBirthdayCountdown(days);
        }

        // Second visit detection
        if (needsSecondVisitCheck && !d.user) {
          setTimeout(() => setShowSecondVisitToast(true), 3000);
          sessionStorage.setItem("qr_capture_shown", "true");
        }
      })
      .catch(() => {});
  }, [restaurant.id, qrUserProp]);

  const recommended = dishes.filter((d) => d.tags?.includes("RECOMMENDED"));
  const heroDishes = recommended.length > 0
    ? recommended
    : [...dishes]
        .filter(d => d.photos?.[0])
        .sort((a, b) => (ratingMap[b.id]?.avg || 0) - (ratingMap[a.id]?.avg || 0))
        .slice(0, 3);

  // Build sorted dish list matching carta visual order (category by category, recommended first)
  const sortedDishes = useMemo(() => {
    const result: Dish[] = [];
    for (const cat of categories) {
      const catDishes = dishes
        .filter((d) => d.categoryId === cat.id && d.isActive)
        .sort((a, b) => {
          const aRec = a.tags?.includes("RECOMMENDED") ? 1 : 0;
          const bRec = b.tags?.includes("RECOMMENDED") ? 1 : 0;
          if (aRec !== bRec) return bRec - aRec;
          return a.position - b.position;
        });
      result.push(...catDishes);
    }
    return result;
  }, [categories, dishes]);

  // IntersectionObserver-based active category detection
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const allCats = hasPromos
      ? [{ id: "promos" }, ...categories]
      : categories;
    for (const cat of allCats) {
      const el = document.getElementById(`cat-${cat.id}`);
      if (!el) continue;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveCategory(cat.id);
        },
        { rootMargin: "-80px 0px -80% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    }
    return () => observers.forEach(obs => obs.disconnect());
  }, [categories, hasPromos]);

  return (
    <div className="min-h-screen font-[family-name:var(--font-dm)]" style={{ background: "#f7f7f5" }}>
      <HeroDish restaurant={restaurant} heroDishes={heroDishes} qrUser={qrUser} onProfileOpen={handleProfileOpen} onDishSelect={setSelectedDish} />

      {/* Search overlay on CategoryNav */}
      {searchOpen ? (
        <div
          className="sticky top-0 z-40"
          style={{ position: "sticky", top: 0, background: "#f7f7f5", borderBottom: "1px solid #f0f0f0", height: 44, display: "flex", alignItems: "center", padding: "0 12px", gap: 8 }}
        >
          <Search size={16} color="rgba(14,14,14,0.35)" style={{ flexShrink: 0 }} />
          <input
            autoFocus
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar en la carta..."
            className="font-[family-name:var(--font-dm)]"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: "0.92rem",
              color: "#0e0e0e",
              background: "transparent",
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
            style={{ flexShrink: 0, background: "none", border: "none", padding: 4, cursor: "pointer" }}
          >
            <X size={18} color="rgba(14,14,14,0.4)" />
          </button>
        </div>
      ) : (
        <CategoryNav
          categories={hasPromos ? [{ id: "promos", name: "Ofertas", position: -1, isActive: true, restaurantId: "", description: null, createdAt: new Date(), updatedAt: new Date() } as any, ...categories] : categories}
          activeCategory={activeCategory}
          onCategoryChange={(id) => { setActiveCategory(id); if (id === "promos") { const el = document.getElementById("cat-promos"); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 54, behavior: "smooth" }); } }}
          leftSlot={
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center justify-center"
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "rgba(14,14,14,0.06)",
                border: "none",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              aria-label="Buscar"
            >
              <Search size={19} color="#666" />
            </button>
          }
        />
      )}

      <main style={{ paddingBottom: 55 }}>
        {/* Ofertas section — inside main as first "category" */}
        {hasPromos && (
          <div id="cat-promos" style={{ paddingTop: 16 }}>
            <PromoCarousel restaurantId={restaurant.id} initialPromos={marketingPromos} onViewDish={(dishId) => {
              const dish = dishes.find(d => d.id === dishId);
              if (dish) setSelectedDish(dish);
            }} />
          </div>
        )}

        {searchQuery && !categories.some((cat) => dishes.some((d) => d.categoryId === cat.id && (norm(d.name || "").includes(norm(searchQuery.trim())) || norm(d.description || "").includes(norm(searchQuery.trim())) || norm(d.ingredients || "").includes(norm(searchQuery.trim()))))) && (
          <div className="font-[family-name:var(--font-dm)]" style={{ padding: "64px 32px", textAlign: "center" }}>
            <span style={{ fontSize: "2rem", display: "block", marginBottom: 12 }}>🔍</span>
            <p style={{ color: "rgba(14,14,14,0.45)", fontSize: "0.95rem" }}>
              No encontramos platos con &ldquo;{searchQuery}&rdquo;
            </p>
            <button
              onClick={() => { setSearchQuery(""); }}
              className="font-[family-name:var(--font-dm)]"
              style={{ marginTop: 12, fontSize: "0.88rem", color: "#F4A623", fontWeight: 600, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
            >
              Limpiar búsqueda
            </button>
          </div>
        )}
        {categories.map((cat, index) => {
          const catDishes = dishes
            .filter((d) => d.categoryId === cat.id)
            .filter((d) => {
              if (!searchQuery) return true;
              const q = norm(searchQuery.trim());
              return norm(d.name || "").includes(q) || norm(d.description || "").includes(q) || norm(d.ingredients || "").includes(q);
            })
            .sort((a, b) => {
              const aRec = a.tags?.includes("RECOMMENDED") ? 1 : 0;
              const bRec = b.tags?.includes("RECOMMENDED") ? 1 : 0;
              if (aRec !== bRec) return bRec - aRec;
              return 0;
            });
          if (!catDishes.length) return null;

          return (
            <div key={cat.id}>
            {index === Math.max(2, Math.floor(categories.length * 0.4)) && <ExperienceBanner restaurantId={restaurant.id} />}
            {index === Math.max(4, Math.floor(categories.length * 0.75)) && <BirthdayBanner restaurantId={restaurant.id} restaurantName={restaurant.name} />}
            <section id={`cat-${cat.id}`} style={{ paddingTop: index === 0 ? 16 : 32 }}>
              {/* Title */}
              <div style={{ padding: "0 20px", marginBottom: 12 }}>
                <h2
                  className="font-[family-name:var(--font-playfair)]"
                  style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0e0e0e" }}
                >
                  {cat.name}
                </h2>
                {cat.description && cat.description.length <= 60 && (
                  <p
                    className="font-[family-name:var(--font-dm)] truncate"
                    style={{ fontSize: "0.8rem", color: "#bbb", marginTop: 2 }}
                  >
                    {cat.description}
                  </p>
                )}
              </div>

              {/* Scroll with fade */}
              <div className="relative">
                <div
                  data-scroll-container
                  className="flex overflow-x-auto snap-x snap-mandatory items-start"
                  style={{
                    paddingBottom: 8,
                    scrollPaddingLeft: 20,
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  {catDishes.map((dish, i) => {
                    return (
                    <div
                      key={dish.id}
                      data-dish-id={dish.id}
                      style={{
                        width: dish.tags?.includes("RECOMMENDED") ? 185 : 165,
                        minWidth: dish.tags?.includes("RECOMMENDED") ? 185 : 165,
                        flexShrink: 0,
                        scrollSnapAlign: "start",
                        marginLeft: i === 0 ? 20 : 16,
                        marginRight: i === catDishes.length - 1 ? 20 : 0,
                      }}
                    >
                      <DishCard
                        dish={dish}
                        variant="premium"
                        onClick={() => setSelectedDish(dish)}
                        averageRating={ratingMap[dish.id]}
                      />
                    </div>
                    );
                  })}
                </div>
                <ScrollFade />
              </div>
            </section>
            </div>
          );
        })}
      </main>

      {birthdayCountdown !== null && (
        <div
          className="font-[family-name:var(--font-dm)]"
          style={{
            margin: "0 20px 12px", padding: "12px 16px",
            background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
            border: "1px solid rgba(244,166,35,0.2)", borderRadius: 12,
            display: "flex", alignItems: "center", gap: 10,
          }}
        >
          <span style={{ fontSize: "1.2rem" }}>🎁</span>
          <span style={{ fontSize: "0.82rem", color: "#92400e", fontWeight: 600 }}>
            {birthdayCountdown === 0 ? "¡Hoy es tu cumpleaños! 🎉" : `Tu regalo llega en ${birthdayCountdown} día${birthdayCountdown !== 1 ? "s" : ""}`}
          </span>
        </div>
      )}

      {/* Genio nudge */}
      <div
        className="font-[family-name:var(--font-dm)]"
        style={{
          margin: "12px 20px 16px", padding: "24px 20px", textAlign: "center",
          background: "linear-gradient(135deg, #FFF7E8 0%, #FFEDD0 100%)",
          border: "1px solid rgba(244,166,35,0.2)", borderRadius: 20,
        }}
      >
        <div style={{ display: "inline-flex", width: 52, height: 52, borderRadius: "50%", background: "#F4A623", boxShadow: "0 4px 12px rgba(244,166,35,0.3)", alignItems: "center", justifyContent: "center", marginBottom: 14, fontSize: "1.5rem" }}>
          🧞
        </div>
        <h3 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "17px", fontWeight: 600, color: "#0e0e0e", margin: "0 0 4px" }}>¿No sabes qué pedir en {restaurant.name}?</h3>
        <p style={{ fontSize: "12.5px", color: "#8a5a2c", margin: "0 0 18px" }}>El Genio conoce cada plato y puede ayudarte</p>
        <button
          onClick={() => setGenioOpen(true)}
          className="active:scale-[0.97] transition-transform"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "#F4A623",
            color: "white", padding: "12px 24px", borderRadius: 100,
            fontSize: "13.5px", fontWeight: 600, border: "none", cursor: "pointer",
            boxShadow: "0 8px 20px rgba(244,166,35,0.3)", fontFamily: "inherit",
          }}
        >
          Preguntar al Genio
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
        </button>
      </div>

      {/* Powered by footer */}
      <footer
        className="font-[family-name:var(--font-dm)]"
        style={{
          paddingBottom: 100,
          paddingTop: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
        }}
      >
        <a
          href="https://quierocomer.cl/qr"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            textDecoration: "none",
          }}
        >
          <span style={{ color: "#bbb", fontSize: "0.72rem", fontWeight: 500 }}>Powered by</span>
          <span
            className="font-[family-name:var(--font-playfair)]"
            style={{ color: "#999", fontSize: "0.82rem", fontWeight: 700 }}
          >
            QuieroComer<span style={{ color: "#F4A623" }}>.cl</span>
          </span>
        </a>
        <span style={{ color: "#ccc", fontSize: "0.62rem" }}>© {new Date().getFullYear()}</span>
      </footer>

      {/* Floating buttons */}
      {/* Floating buttons — Genio separate to avoid pushing others */}
      <div className="fixed z-50 flex flex-col items-end" style={{ right: 12, bottom: "calc(24px + env(safe-area-inset-bottom))", gap: 8 }}>
        {/* Second visit toast positioned above all floating buttons */}
        {showSecondVisitToast && (
          <div style={{ width: 240, marginBottom: 4 }}>
            <GenioTip
              arrow="bottom-right"
              onClose={() => { setShowSecondVisitToast(false); localStorage.setItem(`qr_toast_dismissed_${restaurant.id}`, String(Date.now())); }}
            >
              <span>¿Guardamos tus gustos? Así te recomiendo mejor cada vez.</span>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => { setShowSecondVisitToast(false); setShowEmailModal(true); }} style={{ flex: 1, background: "#F4A623", color: "white", borderRadius: 50, padding: "8px 0", fontSize: "0.82rem", fontWeight: 700, border: "none", cursor: "pointer" }}>Sí →</button>
                <button onClick={() => { setShowSecondVisitToast(false); localStorage.setItem(`qr_toast_dismissed_${restaurant.id}`, String(Date.now())); }} style={{ background: "none", border: "1px solid #e8e0d6", borderRadius: 50, padding: "8px 12px", color: "#999", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}>No</button>
              </div>
            </GenioTip>
          </div>
        )}
        <button
          onClick={() => setGenioOpen(true)}
          className="flex items-center justify-center rounded-full active:scale-95"
          style={{ height: 52, width: genioExpanded ? "auto" : 52, background: "#F4A623", boxShadow: "0 4px 18px rgba(244,166,35,0.35)", padding: genioExpanded ? "0 18px 0 14px" : "0", borderRadius: 50, gap: 4, transition: "width 0.3s ease, padding 0.3s ease", overflow: "hidden" }}
        >
          <span style={{ fontSize: "22px", lineHeight: 1, flexShrink: 0, animation: "genioFabFloat 1.5s ease-in-out infinite" }}>🧞</span>
          {genioExpanded && <span className="font-[family-name:var(--font-dm)]" style={{ fontSize: "0.82rem", fontWeight: 600, color: "white", whiteSpace: "nowrap", position: "relative", top: -1 }}>¿Qué comer?</span>}
        </button>
        <WaiterButton restaurantId={restaurant.id} tableId={tableId} tableName={tableId ? `Mesa ${tableId}` : undefined} waiterPanelActive={showWaiter} />
        <ViewSelector restaurantId={restaurant.id} />
      </div>
      <style>{`@keyframes genioFabFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }`}</style>

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

      {genioOpen && (
        <GenioOnboarding
          restaurantId={restaurant.id}
          dishes={dishes}
          categories={categories}
          qrUser={qrUser}
          onClose={() => setGenioOpen(false)}
          onResult={(dish) => {
            setGenioOpen(false);
            // Scroll to dish then open detail
            setTimeout(() => {
              const el = document.querySelector(`[data-dish-id="${dish.id}"]`);
              if (el) {
                // Scroll to the section title, not the card
                const section = el.closest("section");
                const target = section || el;
                const top = target.getBoundingClientRect().top + window.scrollY - 48;
                window.scrollTo({ top, behavior: "smooth" });
              }
              setTimeout(() => setSelectedDish(dish), 500);
            }, 250);
          }}
        />
      )}

      {/* Profile drawer */}
      {profileOpen && (
        <ProfileDrawer
          qrUser={qrUser}
          restaurantId={restaurant.id}
          onClose={() => setProfileOpenLocal(false)}
          onLogout={() => { setQrUserLocal(null); setProfileOpenLocal(false); }}
        />
      )}

      {/* Verified toast */}
      {showVerifiedToast && (
        <div className="fixed font-[family-name:var(--font-dm)]" style={{ top: 16, left: "50%", transform: "translateX(-50%)", background: "#0a2e1a", border: "1px solid #16a34a", color: "white", padding: "10px 20px", borderRadius: 12, fontSize: "0.92rem", fontWeight: 600, zIndex: 80 }}>
          ✓ ¡Listo! Ya guardamos tus preferencias
        </div>
      )}

      {/* Second visit toast moved inside floating buttons container above */}

      {/* Verified celebration modal */}
      {showVerifiedModal && (
        <div
          className="fixed inset-0 flex items-center justify-center font-[family-name:var(--font-dm)]"
          style={{ zIndex: 200, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowVerifiedModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white", borderRadius: 20, padding: "36px 28px",
              maxWidth: 340, width: "90%", textAlign: "center",
              boxShadow: "0 25px 60px rgba(0,0,0,0.2)",
              animation: "bdaySlideIn 0.4s cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            <span style={{ fontSize: "3rem", display: "block", marginBottom: 12 }}>🎉</span>
            <h3
              className="font-[family-name:var(--font-playfair)]"
              style={{ fontSize: "1.3rem", fontWeight: 800, color: "#0e0e0e", lineHeight: 1.3, margin: "0 0 8px" }}
            >
              ¡Listo, ya estás registrado!
            </h3>
            <p style={{ fontSize: "0.88rem", color: "#666", lineHeight: 1.5, margin: "0 0 20px" }}>
              Recibirás un regalo especial en tu cumpleaños. El Genio ahora te conoce y te recomendará mejor.
            </p>
            <button
              onClick={() => setShowVerifiedModal(false)}
              className="active:scale-[0.97] transition-transform"
              style={{
                background: "#F4A623", color: "white", border: "none",
                borderRadius: 50, padding: "12px 28px", fontSize: "0.92rem",
                fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                boxShadow: "0 4px 14px rgba(244,166,35,0.3)",
              }}
            >
              ¡Genial! 🧞
            </button>
          </div>
        </div>
      )}

      {/* Email capture modal */}
      {showEmailModal && (
        <div
          className="fixed flex items-center justify-center font-[family-name:var(--font-dm)]"
          style={{ inset: 0, zIndex: 90, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowEmailModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: 20,
              padding: "32px 24px 28px",
              maxWidth: 360,
              width: "90%",
              boxShadow: "0 25px 60px rgba(0,0,0,0.2)",
              position: "relative",
            }}
          >
            {/* Close */}
            <button
              onClick={() => setShowEmailModal(false)}
              style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={18} color="#ccc" />
            </button>

            {captureStatus === "success" ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <span style={{ fontSize: "2.8rem", display: "block", marginBottom: 14 }}>🧞</span>
                <h3
                  className="font-[family-name:var(--font-playfair)]"
                  style={{ fontSize: "1.3rem", fontWeight: 800, color: "#0e0e0e", marginBottom: 8 }}
                >
                  ¡Listo{captureName ? `, ${captureName}` : ""}!
                </h3>
                <p style={{ color: "#888", fontSize: "0.9rem", lineHeight: 1.5 }}>
                  Tus gustos quedaron guardados. La próxima vez te recomendaré mejor.
                </p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                  <span style={{ fontSize: "2.4rem", display: "block", marginBottom: 10 }}>🧞</span>
                  <h3
                    className="font-[family-name:var(--font-playfair)]"
                    style={{ fontSize: "1.3rem", fontWeight: 800, color: "#0e0e0e", lineHeight: 1.2 }}
                  >
                    Guarda tus gustos
                  </h3>
                  <p style={{ fontSize: "0.85rem", color: "#888", marginTop: 6, lineHeight: 1.5 }}>
                    Así el Genio te recomienda mejor cada vez
                  </p>
                </div>

                {/* Form */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <input
                    type="text"
                    value={captureName}
                    onChange={(e) => setCaptureName(e.target.value)}
                    placeholder="Tu nombre"
                    style={{
                      background: "#f9f9f7", border: "1px solid #eee", borderRadius: 10,
                      padding: "12px 16px", color: "#0e0e0e", fontSize: "0.92rem",
                      outline: "none", fontFamily: "inherit",
                    }}
                  />
                  <input
                    type="email"
                    value={captureEmail}
                    onChange={(e) => setCaptureEmail(e.target.value)}
                    placeholder="tu@email.com"
                    style={{
                      background: "#f9f9f7", border: "1px solid #eee", borderRadius: 10,
                      padding: "12px 16px", color: "#0e0e0e", fontSize: "0.92rem",
                      outline: "none", fontFamily: "inherit",
                    }}
                  />
                  <button
                    className="active:scale-[0.98] transition-transform"
                    onClick={async () => {
                      if (!captureEmail || !captureName) return;
                      setCaptureStatus("loading");
                      const res = await fetch("/api/qr/user/register", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          email: captureEmail,
                          name: captureName || null,
                          dietType: localStorage.getItem("qr_diet"),
                          restrictions: localStorage.getItem("qr_restrictions") ? JSON.parse(localStorage.getItem("qr_restrictions")!) : [],
                          restaurantId: restaurant.id,
                          source: "second_visit",
                          guestId: getGuestId(),
                        }),
                      });
                      const data = await res.json();
                      if (data.userId) {
                        document.cookie = `qr_user_id=${data.userId};path=/;max-age=${60 * 60 * 24 * 365}`;
                      }
                      setCaptureStatus("success");
                    }}
                    style={{
                      width: "100%", marginTop: 4, background: "#F4A623", color: "white",
                      borderRadius: 50, padding: "13px 20px", fontSize: "0.95rem", fontWeight: 700,
                      border: "none", fontFamily: "inherit", cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(244,166,35,0.3)",
                      opacity: captureStatus === "loading" ? 0.6 : 1,
                    }}
                  >
                    {captureStatus === "loading" ? "Guardando..." : "Guardar"}
                  </button>
                </div>

                <p style={{ textAlign: "center", fontSize: "0.75rem", color: "#bbb", marginTop: 12 }}>
                  🔒 Solo usaremos tu email para recordar tus gustos
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
