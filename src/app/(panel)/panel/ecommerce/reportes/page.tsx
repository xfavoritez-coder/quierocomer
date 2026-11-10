"use client";

import { useSessionContext } from "@/lib/admin/SessionContext";
import PosReportesPanel from "@/app/pos/components/panels/PosReportesPanel";

// Estilos del POS inyectados en el panel: tokens + clases de pos.css que usa PosReportesPanel.
// Se escapan los márgenes del contenedor del panel (owl-main: 24px/32px desktop, 20px/16px mobile)
// para que el panel de reportes ocupe el ancho completo igual que en el POS.
const POS_EMBED_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

  .ecom-rep-wrap {
    --bg: #F5F4F1;
    --surface: #FFFFFF;
    --sunk: #FAF9F7;
    --ink: #1B1A17;
    --ink-2: #6E6B64;
    --ink-3: #A19D94;
    --ink-4: #C9C6BE;
    --line: #EAE8E2;
    --line-strong: #DCD9D1;
    --amber: #DE7C00;
    --amber-press: #B86500;
    --amber-tint: #FBEED6;
    --amber-tint-2: #FDF7EC;
    --jade: #2F8F6B;
    --jade-tint: #E7F1EC;
    --slate: #3B6FB0;
    --slate-tint: #EAF0F8;
    --r-card: 16px;
    --r-btn: 12px;
    --r-chip: 999px;
    --sh-1: 0 1px 2px rgba(27,26,23,.04), 0 1px 3px rgba(27,26,23,.03);
    --sh-2: 0 2px 4px rgba(27,26,23,.05), 0 6px 16px rgba(27,26,23,.06);
    --sans: 'Inter', system-ui, sans-serif;
    --mono: 'IBM Plex Mono', monospace;

    /* Escapar el padding del owl-main para que llene borde a borde */
    margin: -24px -32px;
    background: var(--surface);
    min-height: calc(100vh + 24px);
  }
  @media (max-width: 767px) {
    .ecom-rep-wrap { margin: -20px -16px; min-height: calc(100vh - 58px + 20px); }
  }

  /* pos-scroll: en el panel el scroll lo maneja la página */
  .ecom-rep-wrap .pos-scroll {
    background: var(--surface);
  }

  /* Overlay de modales (CustomerDetail, etc.) */
  .ecom-rep-wrap .pos-modal-overlay {
    position: fixed; inset: 0;
    background: rgba(27,26,23,.5);
    z-index: 200;
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
  }

  /* Date picker */
  .ecom-rep-wrap .pos-date-box {
    position: relative;
    display: flex; align-items: center;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--sunk);
    padding: 6px; gap: 4px;
    flex: 1 1 0; min-width: 0; overflow: hidden;
  }
  .ecom-rep-wrap .pos-date-box input[type=date] {
    flex: 1; min-width: 0;
    border: none; outline: none;
    background: transparent;
    font-family: var(--sans);
    font-size: .82rem; color: var(--ink);
    cursor: pointer; padding: 6px 0;
  }
  .ecom-rep-wrap .pos-date-box input[type=date]::-webkit-calendar-picker-indicator {
    opacity: 0; position: absolute; inset: 0; width: 100%; height: 100%; cursor: pointer;
  }
  .ecom-rep-wrap .pos-date-preset { flex: 0 0 auto; order: -1; }
`;

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
    <div className="ecom-rep-wrap">
      <style dangerouslySetInnerHTML={{ __html: POS_EMBED_CSS }} />
      <PosReportesPanel restaurantId={restaurantId} />
    </div>
  );
}
