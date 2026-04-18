"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { Search, X, Sparkles, User } from "lucide-react";
import type { Restaurant, Category, Dish, RestaurantPromotion } from "@prisma/client";
import ViewSelector from "./ViewSelector";
import { useEffect } from "react";
import { groupDishesByCategory, isGeniePick, getDishPhoto } from "./utils/dishHelpers";
import { trackCartaDishOpenedInList } from "./utils/cartaAnalytics";
import DishDetail from "./DishDetail";
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
}

type Filter = "all" | "genie";

export default function CartaLista({
  restaurant,
  categories,
  dishes,
  promotions,
  ratingMap,
  reviews,
  tableId,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [genioOpen, setGenioOpen] = useState(false);

  const hasGeniePicks = useMemo(
    () => dishes.some((d) => isGeniePick(d)),
    [dishes],
  );

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
      if (filter === "genie" && !isGeniePick(d)) return false;
      if (query) {
        const q = query.toLowerCase().trim();
        const matches =
          d.name?.toLowerCase().includes(q) ||
          d.description?.toLowerCase().includes(q) ||
          d.ingredients?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [dishes, query, filter]);

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
      <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f7f7f5" }}>
        <div className="flex items-center gap-2" style={{ flex: 1, minWidth: 0 }}>
          {restaurant.logoUrl ? (
            <Image src={restaurant.logoUrl} alt={restaurant.name} width={30} height={30} className="rounded-full" style={{ flexShrink: 0 }} />
          ) : (
            <div className="flex items-center justify-center rounded-full" style={{ width: 30, height: 30, background: "#F4A623", fontSize: "0.7rem", fontWeight: 700, color: "#0e0e0e", flexShrink: 0 }}>
              {restaurant.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="font-[family-name:var(--font-dm)]" style={{ fontSize: "1rem", fontWeight: 400, color: "#0e0e0e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {restaurant.name}
          </span>
        </div>
        <div className="flex items-center" style={{ gap: 8 }}>
          <ViewSelector restaurantId={restaurant.id} variant="light" />
          <div className="flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(14,14,14,0.06)" }}>
            <User size={15} color="#999" />
          </div>
        </div>
      </div>

      {/* STICKY NAV: buscador + filtros */}
      <nav
        className="sticky top-0 z-20"
        style={{
          background: "rgba(247,247,245,0.95)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          padding: "8px 16px",
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", marginBottom: hasGeniePicks ? 8 : 0 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(14,14,14,0.35)" }} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en la carta..."
            inputMode="search"
            style={{
              width: "100%", paddingLeft: 36, paddingRight: 36, paddingTop: 9, paddingBottom: 9,
              fontSize: "0.88rem", background: "white", borderRadius: 50,
              border: "1px solid rgba(0,0,0,0.08)", outline: "none", fontFamily: "inherit", color: "#0e0e0e",
            }}
          />
          {query && (
            <button onClick={() => setQuery("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", padding: 4, cursor: "pointer" }} aria-label="Limpiar búsqueda">
              <X size={15} color="rgba(14,14,14,0.4)" />
            </button>
          )}
        </div>

        {/* Filters */}
        {hasGeniePicks && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }}>
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>Todos</FilterChip>
            <FilterChip active={filter === "genie"} onClick={() => setFilter("genie")}>
              <Sparkles size={11} strokeWidth={2} color={filter === "genie" ? "white" : "#F4A623"} fill={filter === "genie" ? "white" : "#F4A623"} />
              El Genio recomienda
            </FilterChip>
          </div>
        )}
      </nav>

      {/* EMPTY STATE */}
      {grouped.length === 0 && (
        <div style={{ padding: "64px 32px", textAlign: "center" }}>
          <p style={{ color: "rgba(14,14,14,0.45)", fontSize: "0.9rem" }}>
            No encontramos platos que coincidan.
          </p>
          <button
            onClick={() => { setQuery(""); setFilter("all"); }}
            style={{ marginTop: 12, fontSize: "0.88rem", color: "#F4A623", fontWeight: 600, background: "none", border: "none", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" }}
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {/* CATEGORIES */}
      {grouped.map(({ category, dishes: catDishes }) => (
        <section key={category.id} style={{ padding: "20px 12px 0" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "0 8px", marginBottom: 8 }}>
            <h2
              className="font-[family-name:var(--font-playfair)]"
              style={{ fontSize: "1.1rem", fontWeight: 700, fontStyle: "italic", color: "#0e0e0e" }}
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

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "6px 14px",
        borderRadius: 50,
        fontSize: "0.75rem",
        fontWeight: 500,
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
        border: `1px solid ${active ? "#0e0e0e" : "rgba(0,0,0,0.08)"}`,
        background: active ? "#0e0e0e" : "white",
        color: active ? "white" : "rgba(14,14,14,0.65)",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 0.15s",
      }}
    >
      {children}
    </button>
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
        <div style={{ width: 76, height: 76, borderRadius: 10, overflow: "hidden", flexShrink: 0, position: "relative", background: "#f0f0f0" }}>
          <Image src={photo} alt={dish.name} fill className="object-cover" sizes="76px" />
        </div>
      ) : (
        <div style={{ width: 76, height: 76, borderRadius: 10, flexShrink: 0, background: "linear-gradient(135deg, #f7f7f5, #e8e4d8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem" }}>
          🍽
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 2 }}>
          <h3
            className="font-[family-name:var(--font-playfair)]"
            style={{ fontSize: "0.95rem", fontWeight: 600, color: "#0e0e0e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}
          >
            {dish.name}
          </h3>
          {geniePick && (
            <span
              style={{ flexShrink: 0, width: 7, height: 7, borderRadius: "50%", marginTop: 6, background: "#F4A623" }}
              aria-label="Recomendado por el Genio"
            />
          )}
        </div>
        {dish.description && (
          <p
            style={{
              fontSize: "0.78rem",
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
            style={{ fontSize: "0.88rem", fontWeight: 600, color: "#0e0e0e" }}
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
