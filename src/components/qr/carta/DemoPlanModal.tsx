"use client";

import { useState, useEffect } from "react";
import PlanesModal from "@/components/PlanesModal";

/**
 * Listens for "show-plan-modal" event and renders PlanesModal.
 * Used in public carta when restaurant.isDemo is true.
 */
export default function DemoPlanModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handle = () => setOpen(true);
    window.addEventListener("show-plan-modal", handle);
    return () => window.removeEventListener("show-plan-modal", handle);
  }, []);

  if (!open) return null;
  return <PlanesModal onClose={() => setOpen(false)} />;
}
