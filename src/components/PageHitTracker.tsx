"use client";
import { useEffect } from "react";

export default function PageHitTracker({ restaurantId, page }: { restaurantId: string; page: string }) {
  useEffect(() => {
    fetch("/api/track/ph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId, page }),
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
