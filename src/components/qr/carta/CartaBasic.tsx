"use client";

import { useState, useEffect, useMemo } from "react";
import type { Restaurant, Category, Dish, RestaurantPromotion } from "@prisma/client";
import HeroDish from "./HeroDish";
import CategoryNav from "./CategoryNav";
import DishCard from "./DishCard";
import DishDetail from "./DishDetail";
import GenioOnboarding from "../genio/GenioOnboarding";
import { Sparkles } from "lucide-react";
import WaiterButton from "../garzon/WaiterButton";

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
  dishes,
  ratingMap,
  reviews,
  tableId,
  isQrScan,
}: CartaProps) {
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id || "");
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [genioOpen, setGenioOpen] = useState(false);
  const showWaiter = !!(tableId || isQrScan);

  const heroDishes = useMemo(() => {
    const rec = dishes.filter(d => d.tags?.includes("RECOMMENDED") && d.photos?.[0]);
    if (rec.length > 0) return rec;
    const withPhotos = dishes.filter(d => d.photos?.[0]);
    return [...withPhotos].sort((a, b) => a.position - b.position).slice(0, 3);
  }, [dishes]);

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
      />

      <main className="px-4 pb-28">
        {categories.map((cat) => {
          const catDishes = dishes.filter((d) => d.categoryId === cat.id).sort((a, b) => {
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
      <div className="fixed z-50 flex flex-col items-center" style={{ right: 14, bottom: "calc(54px + env(safe-area-inset-bottom))", gap: 10 }}>
        <button
          onClick={() => setGenioOpen(true)}
          className="flex items-center justify-center rounded-full active:scale-95 transition-transform"
          style={{ width: 60, height: 60, background: "#F4A623", boxShadow: "0 4px 18px rgba(244,166,35,0.35)" }}
        >
          <Sparkles size={26} color="white" />
        </button>
        {showWaiter && <WaiterButton restaurantId={restaurant.id} tableId={tableId || undefined} />}
      </div>

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


      {genioOpen && (
        <GenioOnboarding
          restaurantId={restaurant.id}
          dishes={dishes}
          categories={categories}
          onClose={() => setGenioOpen(false)}
          onResult={(dish) => {
            setGenioOpen(false);
            setTimeout(() => {
              const el = document.querySelector(`[data-dish-id="${dish.id}"]`);
              if (el) {
                const top = el.getBoundingClientRect().top + window.scrollY - 60;
                window.scrollTo({ top, behavior: "smooth" });
              }
              setTimeout(() => setSelectedDish(dish), 500);
            }, 250);
          }}
        />
      )}
    </div>
  );
}
