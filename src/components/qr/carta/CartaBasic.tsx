"use client";

import { useState, useEffect, useCallback } from "react";
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
}

export default function CartaBasic({
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

  const heroDishes = dishes.filter((d) => d.tags?.includes("RECOMMENDED"));

  const handleScroll = useCallback(() => {
    for (const cat of [...categories].reverse()) {
      const el = document.getElementById(`cat-${cat.id}`);
      if (el && el.getBoundingClientRect().top <= 66) {
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
    <div className="min-h-screen bg-[#faf6ee] font-[family-name:var(--font-dm)]">
      <HeroDish restaurant={restaurant} heroDishes={heroDishes} />
      <CategoryNav
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />

      <main className="px-4 pb-28">
        {categories.map((cat) => {
          const catDishes = dishes.filter((d) => d.categoryId === cat.id);
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
      <div className="fixed z-50 flex flex-col items-center" style={{ right: 20, bottom: 32, gap: 14 }}>
        <button
          onClick={() => setGenioOpen(true)}
          className="flex items-center justify-center rounded-full active:scale-95 transition-transform"
          style={{ width: 52, height: 52, background: "#F4A623", boxShadow: "0 4px 18px rgba(244,166,35,0.35)" }}
        >
          <Sparkles size={22} color="white" />
        </button>
        <WaiterButton restaurantId={restaurant.id} tableId={tableId} tableName={tableId ? `Mesa ${tableId}` : undefined} />
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
