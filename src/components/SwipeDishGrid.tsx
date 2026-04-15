"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import DishGrid from "@/components/DishGrid";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Dish = any;

interface Page {
  dishes: Dish[];
}

interface Props {
  initialDishes: Dish[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onLoadMore: (currentPageDishes: Dish[]) => Promise<Dish[]>;
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
  // Slide transition: "idle" | "exit-left" | "exit-right"
  const [slideState, setSlideState] = useState<"idle" | "exit-left" | "exit-right">("idle");
  const [enterFrom, setEnterFrom] = useState<"left" | "right" | null>(null);

  // Detect touch vs desktop
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

  // Capture grid height before transitions to prevent collapse
  useEffect(() => {
    if (wrapperRef.current && pages.length > 0 && !loadingNext) {
      const h = wrapperRef.current.offsetHeight;
      if (h > 50) setGridMinHeight(h);
    }
  }, [pages, currentPage, loadingNext]);

  // Initialize with first page
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

  // Reset when initialDishes completely changes (filter switch)
  const prevInitialRef = useRef<string>("");
  useEffect(() => {
    const key = initialDishes.map(d => d.id).join(",");
    if (prevInitialRef.current && key !== prevInitialRef.current) {
      setPages([{ dishes: initialDishes }]);
      setCurrentPage(0);
      setSwipeOffset(0);
      setSlideState("idle");
      setEnterFrom(null);
    }
    prevInitialRef.current = key;
  }, [initialDishes]);

  // Show swipe hint for first-time users
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

  // Animate page transition
  const transitionToPage = useCallback(async (direction: "next" | "prev") => {
    if (direction === "prev" && currentPage > 0) {
      // Slide current page out to the right, then show previous page entering from left
      setSlideState("exit-right");
      setTimeout(() => {
        setCurrentPage(p => p - 1);
        setEnterFrom("left");
        setSlideState("idle");
        // After a frame, trigger enter animation
        requestAnimationFrame(() => setEnterFrom(null));
      }, 280);
      return;
    }

    if (direction === "next") {
      dismissHint();

      // If next page already loaded
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

      // Need to load new page — slide out first, show loader, then slide in
      setSlideState("exit-left");
      setTimeout(async () => {
        setSlideState("idle");
        setLoadingNext(true);
        try {
          const currentDishes = pages[currentPage]?.dishes ?? [];
          const newDishes = await onLoadMore(currentDishes);
          if (newDishes.length > 0) {
            setPages(prev => [...prev, { dishes: newDishes }]);
            setCurrentPage(p => p + 1);
            setEnterFrom("right");
            requestAnimationFrame(() => setEnterFrom(null));
          }
        } catch {}
        setLoadingNext(false);
      }, 280);
    }
  }, [currentPage, pages, onLoadMore, dismissHint]);

  // Touch handlers
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
      if (dx > 8 || dy > 8) {
        isHorizontalSwipe.current = dx > dy;
      }
    }

