"use client";

import { useState, useCallback, useEffect } from "react";
import { Bell, Check } from "lucide-react";

interface WaiterButtonProps {
  restaurantId: string;
  tableId?: string;
  tableName?: string;
}

type ButtonState = "loading" | "disabled" | "idle" | "calling" | "success";

export default function WaiterButton({ restaurantId, tableId, tableName }: WaiterButtonProps) {
  const [state, setState] = useState<ButtonState>("loading");
  const [toast, setToast] = useState<string | null>(null);

  // Check if waiter service is active (has subscriptions)
  useEffect(() => {
    fetch(`/api/qr/waiter/active-calls?restaurantId=${restaurantId}`)
      .then((r) => r.json())
      .then(() => {
        // Check for active subscriptions
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
      showToast("Llamar garzón no disponible de momento");
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
          tableName: tableName || "Cliente",
          dietType: typeof window !== "undefined" ? localStorage.getItem("qr_diet") : null,
          restrictions: typeof window !== "undefined" ? localStorage.getItem("qr_restrictions") : null,
        }),
      });

      if (res.ok) {
        setState("success");
        setTimeout(() => setState("idle"), 2500);
      } else {
        setState("idle");
        showToast("Intenta de nuevo");
      }
    } catch {
      setState("idle");
      showToast("Intenta de nuevo");
    }
  }, [state, restaurantId, tableId, tableName]);

  if (state === "loading") return null;

  const isDisabled = state === "disabled";

  return (
    <>
      <button
        onClick={handleCall}
        className="flex items-center justify-center rounded-full transition-transform"
        style={{
          width: 52,
          height: 52,
          background: state === "success" ? "#16a34a" : isDisabled ? "#555" : "#0e0e0e",
          boxShadow: isDisabled ? "none" : "0 4px 18px rgba(0,0,0,0.2)",
          opacity: isDisabled ? 0.5 : 1,
          animation: state === "calling" ? "waiterPulse 1s ease-in-out infinite" : undefined,
        }}
      >
        {state === "success" ? (
          <Check size={20} color="white" />
        ) : isDisabled ? (
          <Bell size={20} color="rgba(255,255,255,0.4)" />
        ) : (
          <Bell size={20} color="white" />
        )}
      </button>

      {state === "success" && (
        <div
          className="fixed font-[family-name:var(--font-dm)]"
          style={{
            bottom: 100, right: 20, background: "#16a34a", color: "white",
            padding: "8px 16px", borderRadius: 50, fontSize: "0.82rem", fontWeight: 600,
            boxShadow: "0 4px 16px rgba(22,163,74,0.3)", zIndex: 60,
            animation: "fadeInUp 0.2s ease-out",
          }}
        >
          ¡Garzón en camino!
        </div>
      )}

      {toast && (
        <div
          className="fixed font-[family-name:var(--font-dm)]"
          style={{
            bottom: 100, right: 20, background: "#333", color: "white",
            padding: "8px 16px", borderRadius: 50, fontSize: "0.82rem", fontWeight: 500,
            zIndex: 60, animation: "fadeInUp 0.2s ease-out",
          }}
        >
          {toast}
        </div>
      )}

      <style>{`
        @keyframes waiterPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(14,14,14,0.4); }
          50% { box-shadow: 0 0 0 12px rgba(14,14,14,0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
