"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import DishGrid from "@/components/DishGrid";
import { detectPattern, type PatternResult } from "@/lib/pattern-detection";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Dish = any;

interface Page {
  dishes: Dish[];
}

interface Props {
  initialDishes: Dish[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onLoadMore: (currentPageDishes: Dish[], negativeCats: string[]) => Promise<Dish[]>;
  onProceed?: () => void;
  loading?: boolean;
}

export default function SwipeDishGrid({ initialDishes, selected, onToggleSelect, onLoadMore, onProceed, loading }: Props) {
  const [pages, setPages] = useState<Page[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [loadingNext, setLoadingNext] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(true);
  const [slideState, setSlideState] = useState<"idle" | "exit-left" | "exit-right">("idle");
  const [enterFrom, setEnterFrom] = useState<"left" | "right" | null>(null);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);

  // Pattern detection state
  const [previewedNotSelected, setPreviewedNotSelected] = useState<Dish[]>([]);
  const [reselectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setIsTouchDevice("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);

  const trackRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchCurrentX = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);
  const [gridMinHeight, setGridMinHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (wrapperRef.current && pages.length > 0 && !loadingNext) {
      const h = wrapperRef.current.offsetHeight;
      if (h > 50) setGridMinHeight(h);
    }
  }, [pages, currentPage, loadingNext]);

  // ── Pattern detection ──
  // Collect all selected dishes from all pages
  const allDishesMap = useMemo(() => {
    const map = new Map<string, Dish>();
    for (const page of pages) {
      for (const d of page.dishes) {
        map.set(d.id, d);
      }
    }
    return map;
  }, [pages]);

  const selectedDishes = useMemo(() => {
    const dishes: Dish[] = [];
    for (const id of selected) {
      const d = allDishesMap.get(id);
      if (d) dishes.push(d);
    }
    return dishes;
  }, [selected, allDishesMap]);

  const pattern: PatternResult = useMemo(() => {
    return detectPattern({
      selectedDishes,
      previewedButNotSelected: previewedNotSelected,
      reselectedIds,
    });
  }, [selectedDishes, previewedNotSelected, reselectedIds]);

  // Show nudge based on pattern confidence, not fixed count
  const showNudgeModal = pattern.phase === "ready" && !nudgeDismissed && !loadingNext;

  // Track preview dismissals
  const handlePreviewDismiss = useCallback((dish: Dish) => {
    setPreviewedNotSelected(prev => {
      if (prev.some(d => d.id === dish.id)) return prev;
      return [...prev, dish];
    });
  }, []);

  // ── Page management ──
  useEffect(() => {
    if (initialDishes.length > 0) {
      setPages(prev => {
        if (prev.length === 0) return [{ dishes: initialDishes }];
        const updated = [...prev];
        updated[0] = { dishes: initialDishes };
        return updated;
      });
    }
  }, [initialDishes]);

  const prevInitialRef = useRef<string>("");
  useEffect(() => {
    const key = initialDishes.map(d => d.id).join(",");
    if (prevInitialRef.current && key !== prevInitialRef.current) {
      setPages([{ dishes: initialDishes }]);
      setCurrentPage(0);
      setSwipeOffset(0);
      setSlideState("idle");
      setEnterFrom(null);
      setPreviewedNotSelected([]);
      setNudgeDismissed(false);
    }
    prevInitialRef.current = key;
  }, [initialDishes]);

  // Swipe hint
  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem("genieSwipeHintSeen");
    if (!seen && initialDishes.length > 0) {
      setShowHint(true);
      const timer = setTimeout(() => {
        setShowHint(false);
        localStorage.setItem("genieSwipeHintSeen", "true");
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [initialDishes.length]);

  const dismissHint = useCallback(() => {
    setShowHint(false);
    localStorage.setItem("genieSwipeHintSeen", "true");
  }, []);

  // ── Page transitions ──
  const transitionToPage = useCallback(async (direction: "next" | "prev") => {
    if (direction === "prev" && currentPage > 0) {
      setSlideState("exit-right");
      setTimeout(() => {
        setCurrentPage(p => p - 1);
        setEnterFrom("left");
        setSlideState("idle");
        requestAnimationFrame(() => setEnterFrom(null));
      }, 280);
      return;
    }

    if (direction === "next") {
      dismissHint();

      if (currentPage + 1 < pages.length) {
        setSlideState("exit-left");
        setTimeout(() => {
          setCurrentPage(p => p + 1);
          setEnterFrom("right");
          setSlideState("idle");
          requestAnimationFrame(() => setEnterFrom(null));
        }, 280);
        return;
      }

      setSlideState("exit-left");
      setTimeout(async () => {
        setSlideState("idle");
        setLoadingNext(true);
        try {
          const currentDishes = pages[currentPage]?.dishes ?? [];
          // Pass negative signals from pattern detection
          const negativeCats = pattern.ignoredCategories;
          const newDishes = await onLoadMore(currentDishes, negativeCats);

          // Mix in 1-2 re-show candidates for validation
          const reshowCandidates = getReshowCandidates(pages, selected, currentPage);
          let finalDishes = newDishes;
          if (reshowCandidates.length > 0 && newDishes.length >= 7) {
            // Replace last 1-2 dishes with reshow candidates
            const reshowCount = Math.min(reshowCandidates.length, 2);
            finalDishes = [
              ...newDishes.slice(0, newDishes.length - reshowCount),
              ...reshowCandidates.slice(0, reshowCount),
            ];
          }

          if (finalDishes.length > 0) {
            setPages(prev => [...prev, { dishes: finalDishes }]);
            setCurrentPage(p => p + 1);
            setEnterFrom("right");
            requestAnimationFrame(() => setEnterFrom(null));
          }
        } catch {}
        setLoadingNext(false);
      }, 280);
    }
  }, [currentPage, pages, onLoadMore, dismissHint, selected, pattern.ignoredCategories]);

  // ── Touch handlers ──
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (loadingNext || slideState !== "idle") return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchCurrentX.current = e.touches[0].clientX;
    isHorizontalSwipe.current = null;
    setSwiping(true);
  }, [loadingNext, slideState]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    touchCurrentX.current = currentX;

    if (isHorizontalSwipe.current === null) {
      const dx = Math.abs(currentX - touchStartX.current);
      const dy = Math.abs(currentY - touchStartY.current);
      if (dx > 8 || dy > 8) isHorizontalSwipe.current = dx > dy;
    }

    if (isHorizontalSwipe.current) {
      const dx = currentX - touchStartX.current;
      setSwipeOffset(dx > 0 && currentPage === 0 ? dx * 0.3 : dx);
    }
  }, [swiping, currentPage]);

