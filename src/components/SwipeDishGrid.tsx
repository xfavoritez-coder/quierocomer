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
  // Slide transition: "idle" | "exit-left" | "exit-right"
  const [slideState, setSlideState] = useState<"idle" | "exit-left" | "exit-right">("idle");
  const [enterFrom, setEnterFrom] = useState<"left" | "right" | null>(null);

  const trackRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchCurrentX = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);
  const containerWidth = useRef(0);

  // Measure container width
  useEffect(() => {
    if (trackRef.current) {
      containerWidth.current = trackRef.current.offsetWidth;
    }
  });

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

  // Nudge messages based on selection count
  const nudgeMessage = selected.size >= 5
    ? "Ya tenemos suficiente, ¿vemos qué encontró el Genio?"
    : selected.size >= 3
    ? "El Genio ya tiene ideas para ti"
    : null;

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
        style={{ overflow: "hidden" }}
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
            minHeight: loadingNext ? 300 : undefined,
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
