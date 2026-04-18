"use client";
import { useAdminSession } from "./useAdminSession";

const F = "var(--font-display)";

export default function RestaurantPicker() {
  const { restaurants, selectedRestaurantId, isSuper, setSelectedRestaurant } = useAdminSession();

  if (restaurants.length <= 1 && !isSuper) return null;

  return (
    <select
      value={selectedRestaurantId || ""}
      onChange={(e) => setSelectedRestaurant(e.target.value)}
      style={{
        background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A",
        borderRadius: 10, padding: "8px 12px", color: "white",
        fontFamily: F, fontSize: "0.82rem", cursor: "pointer", outline: "none",
      }}
    >
      {isSuper && <option value="" style={{ background: "#1A1A1A" }}>Todos los locales</option>}
      {restaurants.map(r => (
        <option key={r.id} value={r.id} style={{ background: "#1A1A1A" }}>{r.name}</option>
      ))}
    </select>
  );
}