  const onTouchEnd = useCallback(() => {
    if (!swiping) return;
    setSwiping(false);
    const dx = touchCurrentX.current - touchStartX.current;
    const threshold = 60;

    if (isHorizontalSwipe.current && Math.abs(dx) > threshold) {
      setSwipeOffset(0);
      if (dx < -threshold) transitionToPage("next");
      else if (dx > threshold && currentPage > 0) transitionToPage("prev");
    } else {
      setSwipeOffset(0);
    }
    isHorizontalSwipe.current = null;
  }, [swiping, currentPage, transitionToPage]);

  // ── Mouse handlers ──
  const mouseDown = useRef(false);
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (loadingNext || slideState !== "idle") return;
    mouseDown.current = true;
    touchStartX.current = e.clientX;
    touchCurrentX.current = e.clientX;
    isHorizontalSwipe.current = true;
    setSwiping(true);
  }, [loadingNext, slideState]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!mouseDown.current) return;
    touchCurrentX.current = e.clientX;
    const dx = e.clientX - touchStartX.current;
    setSwipeOffset(dx > 0 && currentPage === 0 ? dx * 0.3 : dx);
  }, [currentPage]);

  const onMouseUp = useCallback(() => {
    if (!mouseDown.current) return;
    mouseDown.current = false;
    setSwiping(false);
    const dx = touchCurrentX.current - touchStartX.current;
    const threshold = 60;

    if (Math.abs(dx) > threshold) {
      setSwipeOffset(0);
      if (dx < -threshold) transitionToPage("next");
      else if (dx > threshold && currentPage > 0) transitionToPage("prev");
    } else {
      setSwipeOffset(0);
    }
  }, [currentPage, transitionToPage]);

  // ── Render ──
  const currentDishes = pages[currentPage]?.dishes ?? [];

  if (loading && pages.length === 0) {
    return <p className="font-body" style={{ color: "#999", textAlign: "center", padding: 40 }}>Cargando platos...</p>;
  }

  let gridTransform = "translateX(0)";
  let gridTransition = "transform 0.3s ease, opacity 0.3s ease";
  let gridOpacity = 1;

  if (swiping && swipeOffset !== 0) {
    gridTransform = `translateX(${swipeOffset}px)`;
    gridTransition = "none";
    gridOpacity = 1 - Math.min(Math.abs(swipeOffset) / 400, 0.3);
  } else if (slideState === "exit-left") {
    gridTransform = "translateX(-110%)";
    gridOpacity = 0;
  } else if (slideState === "exit-right") {
    gridTransform = "translateX(110%)";
    gridOpacity = 0;
  } else if (enterFrom === "right") {
    gridTransform = "translateX(110%)";
    gridTransition = "none";
    gridOpacity = 0;
  } else if (enterFrom === "left") {
    gridTransform = "translateX(-110%)";
    gridTransition = "none";
    gridOpacity = 0;
  }

  // Progressive Genio presence based on confidence
  const showSubtleHint = pattern.phase === "noticing" && !nudgeDismissed;
  const showPulse = pattern.phase === "confident" && !nudgeDismissed;

  return (
    <div style={{ position: "relative", userSelect: "none" }}>
      {/* Swipe hint — touch only */}
      {showHint && isTouchDevice && (
        <div
          onClick={dismissHint}
          style={{
            position: "absolute", inset: 0, zIndex: 10,
            background: "rgba(0,0,0,0.4)", borderRadius: 14,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 8, cursor: "pointer",
          }}
        >
          <div style={{ fontSize: 36, color: "#FFF", animation: "swipeHint 1.5s ease-in-out infinite" }}>👆</div>
          <p className="font-display" style={{ color: "#FFF", fontSize: "0.85rem", textAlign: "center" }}>Desliza para ver más platos</p>
          <style>{`
            @keyframes swipeHint {
              0%, 100% { transform: translateX(0); opacity: 1; }
              50% { transform: translateX(-30px); opacity: 0.6; }
            }
          `}</style>
        </div>
      )}

      {/* Desktop arrows */}
      {!isTouchDevice && !loadingNext && slideState === "idle" && !showNudgeModal && (
        <>
          {currentPage > 0 && (
            <button onClick={() => transitionToPage("prev")} style={{ position: "absolute", left: -44, top: "50%", transform: "translateY(-50%)", zIndex: 10, width: 36, height: 36, borderRadius: "50%", background: "#FFF", border: "1px solid #E0E0E0", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#0D0D0D" }}>←</button>
          )}
          <button onClick={() => transitionToPage("next")} style={{ position: "absolute", right: -44, top: "50%", transform: "translateY(-50%)", zIndex: 10, width: 36, height: 36, borderRadius: "50%", background: "#FFF", border: "1px solid #E0E0E0", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#0D0D0D" }}>→</button>
        </>
      )}

      {/* Loading */}
      {loadingNext && (
        <div style={{ position: "absolute", inset: 0, zIndex: 5, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <p style={{ fontSize: 32 }}>🧞</p>
          <p className="font-display" style={{ fontSize: "0.82rem", color: "#666" }}>Buscando más platos...</p>
        </div>
      )}

      {/* Grid */}
      <div
        ref={wrapperRef}
        style={{ overflow: "hidden", minHeight: gridMinHeight }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <div
          ref={trackRef}
          style={{ transform: gridTransform, transition: gridTransition, opacity: gridOpacity, touchAction: "pan-y" }}
        >
          {!loadingNext && (
            <DishGrid
              dishes={currentDishes}
              selected={selected}
              onToggleSelect={onToggleSelect}
              onPreviewDismiss={handlePreviewDismiss}
              loading={false}
            />
          )}
        </div>
      </div>

      {/* Page indicator */}
      {pages.length > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 6, marginBottom: 4 }}>
          {pages.map((_, i) => (
            <div key={i} style={{
              width: i === currentPage ? 16 : 5, height: 5, borderRadius: 99,
              background: i === currentPage ? "#0D0D0D" : "#E0E0E0",
              transition: "all 0.3s ease",
            }} />
          ))}
        </div>
      )}

      {/* Progressive hint: "noticing" phase */}
      {showSubtleHint && pattern.message && (
        <div style={{ textAlign: "center", padding: "6px 16px", marginTop: 4 }}>
          <p className="font-body" style={{ fontSize: "0.78rem", color: "#999" }}>🧞 {pattern.message}</p>
        </div>
      )}

      {/* Progressive hint: "confident" phase — pulse on CTA area */}
      {showPulse && pattern.message && (
        <div style={{ textAlign: "center", padding: "8px 16px", marginTop: 4, background: "rgba(255,214,0,0.1)", borderRadius: 12 }}>
          <p className="font-display" style={{ fontSize: "0.82rem", color: "#0D0D0D", fontWeight: 500 }}>🧞 {pattern.message}</p>
        </div>
      )}

      {/* Nudge modal — "ready" phase with full confidence */}
      {showNudgeModal && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 12,
          background: "rgba(0,0,0,0.75)", borderRadius: 14,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 12, padding: 24,
        }}>
          <p style={{ fontSize: 40 }}>🧞</p>
          <p className="font-display" style={{ color: "#FFF", fontSize: "1.05rem", textAlign: "center", fontWeight: 700, lineHeight: 1.4 }}>
            {pattern.message ?? "El Genio ya sabe qué recomendarte"}
          </p>
          <p className="font-body" style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.8rem", textAlign: "center" }}>
            {selected.size} plato{selected.size > 1 ? "s" : ""} seleccionado{selected.size > 1 ? "s" : ""}
          </p>
          {onProceed && (
            <button onClick={onProceed} style={{ padding: "14px 32px", background: "#FFD600", color: "#0D0D0D", border: "none", borderRadius: 99, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", marginTop: 4 }}>
              Ver sugerencia del Genio →
            </button>
          )}
          <button onClick={() => setNudgeDismissed(true)} style={{ padding: "8px 16px", background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", fontSize: "0.78rem", cursor: "pointer", fontFamily: "var(--font-body)" }}>
            Quiero seguir viendo platos
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Pick 1-2 dishes from previous pages that were NOT selected.
 * These are "re-show" candidates to validate the user's pattern.
 * Prefer dishes from the dominant category of selections.
 */
function getReshowCandidates(pages: Page[], selected: Set<string>, currentPageIdx: number): Dish[] {
  if (currentPageIdx < 1) return []; // Need at least 1 previous page

  // Collect all non-selected dishes from previous pages
  const candidates: Dish[] = [];
  for (let i = 0; i < currentPageIdx; i++) {
    for (const d of pages[i].dishes) {
      if (!selected.has(d.id)) candidates.push(d);
    }
  }

  if (candidates.length === 0) return [];

  // Find dominant category from selections
  const selectedDishes: Dish[] = [];
  for (const page of pages) {
    for (const d of page.dishes) {
      if (selected.has(d.id)) selectedDishes.push(d);
    }
  }
  const catCounts: Record<string, number> = {};
  for (const d of selectedDishes) catCounts[d.categoria] = (catCounts[d.categoria] ?? 0) + 1;
  const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  // Prefer re-show candidates from the dominant category
  const sameCat = topCat ? candidates.filter(d => d.categoria === topCat) : [];
  const pool = sameCat.length > 0 ? sameCat : candidates;

  // Shuffle and pick 1-2
  const shuffled = pool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(2, shuffled.length));
}
