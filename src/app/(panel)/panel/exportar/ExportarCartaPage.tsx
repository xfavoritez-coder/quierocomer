"use client";

import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import SkeletonLoading from "@/components/admin/SkeletonLoading";
import ExportarCarta from "@/components/exportar/ExportarCarta";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
}

interface Category {
  id: string;
  name: string;
  position: number;
}

interface Dish {
  id: string;
  name: string;
  description: string | null;
  price: number;
  discountPrice: number | null;
  photos: string[];
  categoryId: string;
  position: number;
}

const F = "var(--font-display)";

export default function ExportarCartaPage() {
  const { selectedRestaurantId, loading: sessionLoading } = useAdminSession();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isPaid, setIsPaid] = useState(false);

  useEffect(() => {
    if (!selectedRestaurantId) return;
    setLoading(true);
    setError(false);
    fetch(`/api/admin/exportar?restaurantId=${selectedRestaurantId}`)
      .then((r) => {
        if (!r.ok) throw new Error("fetch error");
        return r.json();
      })
      .then((data) => {
        setRestaurant(data.restaurant);
        setCategories(data.categories);
        setDishes(data.dishes);
        setIsPaid(data.isPaid ?? false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [selectedRestaurantId]);

  if (sessionLoading || loading) return <SkeletonLoading type="form" />;
  if (error || !restaurant)
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: "var(--adm-text2)", fontFamily: F }}>
          No se pudo cargar la carta. Intenta de nuevo.
        </p>
      </div>
    );

  // Filter: only categories that have active dishes with valid name and price > 0
  const validDishes = dishes.filter((d) => d.name.trim() && d.price > 0);
  const catIdsWithDishes = new Set(validDishes.map((d) => d.categoryId));
  const filteredCategories = categories.filter((c) => catIdsWithDishes.has(c.id));

  return (
    <ExportarCarta
      restaurant={restaurant}
      categories={filteredCategories}
      dishes={validDishes}
      isPaid={isPaid}
    />
  );
}
