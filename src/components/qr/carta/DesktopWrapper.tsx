"use client";

import { useState, useEffect } from "react";
import type { Restaurant, Category, Dish } from "@prisma/client";
import CartaDesktop from "./CartaDesktop";

interface DesktopWrapperProps {
  restaurantName: string;
  slug: string;
  children: React.ReactNode;
  restaurant?: Restaurant;
  categories?: Category[];
  dishes?: Dish[];
  popularDishIds?: Set<string>;
}

export default function DesktopWrapper({ restaurantName, slug, children, restaurant, categories, dishes, popularDishIds }: DesktopWrapperProps) {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const isPreview = new URLSearchParams(window.location.search).get("preview") === "true";
    if (isPreview) {
      setIsDesktop(false);
      return;
    }
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (isDesktop === null) return <div style={{ minHeight: "100dvh", background: "#f7f7f5" }} />;
  if (!isDesktop) return <>{children}</>;

  // Desktop: full-width carta with grid layout
  if (restaurant && categories && dishes) {
    return <CartaDesktop restaurant={restaurant} categories={categories} dishes={dishes} popularDishIds={popularDishIds} />;
  }

  // Fallback if no data passed
  return <>{children}</>;
}