    if (isHorizontalSwipe.current) {
      const dx = currentX - touchStartX.current;
      if (dx > 0 && currentPage === 0) {
        setSwipeOffset(dx * 0.3);
      } else {
        setSwipeOffset(dx);
      }
    }
  }, [swiping, currentPage]);

  const onTouchEnd = useCallback(() => {
    if (!swiping) return;
    setSwiping(false);

    const dx = touchCurrentX.current - touchStartX.current;
    const threshold = 60;

    if (isHorizontalSwipe.current && Math.abs(dx) > threshold) {
      if (dx < -threshold) {
        setSwipeOffset(0);
        transitionToPage("next");
      } else if (dx > threshold && currentPage > 0) {
        setSwipeOffset(0);
        transitionToPage("prev");
      } else {
        setSwipeOffset(0);
      }
    } else {
      setSwipeOffset(0);
    }

    isHorizontalSwipe.current = null;
  }, [swiping, currentPage, transitionToPage]);

  // Mouse drag support
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
    if (dx > 0 && currentPage === 0) {
      setSwipeOffset(dx * 0.3);
    } else {
      setSwipeOffset(dx);
    }
  }, [currentPage]);

  const onMouseUp = useCallback(() => {
    if (!mouseDown.current) return;
    mouseDown.current = false;
    const dx = touchCurrentX.current - touchStartX.current;
    const threshold = 60;

    setSwiping(false);

    if (Math.abs(dx) > threshold) {
      if (dx < -threshold) {
        setSwipeOffset(0);
        transitionToPage("next");
      } else if (dx > threshold && currentPage > 0) {
        setSwipeOffset(0);
        transitionToPage("prev");
      } else {
        setSwipeOffset(0);
      }
    } else {
      setSwipeOffset(0);
    }
  }, [currentPage, transitionToPage]);

  const currentDishes = pages[currentPage]?.dishes ?? [];

  // Show nudge modal when user has enough selections
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const showNudgeModal = selected.size >= 3 && !nudgeDismissed && !loadingNext;

  if (loading && pages.length === 0) {
    return <p className="font-body" style={{ color: "#999", textAlign: "center", padding: 40 }}>Cargando platos...</p>;
  }

  // Compute grid transform
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

  return (
    <div style={{ position: "relative", userSelect: "none" }}>
      {/* Swipe hint overlay — touch only */}
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
          <div style={{ fontSize: 36, color: "#FFF", animation: "swipeHint 1.5s ease-in-out infinite" }}>
            👆
          </div>
          <p className="font-display" style={{ color: "#FFF", fontSize: "0.85rem", textAlign: "center" }}>
            Desliza para ver más platos
          </p>
          <style>{`
            @keyframes swipeHint {
              0%, 100% { transform: translateX(0); opacity: 1; }
              50% { transform: translateX(-30px); opacity: 0.6; }
            }
          `}</style>
        </div>
      )}

      {/* Desktop arrows */}
      {!isTouchDevice && !loadingNext && slideState === "idle" && (
        <>
          {currentPage > 0 && (
            <button onClick={() => transitionToPage("prev")} style={{ position: "absolute", left: -44, top: "50%", transform: "translateY(-50%)", zIndex: 10, width: 36, height: 36, borderRadius: "50%", background: "#FFF", border: "1px solid #E0E0E0", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#0D0D0D" }}>←</button>
          )}
          <button onClick={() => transitionToPage("next")} style={{ position: "absolute", right: -44, top: "50%", transform: "translateY(-50%)", zIndex: 10, width: 36, height: 36, borderRadius: "50%", background: "#FFF", border: "1px solid #E0E0E0", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#0D0D0D" }}>→</button>
        </>
      )}

      {/* Loading state — shown when next page is being fetched */}
      {loadingNext && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 5,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <p style={{ fontSize: 32 }}>🧞</p>
          <p className="font-display" style={{ fontSize: "0.82rem", color: "#666" }}>Buscando más platos...</p>
        </div>
      )}

      {/* Swipeable grid — overflow visible so modal is not clipped */}
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
          style={{
            transform: gridTransform,
            transition: gridTransition,
            opacity: gridOpacity,
            touchAction: "pan-y",
          }}
        >
          {!loadingNext && (
            <DishGrid dishes={currentDishes} selected={selected} onToggleSelect={onToggleSelect} loading={false} />
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

      {/* Nudge modal — appears when user has 3+ selections */}
      {showNudgeModal && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 12,
          background: "rgba(0,0,0,0.5)", borderRadius: 14,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 12, padding: 20,
        }}>
          <p style={{ fontSize: 36 }}>🧞</p>
          <p className="font-display" style={{ color: "#FFF", fontSize: "1rem", textAlign: "center", fontWeight: 700 }}>
            {selected.size >= 5 ? "El Genio ya sabe qué recomendarte" : "El Genio ya tiene ideas para ti"}
          </p>
          <p className="font-body" style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.82rem", textAlign: "center" }}>
            {selected.size} plato{selected.size > 1 ? "s" : ""} seleccionado{selected.size > 1 ? "s" : ""}
          </p>
          {onProceed && (
            <button onClick={onProceed} style={{ padding: "14px 32px", background: "#FFD600", color: "#0D0D0D", border: "none", borderRadius: 99, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", marginTop: 4 }}>
              Ver sugerencia del Genio →
            </button>
          )}
          <button onClick={() => setNudgeDismissed(true)} style={{ padding: "8px 16px", background: "transparent", border: "none", color: "rgba(255,255,255,0.6)", fontSize: "0.78rem", cursor: "pointer", fontFamily: "var(--font-body)" }}>
            Quiero seguir viendo platos
          </button>
        </div>
      )}
    </div>
  );
}
