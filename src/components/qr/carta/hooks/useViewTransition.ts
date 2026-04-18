"use client";

import { useState, useCallback, useEffect } from "react";

// Global state shared between ViewSelector (show) and CartaRouter (hide)
let _showOverlay: ((label: string) => void) | null = null;
let _hideOverlay: (() => void) | null = null;

export function showViewTransition(label: string) {
  _showOverlay?.(label);
}

export function hideViewTransition() {
  _hideOverlay?.();
}

export function useViewTransition() {
  const [overlay, setOverlay] = useState<string | null>(null);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    _showOverlay = (label: string) => {
      setOverlay(label);
      setFadeOut(false);
    };
    _hideOverlay = () => {
      setFadeOut(true);
      setTimeout(() => { setOverlay(null); setFadeOut(false); }, 300);
    };
    return () => { _showOverlay = null; _hideOverlay = null; };
  }, []);

  return { overlay, fadeOut };
}
