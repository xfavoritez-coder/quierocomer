"use client";

const CAT_MAP: Record<string, { emoji: string; label: string }> = {
  SUSHI: { emoji: "🍣", label: "SUSHI" },
  MAIN_COURSE: { emoji: "🍽", label: "FONDO" },
  SALAD: { emoji: "🥗", label: "ENSALADA" },
  SOUP: { emoji: "🍲", label: "SOPA" },
  BREAKFAST: { emoji: "🍳", label: "DESAYUNO" },
  BRUNCH: { emoji: "🥑", label: "BRUNCH" },
  PASTA: { emoji: "🍝", label: "PASTA" },
  PIZZA: { emoji: "🍕", label: "PIZZA" },
  BURGER: { emoji: "🍔", label: "BURGER" },
  SANDWICH: { emoji: "🥪", label: "SÁNDWICH" },
  SEAFOOD: { emoji: "🦐", label: "MARISCOS" },
  DESSERT: { emoji: "🍮", label: "POSTRE" },
  ICE_CREAM: { emoji: "🍦", label: "HELADO" },
  VEGETARIAN: { emoji: "🥦", label: "VEGGIE" },
  VEGAN: { emoji: "🌱", label: "VEGANO" },
  COFFEE: { emoji: "☕", label: "CAFÉ" },
  JUICE: { emoji: "🧃", label: "JUGO" },
  DRINK: { emoji: "🥤", label: "BEBIDA" },
  SMOOTHIE: { emoji: "🥤", label: "SMOOTHIE" },
  COCKTAIL: { emoji: "🍹", label: "CÓCTEL" },
  BEER: { emoji: "🍺", label: "CERVEZA" },
  WINE: { emoji: "🍷", label: "VINO" },
  STARTER: { emoji: "🥢", label: "ENTRADA" },
  COMBO: { emoji: "🎁", label: "COMBO" },
  SHARING: { emoji: "🍢", label: "COMPARTIR" },
  WOK: { emoji: "🥘", label: "WOK" },
  OTHER: { emoji: "🍴", label: "PLATO" },
};

export default function DishPlaceholder({ categoria }: { categoria?: string }) {
  const cat = CAT_MAP[categoria ?? ""] ?? CAT_MAP.OTHER;
  return (
    <div style={{ width: "100%", height: "100%", background: "#F0F0F0", borderRadius: 10, border: "1px solid #E0E0E0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
      <span style={{ fontSize: 28, opacity: 0.4 }}>{cat.emoji}</span>
      <span className="font-display" style={{ fontSize: 9, color: "#0D0D0D", letterSpacing: "0.5px", fontWeight: 700, opacity: 0.4 }}>{cat.label}</span>
    </div>
  );
}
