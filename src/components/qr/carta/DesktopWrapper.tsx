"use client";

import { useState, useEffect } from "react";

interface DesktopWrapperProps {
  restaurantName: string;
  slug: string;
  children: React.ReactNode;
}

export default function DesktopWrapper({ restaurantName, slug, children }: DesktopWrapperProps) {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (isDesktop === null) return <div style={{ minHeight: "100dvh", background: "#f7f7f5" }} />;

  // Mobile: render as-is
  if (!isDesktop) return <>{children}</>;

  // Desktop: centered layout with adapted styles
  return (
    <div className="qr-desktop-wrap">
      {children}
      <style>{`
        .qr-desktop-wrap {
          max-width: 900px;
          margin: 0 auto;
          min-height: 100dvh;
          background: #f7f7f5;
          box-shadow: 0 0 60px rgba(0,0,0,0.06);
        }

        /* Category nav: center tabs instead of edge-to-edge scroll */
        .qr-desktop-wrap nav.sticky,
        .qr-desktop-wrap .sticky.top-0 {
          border-radius: 0;
        }

        /* Dish list cards: 2-column grid */
        .qr-desktop-wrap section > div[style*="flex-direction: column"] {
          display: grid !important;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        /* Make dish cards taller photos */
        .qr-desktop-wrap section > div[style*="flex-direction: column"] > button {
          border-radius: 14px;
        }

        /* Genio nudge: full width */
        .qr-desktop-wrap div[style*="margin: 55px"] {
          max-width: 600px;
          margin-left: auto !important;
          margin-right: auto !important;
        }

        /* Fixed buttons: position relative to container */
        .qr-desktop-wrap .fixed.z-50 {
          position: fixed;
          right: calc(50% - 450px + 12px);
        }

        /* Footer: wider padding */
        .qr-desktop-wrap footer {
          padding-bottom: 40px !important;
        }
      `}</style>
    </div>
  );
}
