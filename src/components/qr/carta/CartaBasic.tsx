"use client";

import { useState, useEffect, useMemo } from "react";
import type { Restaurant, Category, Dish, RestaurantPromotion } from "@prisma/client";
import HeroDish from "./HeroDish";
import CategoryNav from "./CategoryNav";
import DishCard from "./DishCard";
import DishDetail from "./DishDetail";
import WaiterButton from "../garzon/WaiterButton";
import SortChip from "./SortChip";
import { useCartaSort, applyCartaSort } from "./hooks/useCartaSort";
import CartaFilterBar, { applyCartaFilter } from "./CartaFilterBar";
import type { CartaFilterKey } from "./CartaFilterBar";

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
  isQrScan?: boolean;
}

export default function CartaBasic({
  restaurant,
  categories,
  dishes: rawDishes,
  ratingMap,
  reviews,
  tableId,
  isQrScan,
}: CartaProps) {
  const isFree = ((restaurant as any).plan || 'FREE') === 'FREE'
  const dishes = isFree
    ? rawDishes.map((d: any) => d.tags?.includes('RECOMMENDED') ? { ...d, tags: (d.tags as string[]).filter(t => t !== 'RECOMMENDED') } : d)
    : rawDishes
  const [activeFilter, setActiveFilter] = useState<CartaFilterKey[]>([]);
  const toggleFilter = (key: CartaFilterKey) => setActiveFilter(f => f.includes(key) ? f.filter(k => k !== key) : [...f, key]);
  const dishesFiltered = useMemo(
    () => applyCartaFilter(dishes, activeFilter, new Set<string>()),
    [dishes, activeFilter],
  );
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id || "");
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const showWaiter = !!(tableId || isQrScan);
  const { sortKey, setSortKey, rankings } = useCartaSort(restaurant.id, "basic");

  const heroDishes = useMemo(() => {
    const withPhoto = (arr: Dish[]) => arr.filter(d => d.photos?.[0]);
    const isFree = ((restaurant as any).plan || 'FREE') === 'FREE'
    if (isFree) {
      const pool = withPhoto(dishes)
      if (pool.length === 0) return dishes.slice(0, 1)
      return [pool[Math.floor(Date.now() / 86400000) % pool.length]]
    }
    const rec = withPhoto(dishes.filter(d => d.tags?.includes("RECOMMENDED")));
    if (rec.length > 0) return rec;
    return withPhoto(dishes).slice(0, 3);
  }, [dishes, restaurant]);

  // IntersectionObserver-based active category detection
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    for (const cat of categories) {
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
  }, [categories]);

  return (
    <div className="min-h-screen bg-[#faf6ee] font-[family-name:var(--font-dm)]">
      <HeroDish restaurant={restaurant} heroDishes={heroDishes} />
      <CategoryNav
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        rightSlot={<SortChip sortKey={sortKey} setSortKey={setSortKey} salesMode={rankings?.sales?.mode || null} />}
      />

      {/* Filter bar — solo Gold y Premium */}
      {(restaurant as any).plan !== "FREE" && (
        <div style={{ borderBottom: "1px solid var(--carta-border, #ede9e0)", padding: "6px 14px 7px", background: "var(--carta-bg-solid, #faf6ee)" }}>
          <CartaFilterBar active={activeFilter} onToggle={toggleFilter} compact />
        </div>
      )}

      <main className="px-4 pb-28">
        {categories.map((cat) => {
          const catDishesRaw = dishesFiltered.filter((d) => d.categoryId === cat.id);
          const catDishes = sortKey !== "default"
            ? applyCartaSort(catDishesRaw, sortKey, rankings)
            : [...catDishesRaw].sort((a, b) => {
                const aRec = a.tags?.includes("RECOMMENDED") ? 0 : 1;
                const bRec = b.tags?.includes("RECOMMENDED") ? 0 : 1;
                return aRec - bRec;
              });
          if (!catDishes.length) return null;
          return (
            <section key={cat.id} id={`cat-${cat.id}`} className="pt-8">
              <h2 className="font-[family-name:var(--font-playfair)] text-xl font-bold text-[#0e0e0e] mb-1">
                {cat.name}
              </h2>
              {cat.description && (
                <p className="text-[0.9rem] text-gray-500 mb-3 font-[family-name:var(--font-dm)]">
                  {cat.description}
                </p>
              )}
              <div>
                {catDishes.map((dish) => (
                  <DishCard
                    key={dish.id}
                    dish={dish}
                    variant="basic"
                    onClick={() => setSelectedDish(dish)}
                    averageRating={ratingMap[dish.id]}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </main>

      {/* Floating buttons */}
      {showWaiter && (
        <div className="fixed z-50 flex flex-col items-center" style={{ right: 14, bottom: "calc(16px + env(safe-area-inset-bottom))" }}>
          <WaiterButton restaurantId={restaurant.id} tableId={tableId || undefined} />
        </div>
      )}

      {selectedDish && (
        <DishDetail
          dish={selectedDish}
          allDishes={dishes}
          categories={categories}
          restaurantId={restaurant.id}
          restaurantPlan={(restaurant as any).plan}
          reviews={reviews}
          ratingMap={ratingMap}
          onClose={() => setSelectedDish(null)}
          onChangeDish={setSelectedDish}
        />
      )}


    </div>
  );
}
