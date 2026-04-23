"use client";

import { useState, useEffect } from "react";

interface HappyHour {
  id: string;
  name: string;
  days: number[];
  startTime: string;
  endTime: string;
  discountType: "FIXED_PRICE" | "PERCENTAGE";
  discountValue: number;
  categoryIds: string[];
  dishIds: string[];
  bannerText: string | null;
  bannerColor: string;
  isActive: boolean;
}

function getChileNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
}

function getTimeStr(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function getMinutesUntil(endTime: string): number {
  const now = getChileNow();
  const [h, m] = endTime.split(":").map(Number);
  const end = new Date(now);
  end.setHours(h, m, 0, 0);
  return Math.max(0, Math.floor((end.getTime() - now.getTime()) / 60000));
}

function formatCountdown(minutes: number): string {
  if (minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function findActiveHappyHour(hours: HappyHour[]): HappyHour | null {
  const now = getChileNow();
  const day = now.getDay();
  const time = getTimeStr(now);

  for (const hh of hours) {
    if (!hh.isActive) continue;
    if (!hh.days.includes(day)) continue;
    if (time >= hh.startTime && time < hh.endTime) return hh;
  }
  return null;
}

export function getActiveHappyHour(hours: any[]): any | null {
  return findActiveHappyHour(hours as HappyHour[]);
}

export function applyHappyHourPrices(dishes: any[], hh: any): any[] {
  if (!hh) return dishes;
  const affectedCats = new Set(hh.categoryIds || []);
  const affectedDishes = new Set(hh.dishIds || []);

  return dishes.map(d => {
    const isAffected = (affectedCats.size > 0 && affectedCats.has(d.categoryId)) ||
                       (affectedDishes.size > 0 && affectedDishes.has(d.id));
    if (!isAffected) return d;

    let newPrice: number;
    if (hh.discountType === "FIXED_PRICE") {
      newPrice = hh.discountValue;
    } else {
      newPrice = Math.round(d.price * (1 - hh.discountValue / 100));
    }

    // Only apply if it's actually a discount
    if (newPrice >= d.price) return d;

    return {
      ...d,
      discountPrice: newPrice,
      _originalPrice: d.price,
      _happyHour: true,
    };
  });
}

export default function HappyHourBanner({ happyHours }: { happyHours: any[] }) {
  const [active, setActive] = useState<HappyHour | null>(null);
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    const check = () => {
      const hh = findActiveHappyHour(happyHours as HappyHour[]);
      setActive(hh);
      if (hh) {
        const mins = getMinutesUntil(hh.endTime);
        setCountdown(formatCountdown(mins));
      }
    };
    check();
    const interval = setInterval(check, 30000); // update every 30s
    return () => clearInterval(interval);
  }, [happyHours]);

  if (!active) return null;

  const bannerText = active.bannerText ||
    (active.discountType === "FIXED_PRICE"
      ? `${active.name} — Todo a $${active.discountValue.toLocaleString("es-CL")}`
      : `${active.name} — ${active.discountValue}% de descuento`);

  return (
    <div
      className="font-[family-name:var(--font-dm)]"
      style={{
        background: `linear-gradient(135deg, ${active.bannerColor}, ${active.bannerColor}dd)`,
        color: "white",
        padding: "12px 20px",
        textAlign: "center",
        position: "relative",
        zIndex: 15,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <span style={{ fontSize: "1.1rem" }}>🔥</span>
        <span style={{ fontSize: "0.88rem", fontWeight: 700 }}>{bannerText}</span>
      </div>
      {countdown && (
        <p style={{ fontSize: "0.72rem", opacity: 0.85, margin: "4px 0 0", fontWeight: 500 }}>
          Termina en {countdown}
        </p>
      )}
    </div>
  );
}
