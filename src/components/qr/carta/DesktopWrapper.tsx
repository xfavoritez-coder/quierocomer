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

  useEffect(() => {
    const check = () => {
      const wide = window.innerWidth >= 1024;
      const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
      const hasFinePointer = window.matchMedia("(pointer: fine)").matches;
      setIsDesktop(wide && (hasFinePointer || !hasCoarsePointer));
    };
    check();
    window.addEventListener("resize", check);
    const params = new URLSearchParams(window.location.search);
    setFromLanding(params.get("from") === "landing");
    // If embedded as mobile inside phone mockup, force mobile view
    if (params.get("embed") === "mobile") {
      setIsDesktop(false);
      return () => window.removeEventListener("resize", check);
    }
    return () => window.removeEventListener("resize", check);
  }, []);

  if (isDesktop === null) return <div style={{ minHeight: "100dvh", background: "#0a0a0a" }} />;
  if (!isDesktop) return <>{children}</>;

  if (fromLanding) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`https://quierocomer.cl/qr/${slug}`)}&bgcolor=ffffff&color=0a0908&margin=0`;

    return (
      <div style={styles.wrapper}>
        {/* Background glow */}
        <div style={styles.bgGlow} />
        <div style={styles.bgGlow2} />

        {/* Left: Info + QR */}
        <div style={styles.left}>
          <div style={styles.badge}>
            <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
              <ellipse cx="13" cy="20" rx="9" ry="2.5" fill="#E8A33D"/>
              <path d="M19 20.5C23 20.5 27 18 27 13.5C27 11 25.5 9 23.5 8.5" stroke="#E8A33D" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span style={styles.badgeText}>QuieroComer</span>
          </div>

          <h1 style={styles.title}>{restaurantName}</h1>

          <div style={styles.divider} />

          <p style={styles.desc}>
            Esta carta fue diseñada para tu celular.<br />
            Escanea el código QR para vivirla.
          </p>

          <div style={styles.qrCard}>
            <img src={qrUrl} alt="QR" style={styles.qrImg} />
          </div>

          <p style={styles.url}>quierocomer.cl/qr/{slug}</p>

          <div style={styles.powered}>
            <span style={styles.poweredBy}>Powered by</span>
            <span style={styles.poweredBrand}>Quiero<span style={{ color: "#E8A33D" }}>Comer</span>.cl</span>
          </div>
        </div>

        {/* Right: Phone */}
        <div style={styles.phoneOuter}>
          <div style={styles.phoneFrame}>
            <div style={styles.notch} />
            <div style={styles.statusBar}>
              <span style={styles.statusTime}>9:41</span>
              <div style={styles.statusIcons}>
                <div style={{ width: 16, height: 10, border: "1.5px solid rgba(255,255,255,0.5)", borderRadius: 3, position: "relative" as const }}>
                  <div style={{ position: "absolute" as const, inset: 2, background: "rgba(255,255,255,0.5)", borderRadius: 1 }} />
                </div>
              </div>
            </div>
            <iframe
              src={`/qr/${slug}?embed=mobile`}
              style={styles.screen}
              title={`Carta de ${restaurantName}`}
            />
          </div>
          {/* Phone reflection */}
          <div style={styles.phoneReflection} />
        </div>
      </div>
    );
  }

  if (restaurant && categories && dishes) {
    return (
      <LangProvider value={lang || "es"}>
        <CartaDesktop restaurant={restaurant} categories={categories} dishes={dishes} popularDishIds={popularDishIds} tableId={tableId} isQrScan={isQrScan} lang={lang} marketingPromos={marketingPromos} />
      </LangProvider>
    );
  }

  return <>{children}</>;
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    minHeight: "100dvh",
    background: "#080706",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 72,
    padding: "40px 80px",
    fontFamily: "'Inter', -apple-system, sans-serif",
    position: "relative",
    overflow: "hidden",
  },
  bgGlow: {
    position: "absolute",
    top: "30%",
    right: "20%",
    width: 500,
    height: 500,
    background: "radial-gradient(circle, rgba(232,163,61,0.06) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  bgGlow2: {
    position: "absolute",
    bottom: "10%",
    left: "10%",
    width: 400,
    height: 400,
    background: "radial-gradient(circle, rgba(232,163,61,0.03) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  left: {
    maxWidth: 380,
    flexShrink: 0,
    position: "relative",
    zIndex: 1,
    textAlign: "center" as const,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(232,163,61,0.08)",
    border: "1px solid rgba(232,163,61,0.15)",
    borderRadius: 100,
    padding: "8px 16px",
    marginBottom: 28,
  },
  badgeText: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "#E8A33D",
    letterSpacing: "0.03em",
  },
  title: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize: "3.2rem",
    fontWeight: 700,
    color: "#F5EFE3",
    lineHeight: 1.05,
    marginBottom: 20,
    letterSpacing: "-0.01em",
  },
  divider: {
    width: 48,
    height: 2,
    background: "linear-gradient(90deg, rgba(232,163,61,0.2), #E8A33D, rgba(232,163,61,0.2))",
    marginBottom: 20,
    marginLeft: "auto",
    marginRight: "auto",
  },
  desc: {
    color: "rgba(245,239,227,0.45)",
    fontSize: "1rem",
    lineHeight: 1.7,
    marginBottom: 32,
  },
  qrCard: {
    background: "#ffffff",
    borderRadius: 14,
    padding: 14,
    width: 180,
    marginBottom: 20,
    marginLeft: "auto",
    marginRight: "auto",
    boxShadow: "0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)",
  },
  qrImg: {
    width: "100%",
    borderRadius: 8,
    display: "block",
  },
  qrFooter: {
    textAlign: "center" as const,
    marginTop: 12,
  },
  qrLabel: {
    fontSize: "0.6rem",
    letterSpacing: "0.15em",
    color: "#999",
    fontWeight: 600,
  },
  url: {
    color: "rgba(245,239,227,0.2)",
    fontSize: "0.8rem",
    fontFamily: "'JetBrains Mono', monospace",
    marginBottom: 0,
  },
  powered: {
    marginTop: 48,
    display: "flex",
    alignItems: "center",
    gap: 8,
    paddingTop: 20,
    borderTop: "1px solid rgba(255,255,255,0.06)",
  },
  poweredBy: {
    color: "rgba(255,255,255,0.15)",
    fontSize: "0.72rem",
    letterSpacing: "0.05em",
  },
  poweredBrand: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    color: "rgba(255,255,255,0.3)",
    fontSize: "0.88rem",
    fontWeight: 700,
  },
  phoneOuter: {
    position: "relative",
    flexShrink: 0,
    zIndex: 1,
  },
  phoneFrame: {
    width: 340,
    height: 700,
    background: "#1a1a1a",
    borderRadius: 48,
    padding: "12px 10px",
    boxShadow: "0 50px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.06)",
    position: "relative" as const,
    overflow: "hidden",
  },
  notch: {
    position: "absolute" as const,
    top: 10,
    left: "50%",
    transform: "translateX(-50%)",
    width: 100,
    height: 24,
    background: "#1a1a1a",
    borderRadius: "0 0 16px 16px",
    zIndex: 10,
  },
  statusBar: {
    position: "absolute" as const,
    top: 14,
    left: 28,
    right: 28,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 11,
  },
  statusTime: {
    color: "rgba(255,255,255,0.5)",
    fontSize: "0.7rem",
    fontWeight: 600,
  },
  statusIcons: {
    display: "flex",
    gap: 4,
    alignItems: "center",
  },
  screen: {
    width: "100%",
    height: "100%",
    border: "none",
    borderRadius: 36,
    background: "#f7f7f5",
  },
  phoneReflection: {
    position: "absolute" as const,
    top: 0,
    left: "-30%",
    width: "60%",
    height: "100%",
    background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.03) 45%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 55%, transparent 60%)",
    pointerEvents: "none" as const,
    borderRadius: 48,
  },
};
