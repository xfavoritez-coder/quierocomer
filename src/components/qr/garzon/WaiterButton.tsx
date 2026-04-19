"use client";

import { useState, useCallback, useEffect } from "react";
import { Bell, Check } from "lucide-react";

interface WaiterButtonProps {
  restaurantId: string;
  tableId?: string;
  tableName?: string;
  size?: number;
}

type ButtonState = "loading" | "disabled" | "idle" | "calling" | "success";

export default function WaiterButton({ restaurantId, tableId, tableName, size = 52 }: WaiterButtonProps) {
  const [state, setState] = useState<ButtonState>("loading");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/qr/waiter/active-calls?restaurantId=${restaurantId}`)
      .then((r) => r.json())
      .then(() => {
        fetch(`/api/qr/waiter/subscribe?restaurantId=${restaurantId}`)
          .then((r) => r.json())
          .then((data) => setState(data.active ? "idle" : "disabled"))
          .catch(() => setState("disabled"));
      })
      .catch(() => setState("disabled"));
  }, [restaurantId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleCall = useCallback(async () => {
    if (state === "disabled") {
      showToast("No disponible de momento");
      return;
    }
    if (state !== "idle") return;

    setState("calling");

    try {
      const res = await fetch("/api/qr/waiter/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          tableId: tableId || "general",
          tableName: tableName || "Mesa 11",
          dietType: typeof window !== "undefined" ? localStorage.getItem("qr_diet") : null,
          restrictions: typeof window !== "undefined" ? localStorage.getItem("qr_restrictions") : null,
        }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok) {
        setState("success");
        setTimeout(() => setState("idle"), 2500);
      } else {
        console.error("Waiter call failed:", res.status, data);
        setState("idle");
        showToast(data?.error || "Intenta de nuevo");
      }
    } catch (err) {
      console.error("Waiter call error:", err);
      setState("idle");
      showToast("Error de conexión");
    }
  }, [state, restaurantId, tableId, tableName]);

  const isDisabled = state === "disabled" || state === "loading";

  return (
    <div style={{ position: "relative", display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
      {/* Success / error bubble — positioned above button */}
      {state === "success" && (
        <div
          className="font-[family-name:var(--font-dm)]"
          style={{
            position: "absolute", bottom: size + 8, left: "50%", transform: "translateX(-50%)",
            background: "#16a34a", color: "white",
            padding: "6px 14px", borderRadius: 50, fontSize: "0.78rem", fontWeight: 600,
            boxShadow: "0 4px 12px rgba(22,163,74,0.3)", zIndex: 60,
            whiteSpace: "nowrap", animation: "waiterBubbleIn 0.2s ease-out",
          }}
        >
          ¡Garzón avisado!
          <div style={{ position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%) rotate(45deg)", width: 8, height: 8, background: "#16a34a" }} />
        </div>
      )}

      {toast && (
        <div
          className="font-[family-name:var(--font-dm)]"
          style={{
            position: "absolute", bottom: size + 8, left: "50%", transform: "translateX(-50%)",
            background: "#333", color: "white",
            padding: "6px 14px", borderRadius: 50, fontSize: "0.78rem", fontWeight: 500,
            zIndex: 60, whiteSpace: "nowrap", animation: "waiterBubbleIn 0.2s ease-out",
          }}
        >
          {toast}
          <div style={{ position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%) rotate(45deg)", width: 8, height: 8, background: "#333" }} />
        </div>
      )}

      <button
        onClick={handleCall}
        className="flex items-center justify-center rounded-full transition-transform active:scale-95"
        style={{
          width: size,
          height: size,
          background: state === "success" ? "#16a34a" : "rgba(0,0,0,0.55)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: state === "success" ? "none" : "1px solid rgba(255,255,255,0.08)",
          boxShadow: state === "success" ? "0 4px 18px rgba(22,163,74,0.3)" : "0 4px 18px rgba(0,0,0,0.2)",
          animation: state === "calling" ? "waiterPulse 1s ease-in-out infinite" : undefined,
        }}
      >
        {state === "success" ? (
          <Check size={size * 0.38} color="white" />
        ) : (
          <Bell
            size={size * 0.38}
            color={isDisabled ? "rgba(255,255,255,0.5)" : "#F4A623"}
            fill={isDisabled ? "rgba(255,255,255,0.5)" : "#F4A623"}
            style={{ animation: state === "calling" ? "waiterShake 0.3s ease-in-out infinite" : undefined }}
          />
        )}
      </button>

      <style>{`
        @keyframes waiterPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(14,14,14,0.4); }
          50% { box-shadow: 0 0 0 12px rgba(14,14,14,0); }
        }
        @keyframes waiterShake {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(14deg); }
          40% { transform: rotate(-14deg); }
          60% { transform: rotate(10deg); }
          80% { transform: rotate(-6deg); }
        }
        @keyframes waiterBubbleIn {
          from { opacity: 0; transform: translateX(-50%) translateY(4px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
