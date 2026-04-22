"use client";

import { useState, useRef } from "react";
import { ThumbsUp } from "lucide-react";
import { useFavorites } from "@/contexts/FavoritesContext";

interface Props {
  dishId: string;
  restaurantId: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function FavoriteHeart({ dishId, restaurantId, size = 20, className, style }: Props) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const [animating, setAnimating] = useState(false);
  const [showLocalTip, setShowLocalTip] = useState(false);
  const [tipPos, setTipPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const active = isFavorite(dishId);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setAnimating(true);
    const wasFirst = !active && !sessionStorage.getItem("qc_favorites_tip_seen");
    await toggleFavorite(dishId, restaurantId);
    setTimeout(() => setAnimating(false), 400);
    if (wasFirst && btnRef.current) {
      sessionStorage.setItem("qc_favorites_tip_seen", "1");
      const rect = btnRef.current.getBoundingClientRect();
      setTipPos({ top: rect.top - 8, right: window.innerWidth - rect.right });
      setShowLocalTip(true);
      setTimeout(() => setShowLocalTip(false), 5000);
    }
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleClick}
        className={className}
        aria-label={active ? "Quitar me gusta" : "Me gusta"}
        style={{
          background: active ? "rgba(244,166,35,0.15)" : "rgba(255,255,255,0.85)",
          border: "none",
          borderRadius: "50%",
          width: size + 12,
          height: size + 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "transform 0.1s, background 0.2s",
          animation: animating ? "likeBounce 0.4s ease-out" : undefined,
          ...style,
        }}
      >
        <ThumbsUp
          size={size}
          color={active ? "#F4A623" : "#6B7280"}
          fill={active ? "#F4A623" : "none"}
          strokeWidth={2}
        />
      </button>

      {/* First-like tip */}
      {showLocalTip && tipPos && (
        <div className="font-[family-name:var(--font-dm)]" style={{
          position: "fixed", right: tipPos.right, bottom: window.innerHeight - tipPos.top + 4,
          background: "#FFF4E6", borderRadius: 12, padding: "8px 12px",
          boxShadow: "0 4px 16px rgba(180,130,50,0.2)", zIndex: 200,
          width: 200, animation: "likeTipIn 0.3s ease-out",
        }}>
          <p style={{ fontSize: "12px", color: "#5c3d1e", margin: 0, lineHeight: 1.4 }}>
            Dale me gusta a los platos y el Genio te recomendará mejor
          </p>
          <div style={{ position: "absolute", bottom: -5, right: 12, width: 10, height: 10, background: "#FFF4E6", transform: "rotate(45deg)" }} />
        </div>
      )}

      <style>{`
        @keyframes likeBounce {
          0% { transform: scale(1); }
          20% { transform: scale(0.8); }
          50% { transform: scale(1.3); }
          70% { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
        @keyframes likeTipIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
