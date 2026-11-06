"use client";

import { useSessionContext } from "@/lib/admin/SessionContext";
import PosReportesPanel from "@/app/pos/components/panels/PosReportesPanel";

// CSS tokens del POS aplicados localmente para que PosReportesPanel se vea bien.
const POS_TOKENS: React.CSSProperties = {
  "--surface": "#FFFFFF",
  "--sunk": "#FAF9F7",
  "--ink": "#1B1A17",
  "--ink-2": "#6E6B64",
  "--ink-3": "#A19D94",
  "--ink-4": "#C9C6BE",
  "--line": "#EAE8E2",
  "--line-strong": "#DCD9D1",
  "--amber": "#DE7C00",
  "--amber-press": "#B86500",
  "--amber-tint": "#FBEED6",
  "--jade": "#2F8F6B",
  "--jade-tint": "#E7F1EC",
  "--slate": "#3B6FB0",
  "--slate-tint": "#EAF0F8",
  "--r-card": "16px",
  "--sh-1": "0 1px 2px rgba(27,26,23,.04), 0 1px 3px rgba(27,26,23,.03)",
  "--sh-2": "0 2px 4px rgba(27,26,23,.05), 0 6px 16px rgba(27,26,23,.06)",
} as React.CSSProperties;

export default function ReportesPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;

  if (!restaurantId) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "var(--adm-text3)", fontFamily: "var(--font-body)", fontSize: "0.9rem" }}>
        Cargando…
      </div>
    );
  }

  return (
    <div style={{ ...POS_TOKENS, minHeight: "100%", background: "var(--adm-bg, #F5F4F1)" }}>
      <PosReportesPanel restaurantId={restaurantId} />
    </div>
  );
}
