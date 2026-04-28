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
    const isPreview = new URLSearchParams(window.location.search).get("preview") === "true";
    if (isPreview) {
      setIsDesktop(false);
      return;
    }
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (isDesktop === null) return <div style={{ minHeight: "100dvh", background: "#f7f7f5" }} />;
  if (!isDesktop) return <>{children}</>;

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f3ef" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", background: "#f7f7f5", minHeight: "100dvh", boxShadow: "0 0 40px rgba(0,0,0,0.08)" }}>
        {children}
      </div>
    </div>
  );
}
