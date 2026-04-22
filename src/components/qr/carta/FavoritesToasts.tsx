"use client";

import { useFavorites } from "@/contexts/FavoritesContext";
import GenioTip from "../genio/GenioTip";
import { useState } from "react";
import LoginDrawer from "../auth/LoginDrawer";

export default function FavoritesToasts() {
  const { isFirstFavorite, showConversionPrompt, dismissConversion } = useFavorites();
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <>
      {/* Conversion toast — at 3 favorites, not logged in */}
      {showConversionPrompt && (
        <div style={{ position: "fixed", bottom: "calc(100px + env(safe-area-inset-bottom))", left: "50%", transform: "translateX(-50%)", zIndex: 80, width: 300, maxWidth: "90%" }}>
          <GenioTip
            arrow={null}
            onClose={dismissConversion}
            
          >
            <span>Tienes platos que te gustan. Regístrate con tu email y los guardamos siempre, en todos los restaurantes.</span>
            <button
              onClick={() => { dismissConversion(); setLoginOpen(true); }}
              className="active:scale-[0.98] transition-transform"
              style={{
                display: "block", width: "100%", marginTop: 10,
                background: "#F4A623", color: "white", border: "none",
                borderRadius: 50, padding: "10px", fontSize: "0.85rem",
                fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
              }}
            >
              Guardar mis gustos
            </button>
          </GenioTip>
        </div>
      )}

      {loginOpen && <LoginDrawer onClose={() => setLoginOpen(false)} />}
    </>
  );
}
