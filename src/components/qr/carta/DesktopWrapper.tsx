"use client";

import { useState, useEffect } from "react";
import type { Restaurant, Category, Dish } from "@prisma/client";
import type { Lang } from "@/lib/qr/i18n";
import { LangProvider } from "@/contexts/LangContext";
import CartaDesktop from "./CartaDesktop";

interface DesktopWrapperProps {
  restaurantName: string;
  slug: string;
  children: React.ReactNode;
  restaurant?: Restaurant;
  categories?: Category[];
  dishes?: Dish[];
  popularDishIds?: Set<string>;
  tableId?: string;
  isQrScan?: boolean;
  lang?: Lang;
}

export default function DesktopWrapper({ restaurantName, slug, children, restaurant, categories, dishes, popularDishIds, tableId, isQrScan, lang }: DesktopWrapperProps) {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (isDesktop === null) return <div style={{ minHeight: "100dvh", background: "#f7f7f5" }} />;
  if (!isDesktop) return <>{children}</>;

  // Desktop: full-width carta with grid layout
  if (restaurant && categories && dishes) {
    return (
      <LangProvider value={lang || "es"}>
        <CartaDesktop restaurant={restaurant} categories={categories} dishes={dishes} popularDishIds={popularDishIds} tableId={tableId} isQrScan={isQrScan} lang={lang} />
      </LangProvider>
    );
  }

  // Fallback if no data passed
  return <>{children}</>;
}
