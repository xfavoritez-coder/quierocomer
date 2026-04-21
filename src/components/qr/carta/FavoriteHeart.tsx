"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { useFavorites } from "@/contexts/FavoritesContext";

interface Props {
  dishId: string;
  restaurantId: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function FavoriteHeart({ dishId, restaurantId, size = 20, className, style }: Props) {
  const { isFavorite, toggleFavorite, isFirstFavorite } = useFavorites();
  const [animating, setAnimating] = useState(false);
  const [showLocalTip, setShowLocalTip] = useState(false);
  const active = isFavorite(dishId);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setAnimating(true);
    const wasFirst = !active && !sessionStorage.getItem("qc_favorites_tip_seen");
    await toggleFavorite(dishId, restaurantId);
    setTimeout(() => setAnimating(false), 400);
    if (wasFirst) {
      setShowLocalTip(true);
      setTimeout(() => setShowLocalTip(false), 5000);
    }
  };

  return (
    <div style={{ position: "relative", display: "inline-flex", ...style }}>
      <button
        onClick={handleClick}
        className={className}
        aria-label={active ? "Quitar de favoritos" : "Agregar a favoritos"}
        style={{
          background: "rgba(255,255,255,0.85)",
          border: "none",
          borderRadius: "50%",
          width: size + 12,
          height: size + 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "transform 0.1s",
          animation: animating ? "heartBounce 0.4s ease-out" : undefined,
        }}
      >
        <Heart
          size={size}
          color={active ? "#F4A623" : "#6B7280"}
          fill={active ? "#F4A623" : "none"}
          strokeWidth={2}
        />
      </button>

      {/* First-favorite tip bubble — appears above the heart that was clicked */}
      {showLocalTip && (
        <div className="font-[family-name:var(--font-dm)]" style={{
          position: "absolute", bottom: "100%", right: 0, marginBottom: 8,
          background: "#FFF4E6", borderRadius: 12, padding: "8px 12px",
          boxShadow: "0 4px 16px rgba(180,130,50,0.2)", zIndex: 50,
          width: 200, animation: "heartTipIn 0.3s ease-out",
        }}>
          <p style={{ fontSize: "12px", color: "#5c3d1e", margin: 0, lineHeight: 1.4 }}>
            Marca los que te gusten y el Genio te recomendará mejor
          </p>
          <div style={{ position: "absolute", bottom: -5, right: 12, width: 10, height: 10, background: "#FFF4E6", transform: "rotate(45deg)" }} />
        </div>
      )}

      <style>{`
        @keyframes heartBounce {
          0% { transform: scale(1); }
          20% { transform: scale(0.8); }
          50% { transform: scale(1.3); }
          70% { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
        @keyframes heartTipIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
