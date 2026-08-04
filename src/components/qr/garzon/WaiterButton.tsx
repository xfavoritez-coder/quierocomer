"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
const TABLE_TS_PREFIX = "qr_table_ts_";
const TABLE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

/** Read saved table only if it hasn't expired (3h TTL) */
function readSavedTable(restaurantId: string): string | null {
  const val = localStorage.getItem(`${TABLE_KEY_PREFIX}${restaurantId}`);
  if (!val) return null;
  const ts = parseInt(localStorage.getItem(`${TABLE_TS_PREFIX}${restaurantId}`) || "0", 10);
  if (Date.now() - ts > TABLE_TTL_MS) {
    localStorage.removeItem(`${TABLE_KEY_PREFIX}${restaurantId}`);
    localStorage.removeItem(`${TABLE_TS_PREFIX}${restaurantId}`);
    return null;
  }
  return val;
}

function writeSavedTable(restaurantId: string, num: string) {
  localStorage.setItem(`${TABLE_KEY_PREFIX}${restaurantId}`, num);
  localStorage.setItem(`${TABLE_TS_PREFIX}${restaurantId}`, String(Date.now()));
}

export default function WaiterButton({ restaurantId, tableId, tableName, size = 62, waiterPanelActive = false }: WaiterButtonProps) {
  const [state, setState] = useState<ButtonState>("idle");
  const [toast, setToast] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [savedTable, setSavedTable] = useState<string | null>(null);
  const [panelActive, setPanelActive] = useState(waiterPanelActive);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [isLight, setIsLight] = useState(false);

  // Read saved table (with TTL) + check subscription on mount
  useEffect(() => {
    const stored = readSavedTable(restaurantId);
    if (stored) setSavedTable(stored);

    fetch(`/api/qr/waiter/subscribe?restaurantId=${restaurantId}`)
      .then((r) => r.json())
      .then((data) => { if (data.active) setPanelActive(true); })
      .catch(() => {});
  }, [restaurantId]);

  // Detect light mode from DOM (carta-light class on ancestor)
  useEffect(() => {
    setIsLight(!!btnRef.current?.closest(".carta-light"));
  }, []);

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
          dislikes: typeof window !== "undefined" ? localStorage.getItem("qr_dislikes") : null,
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

    if (tableId && tableId !== "general") {
      doCall();
      return;
    }

    if (panelActive && savedTable) {
      doCall();
      return;
    }

    setModalOpen(true);
  };

  const handleSaveTable = (num: string) => {
    writeSavedTable(restaurantId, num);
    setSavedTable(num);
    showTableToast(num);
  };

  const [tableToast, setTableToast] = useState<string | null>(null);
  const showTableToast = (num: string) => {
    setTableToast(num);
    setTimeout(() => setTableToast(null), 3500);
  };

  const handleSaveAndCall = (num: string) => {
    handleSaveTable(num);
    doCall(num);
  };

  const isInactive = !panelActive && !savedTable;

  // Toast positioning: to the left of the button, vertically centered
  const toastStyle = {
    position: "absolute" as const,
    right: size + 10,
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 60,
    whiteSpace: "nowrap" as const,
    animation: "waiterBubbleIn 0.2s ease-out",
  };
  const arrowRight = {
    position: "absolute" as const,
    top: "50%",
    right: -4,
    transform: "translateY(-50%) rotate(45deg)",
    width: 8,
    height: 8,
  };

  return (
    <div style={{ position: "relative", display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
      {/* Success bubble — to the left */}
      {state === "success" && (
        <div
          className="font-[family-name:var(--font-dm)]"
          style={{
            ...toastStyle,
            background: "#16a34a", color: "white",
            padding: "6px 14px", borderRadius: 50, fontSize: "0.78rem", fontWeight: 600,
            boxShadow: "0 4px 12px rgba(22,163,74,0.3)",
          }}
        >
          ¡Garzón avisado!
          <div style={{ ...arrowRight, background: "#16a34a" }} />
        </div>
      )}

      {/* Error toast — to the left */}
      {toast && (
        <div
          className="font-[family-name:var(--font-dm)]"
          style={{
            ...toastStyle,
            background: "#333", color: "white",
            padding: "6px 14px", borderRadius: 50, fontSize: "0.78rem", fontWeight: 500,
          }}
        >
          {toast}
          <div style={{ ...arrowRight, background: "#333" }} />
        </div>
      )}

      {/* Table saved toast — to the left */}
      {tableToast && !state.match(/calling|success/) && (
        <div
          className="font-[family-name:var(--font-dm)]"
          style={{
            ...toastStyle,
            background: "var(--carta-accent, #F4A623)", color: "#0e0e0e",
            padding: "8px 14px", borderRadius: 12, fontSize: "0.78rem", fontWeight: 600,
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            maxWidth: 200, lineHeight: 1.4,
          }}
        >
          <div>Mesa {tableToast} guardada 🔔</div>
          <div style={{ fontSize: "0.7rem", fontWeight: 500, opacity: 0.8, marginTop: 2 }}>Tócame cuando quieras llamar al garzón</div>
          <div style={{ ...arrowRight, right: -5, width: 10, height: 10, background: "var(--carta-accent, #F4A623)" }} />
        </div>
      )}

      {/* Bell button */}
      <button
        ref={btnRef}
        onClick={handleClick}
        className="flex items-center justify-center rounded-full transition-transform active:scale-95"
        style={{
          width: size,
          height: size,
          background: state === "success" ? "#16a34a" : isLight ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0.5)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: state === "success" ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)",
          boxShadow: state === "success" ? "0 4px 18px rgba(22,163,74,0.3)" : "0 4px 18px rgba(0,0,0,0.25)",
          animation: state === "calling" ? "waiterPulse 1s ease-in-out infinite" : undefined,
          opacity: isInactive ? 0.6 : 1,
        }}
      >
        {state === "success" ? (
          <Check size={size * 0.32} color="white" />
        ) : (
          <Bell
            size={size * 0.32}
            color={isInactive ? (isLight ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.5)") : "#F4A623"}
            fill={isInactive ? (isLight ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.5)") : "#F4A623"}
            style={{ animation: state === "calling" ? "waiterShake 0.3s ease-in-out infinite" : undefined }}
          />
        )}
      </button>

      {/* Mesa modal */}
      {modalOpen && typeof document !== "undefined" && createPortal(
        <ModalMesa
          panelActive={panelActive}
          onSave={handleSaveTable}
          onSaveAndCall={handleSaveAndCall}
          onClose={() => setModalOpen(false)}
          isLight={isLight}
        />,
        document.body
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
          from { opacity: 0; transform: translateX(4px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
