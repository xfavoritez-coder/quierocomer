import { Sparkles } from "lucide-react";

export default function CartaLoading() {
  return (
    <div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div style={{ animation: "genioLoadFloat 1.5s ease-in-out infinite" }}>
          <Sparkles size={28} color="#F4A623" fill="#F4A623" style={{ filter: "drop-shadow(0 0 12px rgba(244,166,35,0.5))" }} />
        </div>
        <p className="text-white/60 font-[family-name:var(--font-dm)] text-sm">
          Cargando carta...
        </p>
        <style>{`@keyframes genioLoadFloat { 0%,100% { transform: translateY(0) scale(1); opacity: 0.7; } 50% { transform: translateY(-8px) scale(1.15); opacity: 1; } }`}</style>
      </div>
    </div>
  );
}
