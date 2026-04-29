"use client";

import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";

interface Props {
  panelActive: boolean;
  onSave: (tableNumber: string) => void;
  onSaveAndCall: (tableNumber: string) => void;
  onClose: () => void;
}

export default function ModalMesa({ panelActive, onSave, onSaveAndCall, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    document.body.style.overflow = "hidden";
    setTimeout(() => inputRef.current?.focus(), 300);
    return () => { document.body.style.overflow = ""; };
  }, []);

  const close = () => { setVisible(false); setTimeout(onClose, 250); };

  const handleSubmit = () => {
    if (!value) return;
    onSave(value);
    close();
  };

  return (
    <div className="fixed z-[110] flex items-end font-[family-name:var(--font-dm)]" style={{ top: 0, left: 0, right: 0, bottom: 0 }}>
      <div onClick={(e) => { if (e.target === e.currentTarget) close(); }} className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)", opacity: visible ? 1 : 0, transition: "opacity 0.2s" }} />
      <div style={{
        position: "relative", zIndex: 1, background: "#0e0e0e", width: "100%",
        borderRadius: "20px 20px 0 0", padding: "28px 24px calc(48px + env(safe-area-inset-bottom))",
        transform: visible ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.25s ease-out",
      }}>
        {/* Close X */}
        <button onClick={close} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: "1rem", cursor: "pointer" }}>✕</button>

        {/* Icon */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <Bell size={32} color="#F4A623" style={{ margin: "0 auto" }} />
        </div>

        {/* Title */}
        <h3
          className="font-[family-name:var(--font-playfair)]"
          style={{ fontSize: "1.3rem", fontWeight: 900, color: "white", textAlign: "center", margin: "0 0 6px" }}
        >
          ¿En qué mesa estás?
        </h3>

        {/* Subtitle */}
        <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.4)", textAlign: "center", margin: "0 0 24px" }}>
          Así podrás llamar al garzón cuando lo necesites.
        </p>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Ej: 4, A1, Terraza"
          style={{
            width: "100%", padding: "14px 16px", boxSizing: "border-box",
            background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 12, color: "white", fontSize: "1.2rem", textAlign: "center",
            outline: "none", fontFamily: "inherit",
          }}
        />

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!value}
          className="active:scale-[0.98] transition-transform"
          style={{
            width: "100%", marginTop: 16, padding: "14px",
            background: "#F4A623", color: "white", border: "none",
            borderRadius: 50, fontSize: "0.95rem", fontWeight: 700,
            fontFamily: "inherit", cursor: value ? "pointer" : "default",
            opacity: value ? 1 : 0.4,
          }}
        >
          Guardar
        </button>

        {/* Cancel */}
        <button
          onClick={close}
          style={{
            display: "block", width: "100%", marginTop: 8, padding: "10px",
            background: "none", border: "none", color: "rgba(255,255,255,0.3)",
            fontSize: "0.85rem", fontFamily: "inherit", cursor: "pointer", textAlign: "center",
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
