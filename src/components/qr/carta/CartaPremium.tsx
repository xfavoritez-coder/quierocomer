"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { Restaurant, Category, Dish, RestaurantPromotion } from "@prisma/client";
import HeroDish from "./HeroDish";
import CategoryNav from "./CategoryNav";
import DishCard from "./DishCard";
import DishDetail from "./DishDetail";
import GenioOnboarding from "../genio/GenioOnboarding";
import { Sparkles, Search, X } from "lucide-react";
import WaiterButton from "../garzon/WaiterButton";
import BirthdayBanner from "../capture/BirthdayBanner";
import ProfileDrawer from "../auth/ProfileDrawer";
import ViewSelector from "./ViewSelector";

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
}: CartaProps) {
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id || "");
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [genioOpen, setGenioOpen] = useState(false);
  const [qrUser, setQrUser] = useState<any>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showSecondVisitToast, setShowSecondVisitToast] = useState(false);
  const [showVerifiedToast, setShowVerifiedToast] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [captureEmail, setCaptureEmail] = useState("");
  const [captureStatus, setCaptureStatus] = useState<"idle" | "loading" | "success">("idle");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch user
  useEffect(() => {
    fetch("/api/qr/user/me").then((r) => r.json()).then((d) => { if (d.user) setQrUser(d.user); }).catch(() => {});
  }, []);

  // Second visit detection + verification toast
  useEffect(() => {
    const cookieKey = `qr_visited_${restaurant.id}`;
    const dismissKey = `qr_toast_dismissed_${restaurant.id}`;

    // Check verified param
    if (typeof window !== "undefined" && window.location.search.includes("verified=true")) {
      setShowVerifiedToast(true);
      setTimeout(() => setShowVerifiedToast(false), 4000);
      window.history.replaceState({}, "", window.location.pathname);
    }

    // Second visit logic
    const visited = localStorage.getItem(cookieKey);
    const dismissed = localStorage.getItem(dismissKey);
    if (visited && !dismissed && !sessionStorage.getItem("qr_capture_shown")) {
      fetch("/api/qr/user/me").then((r) => r.json()).then((d) => {
        if (!d.user) {
          setTimeout(() => setShowSecondVisitToast(true), 3000);
          sessionStorage.setItem("qr_capture_shown", "true");
        }
      }).catch(() => {});
    }
    if (!visited) localStorage.setItem(cookieKey, String(Date.now()));
  }, [restaurant.id]);

  const heroDishes = dishes.filter((d) => d.tags?.includes("RECOMMENDED"));

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

  const handleScroll = useCallback(() => {
    for (const cat of [...categories].reverse()) {
      const el = document.getElementById(`cat-${cat.id}`);
      if (el && el.getBoundingClientRect().top <= 52) {
        setActiveCategory(cat.id);
        break;
      }
    }
  }, [categories]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return (
    <div className="min-h-screen font-[family-name:var(--font-dm)]" style={{ background: "#f7f7f5" }}>
      <HeroDish restaurant={restaurant} heroDishes={heroDishes} qrUser={qrUser} onProfileOpen={() => setProfileOpen(true)} onDishSelect={setSelectedDish} viewSelectorSlot={<ViewSelector restaurantId={restaurant.id} variant="dark" />} />
      {/* Search overlay on CategoryNav */}
      {searchOpen ? (
        <div
          className="sticky top-0 z-40"
          style={{ position: "sticky", top: 0, background: "#ffffff", borderBottom: "1px solid #f0f0f0", height: 44, display: "flex", alignItems: "center", padding: "0 12px", gap: 8 }}
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
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          rightSlot={
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
              <Search size={16} color="#666" />
            </button>
          }
        />
      )}

      <main style={{ paddingBottom: 80 }}>
        {categories.map((cat, index) => {
          const catDishes = dishes
            .filter((d) => d.categoryId === cat.id)
            .filter((d) => {
              if (!searchQuery) return true;
              const q = searchQuery.toLowerCase().trim();
              return d.name?.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q) || d.ingredients?.toLowerCase().includes(q);
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
            {index === 4 && <BirthdayBanner restaurantId={restaurant.id} />}
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
                        marginLeft: i === 0 ? 20 : 17,
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
      <div className="fixed z-50 flex flex-col items-center" style={{ right: 20, bottom: 32, gap: 14 }}>
        <button
          onClick={() => setGenioOpen(true)}
          className="flex items-center justify-center rounded-full active:scale-95 transition-transform"
          style={{ width: 52, height: 52, background: "#F4A623", boxShadow: "0 4px 18px rgba(244,166,35,0.35)" }}
        >
          <Sparkles size={22} color="white" fill="white" />
        </button>
        <WaiterButton restaurantId={restaurant.id} tableId={tableId} tableName={tableId ? `Mesa ${tableId}` : undefined} />
      </div>

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
          onClose={() => setProfileOpen(false)}
          onLogout={() => { setQrUser(null); setProfileOpen(false); }}
        />
      )}

      {/* Verified toast */}
      {showVerifiedToast && (
        <div className="fixed font-[family-name:var(--font-dm)]" style={{ top: 16, left: "50%", transform: "translateX(-50%)", background: "#0a2e1a", border: "1px solid #16a34a", color: "white", padding: "10px 20px", borderRadius: 12, fontSize: "0.92rem", fontWeight: 600, zIndex: 80 }}>
          ✓ ¡Listo! Ya guardamos tus preferencias
        </div>
      )}

      {/* Second visit toast — bubble from Genio button */}
      {showSecondVisitToast && (
        <div
          className="fixed font-[family-name:var(--font-dm)]"
          style={{
            right: 16,
            bottom: 100,
            background: "rgba(20,20,20,0.95)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 14,
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            zIndex: 80,
            width: 220,
            boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
          }}
        >
          {/* Triangle pointing down to Genio button */}
          <div
            style={{
              position: "absolute",
              right: 22,
              bottom: -6,
              width: 12,
              height: 12,
              background: "rgba(20,20,20,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderTop: "none",
              borderLeft: "none",
              transform: "rotate(45deg)",
            }}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ fontSize: "1.3rem", flexShrink: 0, marginTop: 1 }}>🧞</span>
            <span style={{ color: "white", fontSize: "0.84rem", lineHeight: 1.45 }}>¿Guardamos tus gustos? Así te recomiendo mejor cada vez.</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setShowSecondVisitToast(false); setShowEmailModal(true); }} style={{ flex: 1, background: "#F4A623", color: "#0e0e0e", borderRadius: 50, padding: "8px 0", fontSize: "0.82rem", fontWeight: 700, border: "none", cursor: "pointer" }}>Sí →</button>
            <button onClick={() => { setShowSecondVisitToast(false); localStorage.setItem(`qr_toast_dismissed_${restaurant.id}`, String(Date.now())); }} style={{ background: "none", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 50, padding: "8px 12px", color: "rgba(255,255,255,0.4)", fontSize: "0.78rem", cursor: "pointer" }}>No</button>
          </div>
        </div>
      )}

      {/* Email capture modal */}
      {showEmailModal && (
        <div className="fixed flex items-center justify-center font-[family-name:var(--font-dm)]" style={{ inset: 0, zIndex: 90, background: "rgba(0,0,0,0.6)" }} onClick={() => setShowEmailModal(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 16, padding: "28px 24px", maxWidth: 340, width: "90%" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0e0e0e", textAlign: "center", marginBottom: 16 }}>Guarda tus preferencias</h3>
            {captureStatus === "success" ? (
              <p style={{ textAlign: "center", color: "#16a34a", fontSize: "0.95rem", fontWeight: 600 }}>✓ Revisa tu correo 📬</p>
            ) : (
              <>
                <input type="email" value={captureEmail} onChange={(e) => setCaptureEmail(e.target.value)} placeholder="tu@email.com" style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid #eee", fontSize: "1rem", outline: "none" }} />
                <button onClick={async () => {
                  if (!captureEmail) return;
                  setCaptureStatus("loading");
                  await fetch("/api/qr/user/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: captureEmail, dietType: localStorage.getItem("qr_diet"), restrictions: localStorage.getItem("qr_restrictions") ? JSON.parse(localStorage.getItem("qr_restrictions")!) : [], restaurantId: restaurant.id, source: "second_visit" }) });
                  setCaptureStatus("success");
                }} style={{ width: "100%", marginTop: 10, padding: "12px", borderRadius: 50, background: "#0e0e0e", color: "white", fontSize: "0.95rem", fontWeight: 700, border: "none", opacity: captureStatus === "loading" ? 0.5 : 1 }}>
                  {captureStatus === "loading" ? "Enviando..." : "Guardar →"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
