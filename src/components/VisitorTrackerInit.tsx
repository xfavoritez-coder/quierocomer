"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initVisitorTracker } from "@/lib/visitorTracker";

export default function VisitorTrackerInit() {
  const pathname = usePathname();

  useEffect(() => {
    // Only track on public-facing pages, not admin/panel
    if (pathname?.startsWith("/admin") || pathname?.startsWith("/panel") || pathname?.startsWith("/api")) return;
    initVisitorTracker();
  }, [pathname]);

  return null;
}
