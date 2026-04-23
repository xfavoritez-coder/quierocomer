"use client";

import { useState, useCallback, useEffect } from "react";
import { Bell, Check } from "lucide-react";
import ModalMesa from "./ModalMesa";
import { getSessionId, getGuestId } from "@/lib/guestId";
import { getDbSessionId } from "@/lib/sessionTracker";

interface WaiterButtonProps {
  restaurantId: string;
  tableId?: string;
  tableName?: string;
  size?: number;
  waiterPanelActive?: boolean;
}

type ButtonState = "idle" | "calling" | "success";

const TABLE_KEY_PREFIX = "qr_table_";

export default function WaiterButton({ restaurantId, tableId, tableName, size = 52, waiterPanelActive = false }: WaiterButtonProps) {
  const [state, setState] = useState<ButtonState>("idle");
  const [toast, setToast] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [savedTable, setSavedTable] = useState<string | null>(null);
  const [panelActive, setPanelActive] = useState(waiterPanelActive);

  // Read saved table + check subscription on mount
  useEffect(() => {
    const stored = localStorage.getItem(`${TABLE_KEY_PREFIX}${restaurantId}`);
    if (stored) setSavedTable(stored);

    // Check if waiter panel has active subscriptions (overrides prop if true)
    fetch(`/api/qr/waiter/subscribe?restaurantId=${restaurantId}`)
      .then((r) => r.json())
      .then((data) => { if (data.active) setPanelActive(true); })
      .catch(() => {});
  }, [restaurantId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const doCall = useCallback(async (tableNum?: string) => {
    setState("calling");
    try {
      const effectiveTableName = tableNum ? `Mesa ${tableNum}` : tableName || (savedTable ? `Mesa ${savedTable}` : "Mesa 11");
      const res = await fetch("/api/qr/waiter/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          tableId: tableId || "general",
          tableName: effectiveTableName,
          sessionId: getDbSessionId() || getSessionId(),
          guestId: getGuestId(),
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
  }, [restaurantId, tableId, tableName, savedTable]);

  const handleClick = () => {
    if (state !== "idle") return;

    // Has explicit tableId from QR scan — call directly
    if (tableId && tableId !== "general") {
      doCall();
      return;
    }

    // Panel active + saved table — call directly
    if (panelActive && savedTable) {
      doCall();
      return;
    }

    // No saved table — open modal to ask for table number
    setModalOpen(true);
  };

  const handleSaveTable = (num: string) => {
    localStorage.setItem(`${TABLE_KEY_PREFIX}${restaurantId}`, num);
    setSavedTable(num);
  };

  const handleSaveAndCall = (num: string) => {
    handleSaveTable(num);
    doCall(num);
  };

  const isInactive = !panelActive && !savedTable;

  return (
    <div style={{ position: "relative", display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
      {/* Success bubble — opens to the left */}
      {state === "success" && (
        <div
          className="font-[family-name:var(--font-dm)]"
          style={{
            position: "absolute", top: "50%", right: size + 10, transform: "translateY(-50%)",
            background: "#16a34a", color: "white",
            padding: "6px 14px", borderRadius: 50, fontSize: "0.78rem", fontWeight: 600,
            boxShadow: "0 4px 12px rgba(22,163,74,0.3)", zIndex: 60,
            whiteSpace: "nowrap", animation: "waiterBubbleIn 0.2s ease-out",
          }}
        >
          ¡Garzón avisado!
          <div style={{ position: "absolute", top: "50%", right: -4, transform: "translateY(-50%) rotate(45deg)", width: 8, height: 8, background: "#16a34a" }} />
        </div>
      )}

      {/* Error toast — opens to the left */}
      {toast && (
        <div
          className="font-[family-name:var(--font-dm)]"
          style={{
            position: "absolute", top: "50%", right: size + 10, transform: "translateY(-50%)",
            background: "#333", color: "white",
            padding: "6px 14px", borderRadius: 50, fontSize: "0.78rem", fontWeight: 500,
            zIndex: 60, whiteSpace: "nowrap", animation: "waiterBubbleIn 0.2s ease-out",
          }}
        >
          {toast}
          <div style={{ position: "absolute", top: "50%", right: -4, transform: "translateY(-50%) rotate(45deg)", width: 8, height: 8, background: "#333" }} />
        </div>
      )}

      {/* Bell button — always visible */}
      <button
        onClick={handleClick}
        className="flex items-center justify-center rounded-full transition-transform active:scale-95"
        style={{
          width: size,
          height: size,
          background: state === "success" ? "#16a34a" : isInactive ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.55)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: state === "success" ? "none" : "1px solid rgba(255,255,255,0.08)",
          boxShadow: state === "success" ? "0 4px 18px rgba(22,163,74,0.3)" : "0 4px 18px rgba(0,0,0,0.2)",
          animation: state === "calling" ? "waiterPulse 1s ease-in-out infinite" : undefined,
          opacity: isInactive ? 0.6 : 1,
        }}
      >
        {state === "success" ? (
          <Check size={size * 0.38} color="white" />
        ) : (
          <Bell
            size={size * 0.38}
            color={isInactive ? "rgba(255,255,255,0.5)" : "#F4A623"}
            fill={isInactive ? "rgba(255,255,255,0.5)" : "#F4A623"}
            style={{ animation: state === "calling" ? "waiterShake 0.3s ease-in-out infinite" : undefined }}
          />
        )}
      </button>

      {/* Mesa modal */}
      {modalOpen && (
        <ModalMesa
          panelActive={panelActive}
          onSave={handleSaveTable}
          onSaveAndCall={handleSaveAndCall}
          onClose={() => setModalOpen(false)}
        />
      )}

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
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
