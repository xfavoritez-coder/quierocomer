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

  // Don't render anything until we know (prevents flash)
  if (isDesktop === null) return <div style={{ minHeight: "100vh", background: "#0a0a0a" }} />;
  if (!isDesktop) return <>{children}</>;

  // Hide floating buttons on desktop
  const hideButtonsStyle = `
    .fixed { display: none !important; }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: hideButtonsStyle }} />
      <div
        className="font-[family-name:var(--font-dm)]"
        style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 60,
        padding: "40px 60px",
      }}
    >
      {/* Left side — info */}
      <div style={{ maxWidth: 360, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#F4A623", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
            </svg>
          </div>
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", fontWeight: 500 }}>
            Carta QR Viva
          </span>
        </div>

        <h1
          className="font-[family-name:var(--font-playfair)]"
          style={{
            fontSize: "2.8rem",
            fontWeight: 800,
            color: "white",
            lineHeight: 1.1,
            marginBottom: 16,
          }}
        >
          {restaurantName}
        </h1>

        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "1.05rem", lineHeight: 1.7, marginBottom: 32 }}>
          Esta carta está diseñada para verse en tu celular. Escanea el QR o abre el link desde tu teléfono.
        </p>

        {/* QR placeholder */}
        <div style={{ background: "white", borderRadius: 16, padding: 16, width: 180, marginBottom: 24 }}>
          <div style={{ width: "100%", aspectRatio: "1", background: "white", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            {/* Simple QR visual using CSS grid */}
            <svg viewBox="0 0 100 100" width="100%" height="100%">
              <rect x="10" y="10" width="25" height="25" rx="3" fill="#0a0a0a" />
              <rect x="13" y="13" width="19" height="19" rx="2" fill="white" />
              <rect x="17" y="17" width="11" height="11" rx="1" fill="#0a0a0a" />
              <rect x="65" y="10" width="25" height="25" rx="3" fill="#0a0a0a" />
              <rect x="68" y="13" width="19" height="19" rx="2" fill="white" />
              <rect x="72" y="17" width="11" height="11" rx="1" fill="#0a0a0a" />
              <rect x="10" y="65" width="25" height="25" rx="3" fill="#0a0a0a" />
              <rect x="13" y="68" width="19" height="19" rx="2" fill="white" />
              <rect x="17" y="72" width="11" height="11" rx="1" fill="#0a0a0a" />
              <rect x="40" y="10" width="5" height="5" fill="#0a0a0a" />
              <rect x="48" y="10" width="5" height="5" fill="#0a0a0a" />
              <rect x="40" y="18" width="5" height="5" fill="#0a0a0a" />
              <rect x="48" y="22" width="5" height="5" fill="#0a0a0a" />
              <rect x="40" y="30" width="5" height="5" fill="#0a0a0a" />
              <rect x="10" y="40" width="5" height="5" fill="#0a0a0a" />
              <rect x="18" y="44" width="5" height="5" fill="#0a0a0a" />
              <rect x="26" y="40" width="5" height="5" fill="#0a0a0a" />
              <rect x="40" y="40" width="5" height="5" fill="#F4A623" />
              <rect x="48" y="40" width="5" height="5" fill="#F4A623" />
              <rect x="44" y="44" width="5" height="5" fill="#F4A623" />
              <rect x="40" y="48" width="5" height="5" fill="#F4A623" />
              <rect x="48" y="48" width="5" height="5" fill="#F4A623" />
              <rect x="56" y="40" width="5" height="5" fill="#0a0a0a" />
              <rect x="60" y="48" width="5" height="5" fill="#0a0a0a" />
              <rect x="68" y="40" width="5" height="5" fill="#0a0a0a" />
              <rect x="80" y="44" width="5" height="5" fill="#0a0a0a" />
              <rect x="40" y="56" width="5" height="5" fill="#0a0a0a" />
              <rect x="52" y="60" width="5" height="5" fill="#0a0a0a" />
              <rect x="40" y="68" width="5" height="5" fill="#0a0a0a" />
              <rect x="48" y="72" width="5" height="5" fill="#0a0a0a" />
              <rect x="56" y="68" width="5" height="5" fill="#0a0a0a" />
              <rect x="68" y="56" width="5" height="5" fill="#0a0a0a" />
              <rect x="76" y="60" width="5" height="5" fill="#0a0a0a" />
              <rect x="68" y="68" width="5" height="5" fill="#0a0a0a" />
              <rect x="80" y="72" width="5" height="5" fill="#0a0a0a" />
              <rect x="72" y="80" width="5" height="5" fill="#0a0a0a" />
              <rect x="84" y="84" width="5" height="5" fill="#0a0a0a" />
            </svg>
          </div>
        </div>

        <p style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.82rem" }}>
          quierocomer.cl/qr/{slug}
        </p>

        <div style={{ marginTop: 40, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "rgba(255,255,255,0.15)", fontSize: "0.75rem" }}>Powered by</span>
          <span className="font-[family-name:var(--font-playfair)]" style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.9rem", fontWeight: 700 }}>
            QuieroComer<span style={{ color: "#F4A623" }}>.cl</span>
          </span>
        </div>
      </div>

      {/* Right side — phone mockup */}
      <div
        style={{
          width: 375,
          height: 812,
          background: "#111",
          borderRadius: 50,
          padding: 12,
          boxShadow: "0 50px 100px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.04)",
          flexShrink: 0,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Notch */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: 120,
            height: 28,
            background: "#111",
            borderRadius: "0 0 18px 18px",
            zIndex: 10,
          }}
        />

        {/* Screen */}
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 38,
            overflow: "hidden",
            overflowY: "auto",
            background: "#f7f7f5",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {children}
        </div>
      </div>
    </div>
    </>
  );
}
