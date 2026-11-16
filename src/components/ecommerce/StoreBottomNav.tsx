"use client";
import React from "react";
import { Home, Heart, ShoppingCart, MessageCircle, User } from "lucide-react";

// Barra flotante inferior del storefront (5 íconos planos estilo Instagram, con
// el color de la marca en el activo; el carrito lleva su badge). Componente ÚNICO
// reutilizado por el storefront (StoreFront.tsx) y la pantalla de seguimiento de
// pedido (/pedido/[orderId]) para que no haya dos navs distintos.
export interface StoreBottomNavProps {
  color: string;
  active?: string | null; // "home" | "favorites" | "contact" | "profile"
  badge?: number;
  cartBump?: boolean;
  /** storefront: true (solo móvil, sm:hidden). seguimiento: false (siempre). */
  hideOnDesktop?: boolean;
  onHome: () => void;
  onFavorites: () => void;
  onCart: () => void;
  onContact: () => void;
  onProfile: () => void;
}

export default function StoreBottomNav({
  color, active = null, badge = 0, cartBump = false, hideOnDesktop = false,
  onHome, onFavorites, onCart, onContact, onProfile,
}: StoreBottomNavProps) {
  return (
    <nav
      className={`${hideOnDesktop ? "sm:hidden " : ""}fixed inset-x-4 z-40 flex justify-center pointer-events-none`}
      style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <div className="pointer-events-auto relative flex items-center justify-around w-full max-w-md mx-auto bg-white/95 backdrop-blur rounded-full shadow-[0_10px_34px_rgba(0,0,0,0.20)] border border-gray-100 px-2 h-16">
        <NavBtn label="Inicio" color={color} active={active === "home"} onClick={onHome}><Home className="w-6 h-6" /></NavBtn>
        <NavBtn label="Favoritos" color={color} active={active === "favorites"} onClick={onFavorites}><Heart className="w-6 h-6" /></NavBtn>
        <NavBtn label="Ver carrito" color={color} onClick={onCart}>
          <span className={`relative inline-flex ${cartBump ? "cart-bump" : ""}`}>
            <ShoppingCart className="w-6 h-6" />
            {badge > 0 && (
              <span className="absolute -top-1.5 -right-1.5 text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center shadow" style={{ background: color }}>{badge}</span>
            )}
          </span>
        </NavBtn>
        <NavBtn label="Contacto" color={color} active={active === "contact"} onClick={onContact}><MessageCircle className="w-6 h-6" /></NavBtn>
        <NavBtn label="Perfil" color={color} active={active === "profile"} onClick={onProfile}><User className="w-6 h-6" /></NavBtn>
      </div>
    </nav>
  );
}

function NavBtn({ children, label, onClick, active, color }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean; color: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`w-11 h-11 flex items-center justify-center rounded-full transition active:scale-90 ${active ? "" : "text-gray-400 hover:text-gray-700"}`}
      style={active ? { color } : undefined}
    >
      {children}
    </button>
  );
}
