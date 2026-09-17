"use client";
import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import PlanPageGate from "@/components/admin/PlanPageGate";
import { Bell, Copy, Check, ChevronRight } from "lucide-react";
import { usePanelLang } from "@/lib/i18n/panel";
import QRCode from "qrcode";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

const HOW_STEPS = [
  {
    emoji: "📱",
    step: "1",
    title: "El cliente escanea tu carta",
    desc: "Abre la carta digital desde su celular con el código QR de la mesa. Sin descargar nada.",
    img: "/garzon-carta.png",
    imgAlt: "Carta digital con botón llamar garzón",
  },
  {
    emoji: "🔔",
    step: "2",
    title: "Toca el botón Llamar garzón",
    desc: "El botón aparece en la carta. El cliente lo presiona desde su asiento, sin buscar a nadie.",
    img: "/garzon-boton.png",
    imgAlt: "Botón llamar al garzón",
  },
  {
    emoji: "⚡",
    step: "3",
    title: "Tu garzón recibe la alerta",
    desc: "Notificación con sonido al instante con el número de mesa. Nada se pierde.",
    img: "/garzon-alerta.png",
    imgAlt: "Notificación garzón solicitado",
  },
];

export default function GarzonPage() {
  const { t } = usePanelLang();
  const { restaurants, selectedRestaurantId } = useAdminSession();
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const restaurant = restaurants.find(r => r.id === selectedRestaurantId);
  const garzonLink = restaurant ? `https://quierocomer.com/qr/${restaurant.slug}/garzon` : "";

  useEffect(() => {
    if (!garzonLink) return;
    QRCode.toDataURL(garzonLink, { width: 400, margin: 1, errorCorrectionLevel: "H", color: { dark: "#0e0e0e", light: "#ffffff" } })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [garzonLink]);

  const copyLink = () => {
    navigator.clipboard.writeText(garzonLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!restaurant) {
    return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "var(--adm-text2)", fontFamily: F }}>{t("home_select_restaurant")}</p></div>;
  }

  return (
    <PlanPageGate feature="waiter">
    <div style={{ maxWidth: 640 }}>

      {/* ── Hero ── */}
      <div style={{
        position: "relative", overflow: "hidden",
        background: "linear-gradient(135deg, rgba(244,166,35,0.10) 0%, rgba(244,166,35,0.03) 100%)",
        border: `1px solid ${GOLD}30`,
        borderRadius: 20, padding: "24px 22px", marginBottom: 28,
      }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: `radial-gradient(circle, ${GOLD}10 0%, transparent 70%)`, pointerEvents: "none" }} />
        <p style={{ fontFamily: F, fontSize: "0.63rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: GOLD, margin: "0 0 8px" }}>
          Garzón Digital
        </p>
        <h1 style={{ fontFamily: F, fontSize: "1.45rem", fontWeight: 800, color: "var(--adm-text)", margin: "0 0 10px", lineHeight: 1.15 }}>
          El cliente pide ayuda.<br />
          <span style={{ color: GOLD }}>Tu equipo responde al instante.</span>
        </h1>
        <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.55 }}>
          Sin timbre físico, sin agitar las manos. El cliente toca un botón en la carta y tu garzón recibe la alerta en su teléfono con el número de mesa.
        </p>
      </div>

      {/* ── Cómo funciona: timeline visual ── */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontFamily: F, fontSize: "0.63rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--adm-text3)", margin: "0 0 18px" }}>
          Cómo funciona · 3 pasos
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {HOW_STEPS.map((s, i) => (
            <div key={s.step} style={{ display: "flex", gap: 0, alignItems: "stretch" }}>
              {/* Línea + círculo */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 52, flexShrink: 0 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: `linear-gradient(135deg, ${GOLD}22 0%, ${GOLD}08 100%)`,
                  border: `2px solid ${GOLD}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, zIndex: 1,
                  boxShadow: `0 0 0 4px ${GOLD}08`,
                }}>
                  <span style={{ fontSize: "1.15rem", lineHeight: 1 }}>{s.emoji}</span>
                </div>
                {i < HOW_STEPS.length - 1 && (
                  <div style={{ width: 2, flex: 1, background: `linear-gradient(to bottom, ${GOLD}50, ${GOLD}10)`, minHeight: 24, margin: "4px 0" }} />
                )}
              </div>

              {/* Contenido */}
              <div style={{ flex: 1, paddingLeft: 14, paddingBottom: i < HOW_STEPS.length - 1 ? 20 : 0 }}>
                <div style={{
                  background: "var(--adm-card)",
                  border: "1px solid var(--adm-card-border)",
                  borderRadius: 14, overflow: "hidden",
                }}>
                  {/* Imagen */}
                  <div style={{ width: "100%", height: 160, overflow: "hidden", position: "relative" }}>
                    <img
                      src={s.img}
                      alt={s.imgAlt}
                      style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }}
                    />
                    {/* Badge paso */}
                    <span style={{
                      position: "absolute", top: 10, left: 10,
                      fontFamily: F, fontSize: "0.58rem", fontWeight: 700, color: GOLD,
                      background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)",
                      border: `1px solid ${GOLD}40`, borderRadius: 20, padding: "2px 8px",
                      letterSpacing: "0.05em",
                    }}>
                      Paso {s.step}
                    </span>
                  </div>
                  {/* Texto */}
                  <div style={{ padding: "14px 16px" }}>
                    <p style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px" }}>{s.title}</p>
                    <p style={{ fontFamily: FB, fontSize: "0.81rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>{s.desc}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Configura el panel ── */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "24px 20px", marginBottom: 20, boxShadow: "var(--adm-card-shadow, none)" }}>
        <h2 style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>{t("garzon_setup_title")}</h2>

        {/* One-time note */}
        <div style={{ background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 20 }}>
          <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
            {t("garzon_once_note")}
          </p>
        </div>

        {/* Link + QR */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 4px" }}>
            {t("garzon_share_link")}
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", background: "var(--adm-input)", borderRadius: 10, padding: "10px 12px", border: "1px solid var(--adm-input-border)", marginBottom: 12 }}>
            <span style={{ fontFamily: FB, fontSize: "0.72rem", color: GOLD, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{garzonLink}</span>
            <button onClick={copyLink} style={{
              padding: "6px 12px", background: copied ? "rgba(34,197,94,0.15)" : `rgba(244,166,35,0.15)`,
              border: "none", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
              fontFamily: FB, fontSize: "0.7rem", fontWeight: 600, color: copied ? "#22c55e" : GOLD, flexShrink: 0,
            }}>
              {copied ? <><Check size={12} /> {t("copied")}</> : <><Copy size={12} /> {t("copy")}</>}
            </button>
          </div>
          {qrDataUrl && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <img src={qrDataUrl} alt="QR panel garzón" style={{ width: 120, height: 120, borderRadius: 8 }} />
              <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "8px 0 0", textAlign: "center" }}>{t("garzon_scan")}</p>
            </div>
          )}
        </div>

        {/* Steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            { num: "1", title: t("garzon_open_link_title"), desc: t("garzon_open_link_desc").replace("{name}", restaurant.name) },
            { num: "2", title: t("garzon_save_app_title"), desc: t("garzon_save_app_desc"), extra: (
              <div style={{ background: "var(--adm-hover)", borderRadius: 10, padding: "10px 14px", marginTop: 8 }}>
                <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text)", margin: "0 0 4px" }}>
                  <strong>iPhone:</strong> {t("garzon_iphone")}
                </p>
                <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text)", margin: 0 }}>
                  <strong>Android:</strong> {t("garzon_android")}
                </p>
              </div>
            )},
            { num: "3", title: t("garzon_login_title").replace("{name}", restaurant.name), desc: t("garzon_login_desc").replace("{name}", restaurant.name) },
            { num: "4", title: t("garzon_accept_title"), desc: t("garzon_accept_desc"), extra: (
              <div style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 8, padding: "8px 12px", marginTop: 8 }}>
                <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "#16a34a", margin: 0, lineHeight: 1.5 }}>
                  {t("garzon_ready")}
                </p>
              </div>
            )},
          ].map(step => (
            <div key={step.num} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontFamily: F, fontSize: "0.75rem", fontWeight: 700, color: "white" }}>{step.num}</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 3px" }}>{step.title}</p>
                <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>{step.desc}</p>
                {step.extra}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
    </PlanPageGate>
  );
}
