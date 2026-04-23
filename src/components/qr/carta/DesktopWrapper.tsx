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

  if (isDesktop === null) return <div style={{ minHeight: "100dvh", background: "#f5f5f5" }} />;
  if (!isDesktop) return <>{children}</>;

  return (
    <div style={{ minHeight: "100dvh", background: "#f0ede6", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 480, minHeight: "100dvh", background: "#fff", boxShadow: "0 0 40px rgba(0,0,0,0.08)" }}>
        {children}
      </div>
    </div>
  );
}
