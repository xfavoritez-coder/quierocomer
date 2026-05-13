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
  const [fromLanding, setFromLanding] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    const check = () => {
      const wide = window.innerWidth >= 1024;
      const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
      const hasFinePointer = window.matchMedia("(pointer: fine)").matches;
      setIsDesktop(wide && (hasFinePointer || !hasCoarsePointer));
    };
    check();
    window.addEventListener("resize", check);
    setFromLanding(new URLSearchParams(window.location.search).get("from") === "landing");
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!fromLanding || !isDesktop) return;
    const url = `https://quierocomer.cl/qr/${slug}`;
    const canvas = document.createElement("canvas");
    const size = 400;
    canvas.width = size;
    canvas.height = size;
    import("qrcode").then((QRCode) => {
      QRCode.toDataURL(url, { width: size, margin: 1, errorCorrectionLevel: "H", color: { dark: "#0e0e0e", light: "#ffffff" } })
        .then(setQrDataUrl).catch(() => {});
    }).catch(() => {});
  }, [fromLanding, isDesktop, slug]);

  if (isDesktop === null) return <div style={{ minHeight: "100dvh", background: "#0a0a0a" }} />;
  if (!isDesktop) return <>{children}</>;

  // Landing preview: phone mockup + QR
  if (fromLanding) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", gap: 60, padding: "40px 60px", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ maxWidth: 360, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
            <span style={{ color: "#E8A33D", fontSize: "1.2rem", letterSpacing: "4px" }}>✦ ✦ ✦</span>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", fontWeight: 500 }}>Carta QR Viva</span>
          </div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "2.8rem", fontWeight: 800, color: "white", lineHeight: 1.1, marginBottom: 16 }}>{restaurantName}</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "1.05rem", lineHeight: 1.7, marginBottom: 32 }}>Esta carta está diseñada para verse en tu celular. Escanea el QR o abre el link desde tu teléfono.</p>
          {qrDataUrl && (
            <div style={{ background: "white", borderRadius: 16, padding: 16, width: 180, marginBottom: 24 }}>
              <img src={qrDataUrl} alt="QR" style={{ width: "100%", borderRadius: 8 }} />
            </div>
          )}
          <p style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.82rem" }}>quierocomer.cl/qr/{slug}</p>
          <div style={{ marginTop: 40, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "rgba(255,255,255,0.15)", fontSize: "0.75rem" }}>Powered by</span>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", color: "rgba(255,255,255,0.3)", fontSize: "0.9rem", fontWeight: 700 }}>QuieroComer<span style={{ color: "#E8A33D" }}>.cl</span></span>
          </div>
        </div>
        <div style={{ width: 290, height: 630, background: "#111", borderRadius: 50, padding: 12, boxShadow: "0 50px 100px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.04)", flexShrink: 0, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 120, height: 28, background: "#111", borderRadius: "0 0 18px 18px", zIndex: 10 }} />
          <iframe src={`/qr/${slug}`} style={{ width: "100%", height: "100%", border: "none", borderRadius: 38, background: "#f7f7f5" }} />
        </div>
      </div>
    );
  }

  // Desktop: full-width carta with grid layout
  if (restaurant && categories && dishes) {
    return (
      <LangProvider value={lang || "es"}>
        <CartaDesktop restaurant={restaurant} categories={categories} dishes={dishes} popularDishIds={popularDishIds} tableId={tableId} isQrScan={isQrScan} lang={lang} marketingPromos={marketingPromos} />
      </LangProvider>
    );
  }

  return <>{children}</>;
}
