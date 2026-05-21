"use client";

import { useState, useEffect } from "react";
import DemoOnboarding from "./DemoOnboarding";

interface Props {
  restaurantSlug: string;
  allPhotosReferential?: boolean;
  hasReferentialPhotos?: boolean;
  restaurantName?: string;
}

export default function ShowcaseMobileOnly({ restaurantSlug, allPhotosReferential, hasReferentialPhotos, restaurantName }: Props) {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    setIsMobile(window.innerWidth < 1024);
  }, []);

  if (!isMobile) return null;

  return (
    <DemoOnboarding
      restaurantSlug={restaurantSlug}
      onboardingDone={false}
      allPhotosReferential={allPhotosReferential}
      hasReferentialPhotos={hasReferentialPhotos}
      showcaseMode
      restaurantName={restaurantName}
    />
  );
}
