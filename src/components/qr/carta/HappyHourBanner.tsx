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

/** Floating pill variant for Impact hero overlay */
export function HappyHourPill({ happyHours }: { happyHours: any[] }) {
  const [active, setActive] = useState<HappyHour | null>(null);
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    const check = () => {
      const hh = findActiveHappyHour(happyHours as HappyHour[]);
      setActive(hh);
      if (hh) setCountdown(formatCountdown(getMinutesUntil(hh.endTime)));
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [happyHours]);

  if (!active) return null;

  const text = active.bannerText ||
    (active.discountType === "FIXED_PRICE"
      ? `${active.name} — Todo a $${active.discountValue.toLocaleString("es-CL")}`
      : `${active.name} — ${active.discountValue}% de descuento`);

  return (
    <div
      className="font-[family-name:var(--font-dm)]"
      style={{
        display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4,
        padding: "10px 18px 10px",
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        borderRadius: 16,
        border: `1px solid ${active.bannerColor}55`,
        boxShadow: `0 4px 20px rgba(0,0,0,0.3), inset 0 0 20px ${active.bannerColor}15`,
        color: "white",
        maxWidth: "88vw",
      }}
    >
      <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 700, lineHeight: 1.3, textAlign: "center" }}>
        {text}
      </p>
      {countdown && (
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "2px 9px", borderRadius: 10,
          background: `${active.bannerColor}cc`,
          fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.03em",
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {countdown}
        </span>
      )}
    </div>
  );
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
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [happyHours]);

  if (!active) return null;

  const bannerText = active.bannerText ||
    (active.discountType === "FIXED_PRICE"
      ? `${active.name} — Todo a $${active.discountValue.toLocaleString("es-CL")}`
      : `${active.name} — ${active.discountValue}% de descuento`);

  const c = active.bannerColor;

  return (
    <div style={{ padding: "12px 12px 0", position: "relative", zIndex: 15 }}>
      <div
        className="font-[family-name:var(--font-dm)]"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 14px",
          border: `1px solid ${c}a5`,
          borderRadius: 18,
          background: `
            radial-gradient(circle at left, ${c}2e, transparent 40%),
            linear-gradient(135deg, #15100b, #080808)
          `,
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        }}
      >
        {/* Icon */}
        <div style={{
          width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
          background: `${c}24`,
          display: "grid", placeItems: "center",
          color: c,
          fontSize: "1.2rem",
        }}>
          ⏰
        </div>

        {/* Copy */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{
            display: "block",
            fontSize: "0.92rem",
            fontWeight: 750,
            color: "#fff",
            lineHeight: 1.3,
          }}>
            {bannerText}
          </strong>
          {countdown && (
            <span style={{
              display: "block",
              marginTop: 4,
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.68)",
            }}>
              Termina en{" "}
              <b style={{ color: c, fontWeight: 800 }}>{countdown}</b>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
