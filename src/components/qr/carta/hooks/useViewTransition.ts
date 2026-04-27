"use client";

import { useState, useEffect } from "react";
import type { CartaView } from "./useCartaView";

interface OverlayState {
  label: string;
  view: CartaView;
}

// Global state shared between ViewSelector (show) and CartaRouter (hide)
let _showOverlay: ((label: string, view: CartaView) => void) | null = null;
let _hideOverlay: (() => void) | null = null;

export function showViewTransition(label: string, view: CartaView) {
  _showOverlay?.(label, view);
}

export function hideViewTransition() {
  _hideOverlay?.();
}

export function useViewTransition() {
  const [overlay, setOverlay] = useState<OverlayState | null>(null);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    _showOverlay = (label: string, view: CartaView) => {
      setOverlay({ label, view });
      setFadeOut(false);
    };
    _hideOverlay = () => {
      setFadeOut(true);
      setTimeout(() => { setOverlay(null); setFadeOut(false); }, 300);
    };
    return () => { _showOverlay = null; _hideOverlay = null; };
  }, []);

  // Safety: auto-dismiss overlay after 2s to prevent stuck state
  useEffect(() => {
    if (!overlay) return;
    const t = setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => { setOverlay(null); setFadeOut(false); }, 300);
    }, 2000);
    return () => clearTimeout(t);
  }, [overlay]);

  return { overlay, fadeOut };
}
