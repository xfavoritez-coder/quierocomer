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
  const { isFavorite, toggleFavorite } = useFavorites();
  const [animating, setAnimating] = useState(false);
  const active = isFavorite(dishId);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setAnimating(true);
    await toggleFavorite(dishId, restaurantId);
    setTimeout(() => setAnimating(false), 400);
  };

  return (
    <>
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
          ...style,
        }}
      >
        <Heart
          size={size}
          color={active ? "#F4A623" : "#6B7280"}
          fill={active ? "#F4A623" : "none"}
          strokeWidth={2}
        />
      </button>
      <style>{`
        @keyframes heartBounce {
          0% { transform: scale(1); }
          20% { transform: scale(0.8); }
          50% { transform: scale(1.3); }
          70% { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
      `}</style>
    </>
  );
}
