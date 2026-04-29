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
  marketingPromos?: any[];
}

export default function DesktopWrapper({ restaurantName, slug, children, restaurant, categories, dishes, popularDishIds, tableId, isQrScan, lang, marketingPromos }: DesktopWrapperProps) {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => {
      const wide = window.innerWidth >= 1024;
      const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
      const hasFinePointer = window.matchMedia("(pointer: fine)").matches;
      // Desktop = wide screen + fine pointer (mouse/trackpad), OR wide + no coarse pointer
      // Mobile/tablet = coarse pointer (touch) without fine pointer
      setIsDesktop(wide && (hasFinePointer || !hasCoarsePointer));
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (isDesktop === null || !isDesktop) return <>{children}</>;

  // Desktop: full-width carta with grid layout
  if (restaurant && categories && dishes) {
    return (
      <LangProvider value={lang || "es"}>
        <CartaDesktop restaurant={restaurant} categories={categories} dishes={dishes} popularDishIds={popularDishIds} tableId={tableId} isQrScan={isQrScan} lang={lang} marketingPromos={marketingPromos} />
      </LangProvider>
    );
  }

  // Fallback if no data passed
  return <>{children}</>;
}
