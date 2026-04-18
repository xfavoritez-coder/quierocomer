"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { Search, X, User, Sparkles } from "lucide-react";
import type { Restaurant, Category, Dish, RestaurantPromotion } from "@prisma/client";
import ViewSelector from "./ViewSelector";
import { groupDishesByCategory, isGeniePick, getDishPhoto } from "./utils/dishHelpers";
import { trackCartaDishOpenedInList } from "./utils/cartaAnalytics";
import DishDetail from "./DishDetail";
import BirthdayBanner from "../capture/BirthdayBanner";
import GenioOnboarding from "../genio/GenioOnboarding";
import WaiterButton from "../garzon/WaiterButton";

interface Review {
  id: string;
  dishId: string;
  rating: number;
  customerId: string;
  createdAt: Date;
}

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
}


export default function CartaLista({
  restaurant,
  categories,
  dishes,
  promotions,
  ratingMap,
  reviews,
  tableId,
  qrUser,
  onProfileOpen,
  onReady,
  readyKey,
}: Props) {
  useEffect(() => { onReady?.(); }, [readyKey]);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id || "");
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [genioOpen, setGenioOpen] = useState(false);
  const catScrollRef = useRef<HTMLDivElement>(null);
  const activeCatRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll category nav to active
  useEffect(() => {
    if (activeCatRef.current && catScrollRef.current) {
      const container = catScrollRef.current;
      const el = activeCatRef.current;
      const offset = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
      container.scrollTo({ left: offset, behavior: "smooth" });
    }
  }, [activeCategory]);

  // Detect active category on scroll
  const handleScroll = useCallback(() => {
    for (const cat of [...categories].reverse()) {
      const el = document.getElementById(`lista-cat-${cat.id}`);
      if (el && el.getBoundingClientRect().top <= 120) {
        setActiveCategory(cat.id);
        break;
      }
    }
  }, [categories]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const sortedDishes = useMemo(() => {
    const result: Dish[] = [];
    for (const cat of [...categories].sort((a, b) => a.position - b.position)) {
      const catDishes = dishes
        .filter((d) => d.categoryId === cat.id)
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

  const filtered = useMemo(() => {
    return dishes.filter((d) => {
      if (query) {
        const q = query.toLowerCase().trim();
        return d.name?.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q) || d.ingredients?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [dishes, query]);

  const grouped = useMemo(
    () => groupDishesByCategory(filtered, categories),
    [filtered, categories],
  );

  const handleDishClick = (dish: Dish) => {
    setSelectedDish(dish);
    trackCartaDishOpenedInList(restaurant.id, dish.id, isGeniePick(dish));
  };

  return (
    <div className="min-h-screen font-[family-name:var(--font-dm)]" style={{ background: "#f7f7f5", paddingBottom: 100 }}>
      {/* TOP BAR: logo + name | vistas | perfil */}
      {/* TOP BAR: logo+nombre | vistas centradas | perfil */}
      <div style={{ padding: "12px 16px 12px", display: "flex", alignItems: "center", background: "#f7f7f5" }}>
        {/* Left: logo + name */}
        <div className="flex items-center gap-2" style={{ flex: 1, minWidth: 0 }}>
          {restaurant.logoUrl ? (
            <Image src={restaurant.logoUrl} alt={restaurant.name} width={30} height={30} className="rounded-full" style={{ flexShrink: 0 }} />
          ) : (
            <div className="flex items-center justify-center rounded-full" style={{ width: 30, height: 30, background: "#F4A623", fontSize: "0.7rem", fontWeight: 700, color: "#0e0e0e", flexShrink: 0 }}>
              {restaurant.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="font-[family-name:var(--font-dm)]" style={{ fontSize: "1.1rem", fontWeight: 600, color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {restaurant.name}
          </span>
        </div>
        {/* Center: view selector */}
        {/* Right: profile */}
        <div className="flex items-center justify-center" style={{ flex: 1, justifyContent: "flex-end" }}>
          <div onClick={onProfileOpen} className="flex items-center justify-center cursor-pointer" style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(14,14,14,0.06)" }}>
            {qrUser ? (
              <span style={{ color: "#333", fontSize: "14px", fontWeight: 700, fontFamily: "var(--font-dm)" }}>
                {(qrUser.name || qrUser.email).charAt(0).toUpperCase()}
              </span>
            ) : (
              <User size={20} color="#999" />
            )}
          </div>
        </div>
      </div>

      {/* STICKY NAV: search overlay or category tabs with search icon */}
      {searchOpen ? (
        <div
          className="sticky top-0 z-20"
          style={{ background: "#ffffff", borderBottom: "1px solid #f0f0f0", height: 44, display: "flex", alignItems: "center", padding: "0 12px", gap: 8 }}
        >
          <Search size={16} color="rgba(14,14,14,0.35)" style={{ flexShrink: 0 }} />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en la carta..."
            className="font-[family-name:var(--font-dm)]"
            style={{ flex: 1, border: "none", outline: "none", fontSize: "0.92rem", color: "#0e0e0e", background: "transparent", fontFamily: "inherit" }}
          />
          <button onClick={() => { setSearchOpen(false); setQuery(""); }} style={{ flexShrink: 0, background: "none", border: "none", padding: 4, cursor: "pointer" }}>
            <X size={18} color="rgba(14,14,14,0.4)" />
          </button>
        </div>
      ) : (
        <nav
          className="sticky top-0 z-20"
          style={{ background: "#ffffff", borderBottom: "1px solid #f0f0f0", height: 44, display: "flex", alignItems: "center" }}
        >
          {/* Search icon */}
          <div style={{ flexShrink: 0, paddingLeft: 12, paddingRight: 4, display: "flex", alignItems: "center", height: "100%" }}>
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center justify-center"
              style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(14,14,14,0.06)", border: "none", cursor: "pointer" }}
              aria-label="Buscar"
            >
              <Search size={19} color="#666" />
            </button>
          </div>
          {/* Category tabs */}
          <div
            ref={catScrollRef}
            className="flex overflow-x-auto"
            style={{ flex: 1, height: "100%", paddingLeft: 8, paddingRight: 16, gap: 20, scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
          >
            {categories.filter((c) => c.isActive).sort((a, b) => a.position - b.position).map((cat) => {
              const isActive = cat.id === activeCategory;
              return (
                <button
                  key={cat.id}
                  ref={isActive ? activeCatRef : null}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    const el = document.getElementById(`lista-cat-${cat.id}`);
                    if (el) {
                      const top = el.getBoundingClientRect().top + window.scrollY - 52;
                      window.scrollTo({ top, behavior: "smooth" });
                    }
                  }}
                  className="shrink-0 font-[family-name:var(--font-dm)]"
                  style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    padding: "0 2px",
                    fontSize: "1rem",
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? "#0e0e0e" : "#999",
                    background: "none",
                    border: "none",
                    borderBottom: isActive ? "2px solid #F4A623" : "2px solid transparent",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "color 0.15s, border-color 0.15s",
                  }}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* EMPTY STATE */}
      {grouped.length === 0 && (
        <div style={{ padding: "64px 32px", textAlign: "center" }}>
          <p style={{ color: "rgba(14,14,14,0.45)", fontSize: "0.9rem" }}>
            No encontramos platos que coincidan.
          </p>
          <button
            onClick={() => { setQuery(""); }}
            style={{ marginTop: 12, fontSize: "0.88rem", color: "#F4A623", fontWeight: 600, background: "none", border: "none", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" }}
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {/* CATEGORIES */}
      {grouped.map(({ category, dishes: catDishes }, index) => (
        <section key={category.id} id={`lista-cat-${category.id}`} style={{ padding: "20px 12px 0" }}>
          {index === 4 && <BirthdayBanner restaurantId={restaurant.id} />}
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "0 8px", marginBottom: 8 }}>
            <h2
              className="font-[family-name:var(--font-playfair)]"
              style={{ fontSize: "1.3rem", fontWeight: 700, fontStyle: "italic", color: "#0e0e0e" }}
            >
              {category.name}
            </h2>
            <span style={{ fontSize: "0.68rem", color: "rgba(14,14,14,0.35)" }}>
              {catDishes.length}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {catDishes.map((dish) => (
              <DishListCard
                key={dish.id}
                dish={dish}
                rating={ratingMap?.[dish.id]}
                onClick={() => handleDishClick(dish)}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Floating buttons */}
      <div className="fixed z-50 flex flex-col items-center" style={{ right: 12, bottom: "calc(16px + env(safe-area-inset-bottom))", gap: 8 }}>
        <button
          onClick={() => setGenioOpen(true)}
          className="flex items-center justify-center rounded-full active:scale-95 transition-transform"
          style={{ width: 52, height: 52, background: "#F4A623", boxShadow: "0 4px 18px rgba(244,166,35,0.35)" }}
        >
          <Sparkles size={22} color="white" fill="white" />
        </button>
        <WaiterButton restaurantId={restaurant.id} tableId={tableId} tableName={tableId ? `Mesa ${tableId}` : undefined} />
        <ViewSelector restaurantId={restaurant.id} />
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

      {/* DishDetail modal */}
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
  );
}



function DishListCard({
  dish,
  rating,
  onClick,
}: {
  dish: Dish;
  rating?: { avg: number; count: number };
  onClick: () => void;
}) {
  const photo = getDishPhoto(dish);
  const geniePick = isGeniePick(dish);
  const isNew = dish.tags?.includes("NEW");
  const isPromo = dish.tags?.includes("PROMOTION");

  return (
    <button
      onClick={onClick}
      className="active:scale-[0.99] transition-transform"
      style={{
        width: "100%",
        display: "flex",
        gap: 12,
        padding: 10,
        background: "white",
        borderRadius: 14,
        border: "1px solid rgba(0,0,0,0.04)",
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {photo ? (
        <div style={{ width: 120, height: 120, borderRadius: 10, overflow: "hidden", flexShrink: 0, position: "relative", background: "#f0f0f0" }}>
          <Image src={photo} alt={dish.name} fill className="object-cover" sizes="76px" />
        </div>
      ) : (
        <div style={{ width: 120, height: 120, borderRadius: 10, flexShrink: 0, background: "linear-gradient(135deg, #f7f7f5, #e8e4d8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem" }}>
          🍽
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 2 }}>
          <h3
            className="font-[family-name:var(--font-playfair)]"
            style={{ fontSize: "1.1rem", fontWeight: 600, color: "#0e0e0e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}
          >
            {dish.name}
          </h3>
        </div>
        {dish.description && (
          <p
            style={{
              fontSize: "1rem",
              color: "rgba(14,14,14,0.5)",
              lineHeight: 1.4,
              marginBottom: 6,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {dish.description}
          </p>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            className="font-[family-name:var(--font-playfair)]"
            style={{ fontSize: "1.1rem", fontWeight: 400, color: "#0e0e0e" }}
          >
            ${dish.price?.toLocaleString("es-CL") ?? "—"}
          </span>
          {dish.discountPrice && (
            <span style={{ fontSize: "0.72rem", color: "#999", textDecoration: "line-through" }}>
              ${dish.price?.toLocaleString("es-CL")}
            </span>
          )}
          {isPromo && (
            <span style={{ fontSize: "0.62rem", fontWeight: 600, padding: "2px 6px", background: "rgba(244,166,35,0.12)", color: "#F4A623", borderRadius: 4 }}>
              Promo
            </span>
          )}
          {isNew && (
            <span style={{ fontSize: "0.62rem", fontWeight: 600, padding: "2px 6px", background: "rgba(16,185,129,0.12)", color: "#059669", borderRadius: 4 }}>
              Nuevo
            </span>
          )}
          {rating && rating.count > 0 && (
            <span style={{ fontSize: "0.72rem", color: "rgba(14,14,14,0.45)" }}>
              ★ {rating.avg.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
