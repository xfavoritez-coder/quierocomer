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
  loading?: boolean;
}

export default function SwipeDishGrid({ initialDishes, selected, onToggleSelect, onLoadMore, loading }: Props) {
  const [pages, setPages] = useState<Page[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [loadingNext, setLoadingNext] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchCurrentX = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  // Initialize with first page
  useEffect(() => {
    if (initialDishes.length > 0) {
      setPages(prev => {
        if (prev.length === 0) return [{ dishes: initialDishes }];
        // Update first page if dishes changed (e.g. filter switch)
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

  const goToPage = useCallback(async (direction: "next" | "prev") => {
    if (direction === "prev" && currentPage > 0) {
      setCurrentPage(p => p - 1);
      return;
    }

    if (direction === "next") {
      dismissHint();

      // If next page already loaded, just go there
      if (currentPage + 1 < pages.length) {
        setCurrentPage(p => p + 1);
        return;
      }

      // Load new page — pass current page dishes for context
      setLoadingNext(true);
      try {
        const currentDishes = pages[currentPage]?.dishes ?? [];
        const newDishes = await onLoadMore(currentDishes);
        if (newDishes.length > 0) {
          setPages(prev => [...prev, { dishes: newDishes }]);
          setCurrentPage(p => p + 1);
        }
      } catch {}
      setLoadingNext(false);
    }
  }, [currentPage, pages.length, onLoadMore, dismissHint]);

  // Touch handlers
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchCurrentX.current = e.touches[0].clientX;
    isHorizontalSwipe.current = null;
    setSwiping(true);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    touchCurrentX.current = currentX;

    // Determine swipe direction on first significant move
    if (isHorizontalSwipe.current === null) {
      const dx = Math.abs(currentX - touchStartX.current);
      const dy = Math.abs(currentY - touchStartY.current);
      if (dx > 8 || dy > 8) {
        isHorizontalSwipe.current = dx > dy;
      }
    }

    if (isHorizontalSwipe.current) {
      const dx = currentX - touchStartX.current;
      // Resist swipe left if loading, resist swipe right if on first page
      if (dx > 0 && currentPage === 0) {
        setSwipeOffset(dx * 0.3); // rubber band
      } else if (dx < 0 && loadingNext) {
        setSwipeOffset(dx * 0.3);
      } else {
        setSwipeOffset(dx);
      }
    }
  }, [swiping, currentPage, loadingNext]);

  const onTouchEnd = useCallback(() => {
    if (!swiping) return;
    setSwiping(false);

    const dx = touchCurrentX.current - touchStartX.current;
    const threshold = 60;

    if (isHorizontalSwipe.current && Math.abs(dx) > threshold) {
      if (dx < -threshold && !loadingNext) {
        goToPage("next");
      } else if (dx > threshold && currentPage > 0) {
        goToPage("prev");
      }
    }

    setSwipeOffset(0);
    isHorizontalSwipe.current = null;
  }, [swiping, currentPage, loadingNext, goToPage]);

  // Mouse drag support for desktop
  const mouseDown = useRef(false);
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    mouseDown.current = true;
    touchStartX.current = e.clientX;
    touchCurrentX.current = e.clientX;
    isHorizontalSwipe.current = true;
    setSwiping(true);
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!mouseDown.current) return;
    touchCurrentX.current = e.clientX;
    const dx = e.clientX - touchStartX.current;
    if (dx > 0 && currentPage === 0) {
      setSwipeOffset(dx * 0.3);
    } else if (dx < 0 && loadingNext) {
      setSwipeOffset(dx * 0.3);
    } else {
      setSwipeOffset(dx);
    }
  }, [currentPage, loadingNext]);

  const onMouseUp = useCallback(() => {
    if (!mouseDown.current) return;
    mouseDown.current = false;
    const dx = touchCurrentX.current - touchStartX.current;
    const threshold = 60;

    if (Math.abs(dx) > threshold) {
      if (dx < -threshold && !loadingNext) goToPage("next");
      else if (dx > threshold && currentPage > 0) goToPage("prev");
    }

    setSwiping(false);
    setSwipeOffset(0);
  }, [currentPage, loadingNext, goToPage]);

  const currentDishes = pages[currentPage]?.dishes ?? [];

  // Nudge messages based on selection count
  const nudgeMessage = selected.size >= 5
    ? "Ya tenemos suficiente, ¿vemos qué encontró el Genio?"
    : selected.size >= 3
    ? "El Genio ya tiene ideas para ti"
    : null;

  if (loading && pages.length === 0) {
    return <p className="font-body" style={{ color: "#999", textAlign: "center", padding: 40 }}>Cargando platos...</p>;
  }

  return (
    <div style={{ position: "relative", overflow: "hidden", userSelect: "none" }}>
      {/* Swipe hint overlay */}
      {showHint && (
        <div
          onClick={dismissHint}
          style={{
            position: "absolute", inset: 0, zIndex: 10,
            background: "rgba(0,0,0,0.4)", borderRadius: 14,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 8, cursor: "pointer",
          }}
        >
          <div className="swipe-hint-arrow" style={{ fontSize: 36, color: "#FFF", animation: "swipeHint 1.5s ease-in-out infinite" }}>
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

      {/* Loading overlay for next page */}
      {loadingNext && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          background: "rgba(255,255,255,0.85)", borderRadius: 14,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <p style={{ fontSize: 32 }}>🧞</p>
          <p className="font-display" style={{ fontSize: "0.82rem", color: "#666" }}>Buscando más platos...</p>
        </div>
      )}

      {/* Swipeable container */}
      <div
        ref={containerRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{
          transform: swiping ? `translateX(${swipeOffset}px)` : "translateX(0)",
          transition: swiping ? "none" : "transform 0.3s ease",
          touchAction: "pan-y",
        }}
      >
        <DishGrid dishes={currentDishes} selected={selected} onToggleSelect={onToggleSelect} loading={false} />
      </div>

      {/* Page indicator — subtle dots */}
      {pages.length > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 4, marginBottom: 4 }}>
          {pages.map((_, i) => (
            <div key={i} style={{
              width: i === currentPage ? 16 : 5, height: 5, borderRadius: 99,
              background: i === currentPage ? "#0D0D0D" : "#E0E0E0",
              transition: "all 0.3s ease",
            }} />
          ))}
        </div>
      )}

      {/* Nudge message */}
      {nudgeMessage && (
        <div style={{
          textAlign: "center", padding: "8px 16px", marginTop: 4,
          background: selected.size >= 5 ? "rgba(255,214,0,0.15)" : "transparent",
          borderRadius: 12, transition: "all 0.3s ease",
        }}>
          <p className="font-display" style={{
            fontSize: "0.82rem",
            color: selected.size >= 5 ? "#0D0D0D" : "#999",
            fontWeight: selected.size >= 5 ? 600 : 400,
          }}>
            🧞 {nudgeMessage}
          </p>
        </div>
      )}
    </div>
  );
}
