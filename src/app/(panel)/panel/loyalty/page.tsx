"use client";

import Link from "next/link";
import { Gift, CreditCard, Camera, Bell, ChevronRight, Users, QrCode, Copy, Smartphone, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import { toast } from "sonner";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

const STEPS = [
  {
    icon: CreditCard,
    emoji: "🎨",
    step: "1",
    title: "Diseña tu tarjeta",
    desc: "Elige colores, sello e íconos. Lista en minutos.",
    href: "/panel/loyalty/tarjeta",
    action: "Configurar tarjeta",
  },
  {
    icon: QrCode,
    emoji: "📲",
    step: "2",
    title: "El cliente se inscribe solo",
    desc: "Escanea el QR y la tarjeta queda en Apple o Google Wallet. Sin app.",
    href: null,
    action: null,
  },
  {
    icon: Camera,
    emoji: "⚡",
    step: "3",
    title: "Sumas sellos en caja",
    desc: "Abres el escáner, apuntas al QR del cliente. Un sello al instante.",
    href: "/panel/loyalty/escanear",
    action: "Abrir escáner",
  },
  {
    icon: Gift,
    emoji: "🎁",
    step: "4",
    title: "El cliente gana su premio",
    desc: "Completa la tarjeta, muestra el premio, reinicia el ciclo.",
    href: null,
    action: null,
  },
  {
    icon: Bell,
    emoji: "🔔",
    step: "5",
    title: "Mantén el contacto",
    desc: "Notificaciones push con promos. O avisas cuando el cliente pasa cerca.",
    href: "/panel/loyalty/notificaciones",
    action: "Configurar alertas",
  },
];

const STATS = [
  { value: "0", label: "Apps necesarias" },
  { value: "2", label: "Wallets soportados" },
  { value: "5min", label: "Para lanzar" },
];

function WalletMockup({ restaurantName }: { restaurantName?: string }) {
  const name = restaurantName || "Tu Restaurante";
  const stamps = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return (
    <div style={{
      width: 220,
      background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)",
      borderRadius: 20,
      padding: "18px 16px 20px",
      boxShadow: "0 20px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)",
      position: "relative",
      overflow: "hidden",
      flexShrink: 0,
    }}>
      {/* Brillo sutil */}
      <div style={{ position: "absolute", top: -40, right: -40, width: 120, height: 120, borderRadius: "50%", background: `radial-gradient(circle, ${GOLD}18 0%, transparent 70%)`, pointerEvents: "none" }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <p style={{ fontFamily: F, fontSize: "0.58rem", color: "rgba(255,255,255,0.45)", margin: "0 0 1px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Tarjeta de fidelidad</p>
          <p style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1.1 }}>{name.length > 18 ? name.slice(0, 18) + "…" : name}</p>
        </div>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${GOLD}20`, border: `1.5px solid ${GOLD}50`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Star size={14} color={GOLD} fill={GOLD} />
        </div>
      </div>

      {/* Sellos */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 14 }}>
        {stamps.map((i) => (
          <div key={i} style={{
            aspectRatio: "1",
            borderRadius: "50%",
            background: i <= 7 ? `${GOLD}` : "rgba(255,255,255,0.08)",
            border: i <= 7 ? "none" : "1.5px dashed rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {i <= 7 && <Star size={9} color="#1a1a2e" fill="#1a1a2e" />}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontFamily: FB, fontSize: "0.58rem", color: "rgba(255,255,255,0.35)", margin: 0 }}>7 / 10 sellos</p>
        <div style={{ display: "flex", gap: 4 }}>
          <div style={{ width: 18, height: 12, borderRadius: 3, background: "rgba(255,255,255,0.12)" }} />
          <div style={{ width: 18, height: 12, borderRadius: 3, background: "rgba(255,255,255,0.06)" }} />
        </div>
      </div>
    </div>
  );
}

export default function LoyaltyHowPage() {
  const { selectedRestaurantId, restaurants } = usePanelSession();
  const [enrollUrl, setEnrollUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const restaurant = restaurants.find((r) => r.id === selectedRestaurantId);

  useEffect(() => {
    const slug = restaurant?.slug;
    if (!slug) return;
    const base = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
    const url = `${base}/fidelidad/${slug}`;
    setEnrollUrl(url);
    import("qrcode").then((mod) =>
      mod.default.toDataURL(url, { width: 400, margin: 2, errorCorrectionLevel: "H", color: { dark: "#1a1a1a", light: "#ffffff" } })
        .then(setQrDataUrl)
    ).catch(() => {});
  }, [selectedRestaurantId, restaurants]);

  return (
    <div style={{ maxWidth: 680 }}>

      {/* ── Hero ── */}
      <div style={{
        position: "relative", overflow: "hidden",
        background: "linear-gradient(135deg, rgba(244,166,35,0.12) 0%, rgba(244,166,35,0.04) 100%)",
        border: "1px solid rgba(244,166,35,0.22)",
        borderRadius: 20, padding: "28px 24px", marginBottom: 28,
      }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 180, height: 180, borderRadius: "50%", background: `radial-gradient(circle, ${GOLD}10 0%, transparent 70%)`, pointerEvents: "none" }} />

        <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontFamily: F, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: GOLD, margin: "0 0 8px" }}>
              Loyalty · Programa de fidelización
            </p>
            <h1 style={{ fontFamily: F, fontSize: "1.55rem", fontWeight: 800, color: "var(--adm-text)", margin: "0 0 10px", lineHeight: 1.15 }}>
              Tus clientes vuelven.<br />
              <span style={{ color: GOLD }}>Sin app. Sin papel.</span>
            </h1>
            <p style={{ fontFamily: FB, fontSize: "0.87rem", color: "var(--adm-text2)", margin: "0 0 18px", lineHeight: 1.55 }}>
              Tarjetas de fidelidad digitales que viven en el teléfono del cliente. Configuras en minutos, funciona solo.
            </p>
            {/* Stats */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {STATS.map((s) => (
                <div key={s.label} style={{ textAlign: "center", padding: "8px 14px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 10 }}>
                  <p style={{ fontFamily: F, fontSize: "1.1rem", fontWeight: 800, color: GOLD, margin: "0 0 1px" }}>{s.value}</p>
                  <p style={{ fontFamily: FB, fontSize: "0.67rem", color: "var(--adm-text2)", margin: 0 }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Wallet mockup */}
          <WalletMockup restaurantName={restaurant?.name} />
        </div>
      </div>

      {/* ── Cómo funciona: timeline visual ── */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontFamily: F, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--adm-text3)", margin: "0 0 18px" }}>
          Cómo funciona · 5 pasos
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {STEPS.map((s, i) => (
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
                {i < STEPS.length - 1 && (
                  <div style={{ width: 2, flex: 1, background: `linear-gradient(to bottom, ${GOLD}50, ${GOLD}10)`, minHeight: 24, margin: "4px 0" }} />
                )}
              </div>

              {/* Contenido */}
              <div style={{ flex: 1, paddingLeft: 14, paddingBottom: i < STEPS.length - 1 ? 20 : 0 }}>
                <div style={{
                  background: "var(--adm-card)",
                  border: "1px solid var(--adm-card-border)",
                  borderRadius: 14, padding: "14px 16px",
                  transition: "border-color 0.2s",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontFamily: F, fontSize: "0.58rem", fontWeight: 700, color: GOLD, background: `${GOLD}15`, border: `1px solid ${GOLD}30`, borderRadius: 20, padding: "1px 7px", letterSpacing: "0.05em" }}>
                          Paso {s.step}
                        </span>
                      </div>
                      <p style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px" }}>{s.title}</p>
                      <p style={{ fontFamily: FB, fontSize: "0.81rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>{s.desc}</p>
                    </div>
                  </div>
                  {s.href && (
                    <Link href={s.href} style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      marginTop: 10, padding: "7px 12px",
                      background: `${GOLD}15`, border: `1px solid ${GOLD}40`,
                      borderRadius: 8, fontFamily: F, fontSize: "0.78rem", fontWeight: 700,
                      color: GOLD, textDecoration: "none",
                    }}>
                      {s.action} <ChevronRight size={13} />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Accesos rápidos ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
        {[
          { icon: Users, label: "Ver miembros", sub: "Todos tus inscritos", href: "/panel/loyalty/miembros" },
          { icon: Camera, label: "Escanear QR", sub: "Sumar sello ahora", href: "/panel/loyalty/escanear" },
        ].map((item) => (
          <Link key={item.href} href={item.href} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
            background: "var(--adm-card)", border: "1px solid var(--adm-card-border)",
            borderRadius: 14, textDecoration: "none",
          }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${GOLD}15`, border: `1px solid ${GOLD}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <item.icon size={17} color={GOLD} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 1px" }}>{item.label}</p>
              <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text2)", margin: 0 }}>{item.sub}</p>
            </div>
            <ChevronRight size={14} color="var(--adm-text3)" />
          </Link>
        ))}
      </div>

      {/* ── QR de inscripción ── */}
      {enrollUrl && (
        <div style={{ marginBottom: 20, padding: "22px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `${GOLD}15`, border: `1px solid ${GOLD}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <QrCode size={16} color={GOLD} />
            </div>
            <div>
              <p style={{ fontFamily: F, fontSize: "0.92rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>QR de inscripción</p>
              <p style={{ fontFamily: FB, fontSize: "0.73rem", color: "var(--adm-text2)", margin: 0 }}>Imprímelo y pégalo en tus mesas o mostrador</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 18, alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
            {qrDataUrl && (
              <div style={{ background: "#fff", padding: 10, borderRadius: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", flexShrink: 0 }}>
                <img src={qrDataUrl} alt="QR inscripción" width={110} height={110} style={{ display: "block" }} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 180 }}>
              <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 10px", lineHeight: 1.5 }}>
                El cliente lo escanea con la cámara del teléfono y la tarjeta queda instalada en segundos.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", background: "var(--adm-bg)", border: "1px solid var(--adm-card-border)", borderRadius: 8, marginBottom: 8 }}>
                <Smartphone size={12} color="var(--adm-text3)" style={{ flexShrink: 0 }} />
                <span style={{ fontFamily: FB, fontSize: "0.73rem", color: "var(--adm-text2)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{enrollUrl}</span>
                <button onClick={() => { navigator.clipboard?.writeText(enrollUrl); toast.success("Link copiado"); }}
                  style={{ flexShrink: 0, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: "0.72rem", fontFamily: F, fontWeight: 600 }}>
                  <Copy size={11} /> Copiar
                </button>
              </div>
              <button
                onClick={() => {
                  const win = window.open("", "_blank");
                  if (!win) return;
                  win.document.write(`<!DOCTYPE html><html><head><title>QR Fidelización</title><style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;gap:16px;padding:32px}img{width:260px;height:260px}p{font-size:14px;color:#555;margin:0}@media print{button{display:none}}</style></head><body><img src="${qrDataUrl}" /><p>${enrollUrl}</p><button onclick="window.print()">Imprimir</button></body></html>`);
                  win.document.close();
                }}
                style={{ width: "100%", padding: "9px 14px", borderRadius: 8, border: `1px solid ${GOLD}50`, background: `${GOLD}15`, color: GOLD, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                🖨️ Imprimir QR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CTA ── */}
      <div style={{ padding: "20px 22px", background: `linear-gradient(135deg, ${GOLD}12 0%, ${GOLD}06 100%)`, border: `1px solid ${GOLD}30`, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 800, color: "var(--adm-text)", margin: "0 0 3px" }}>¿Listo para empezar?</p>
          <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)", margin: 0 }}>Diseña tu tarjeta en minutos y comparte el link con tus clientes.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
          <a href="https://quierocomer.com/fidelidad/el-menu-de-la-esquina" target="_blank" rel="noopener noreferrer"
            style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: "var(--adm-card)", color: "var(--adm-text2)", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
            Ver demo →
          </a>
          <Link href="/panel/loyalty/tarjeta"
            style={{ padding: "10px 18px", borderRadius: 8, background: GOLD, color: "#1a1a1a", fontFamily: F, fontSize: "0.85rem", fontWeight: 800, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
            Configurar tarjeta <ChevronRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}
