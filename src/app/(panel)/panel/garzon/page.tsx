"use client";
import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import PlanPageGate from "@/components/admin/PlanPageGate";
import { Bell, Smartphone, CheckCircle, Copy, Check, Shield, ArrowLeft } from "lucide-react";
import { usePanelLang } from "@/lib/i18n/panel";
import Link from "next/link";
import QRCode from "qrcode";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

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
      <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 8px", display: "flex", alignItems: "center", gap: 8 }}><Bell size={20} color="var(--adm-text3)" /> {t("garzon_page_title")}</h1>
      <p style={{ fontFamily: FB, fontSize: "0.88rem", color: "var(--adm-text2)", margin: "0 0 24px", lineHeight: 1.5 }}>
        {t("garzon_desc")}
      </p>

      {/* ── Cómo funciona ── */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "24px 20px", marginBottom: 20, boxShadow: "var(--adm-card-shadow, none)" }}>
        <h2 style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 20px" }}>{t("garzon_how_it_works")}</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {[
            { icon: Smartphone, num: "1", title: t("garzon_step1_title"), desc: t("garzon_step1_desc") },
            { icon: Bell, num: "2", title: t("garzon_step2_title"), desc: t("garzon_step2_desc") },
            { icon: CheckCircle, num: "3", title: t("garzon_step3_title"), desc: t("garzon_step3_desc") },
          ].map(step => (
            <div key={step.num} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <step.icon size={18} color={GOLD} />
              </div>
              <div>
                <p style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 3px" }}>{step.title}</p>
                <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>{step.desc}</p>
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
          {/* Step 1 */}
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontFamily: F, fontSize: "0.75rem", fontWeight: 700, color: "white" }}>1</span>
            </div>
            <div>
              <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 3px" }}>{t("garzon_open_link_title")}</p>
              <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
                {t("garzon_open_link_desc").replace("{name}", restaurant.name)}
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontFamily: F, fontSize: "0.75rem", fontWeight: 700, color: "white" }}>2</span>
            </div>
            <div>
              <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 3px" }}>{t("garzon_save_app_title")}</p>
              <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 8px", lineHeight: 1.5 }}>
                {t("garzon_save_app_desc")}
              </p>
              <div style={{ background: "var(--adm-hover)", borderRadius: 10, padding: "10px 14px" }}>
                <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text)", margin: "0 0 4px" }}>
                  <strong>iPhone:</strong> {t("garzon_iphone")}
                </p>
                <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text)", margin: 0 }}>
                  <strong>Android:</strong> {t("garzon_android")}
                </p>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontFamily: F, fontSize: "0.75rem", fontWeight: 700, color: "white" }}>3</span>
            </div>
            <div>
              <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 3px" }}>{t("garzon_login_title").replace("{name}", restaurant.name)}</p>
              <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
                {t("garzon_login_desc").replace("{name}", restaurant.name)}
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontFamily: F, fontSize: "0.75rem", fontWeight: 700, color: "white" }}>4</span>
            </div>
            <div>
              <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 3px" }}>{t("garzon_accept_title")}</p>
              <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 8px", lineHeight: 1.5 }}>
                {t("garzon_accept_desc")}
              </p>
              <div style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 8, padding: "8px 12px" }}>
                <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "#16a34a", margin: 0, lineHeight: 1.5 }}>
                  {t("garzon_ready")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
    </PlanPageGate>
  );
}
