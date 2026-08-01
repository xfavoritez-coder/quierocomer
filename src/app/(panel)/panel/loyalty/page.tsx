"use client";

import Link from "next/link";
import { Gift, CreditCard, Camera, Bell, ChevronRight, Users } from "lucide-react";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

const STEPS = [
  {
    icon: CreditCard,
    step: "1",
    title: "Diseña tu tarjeta",
    desc: "Elige colores, ícono de sello y las recompensas que quieras ofrecer. En minutos queda lista.",
    href: "/panel/loyalty/tarjeta",
    action: "Configurar tarjeta →",
  },
  {
    icon: Gift,
    step: "2",
    title: "El cliente se inscribe solo",
    desc: "Compartes un QR en el local o en tus redes. El cliente lo escanea y la tarjeta queda instalada en Apple Wallet o Google Wallet, sin app.",
    href: null,
    action: null,
  },
  {
    icon: Camera,
    step: "3",
    title: "Sumas sellos en caja",
    desc: "Cada vez que el cliente paga, abres el escáner del panel y apuntas la cámara al QR de su tarjeta. Se suma un sello al instante.",
    href: "/panel/loyalty/escanear",
    action: "Abrir escáner →",
  },
  {
    icon: Gift,
    step: "4",
    title: "El cliente gana su recompensa",
    desc: "Al completar la tarjeta, el cliente muestra su premio al cajero. Reinicia la tarjeta y el ciclo vuelve a empezar.",
    href: null,
    action: null,
  },
  {
    icon: Bell,
    step: "5",
    title: "Mantén el contacto",
    desc: "Envía notificaciones push con promociones o novedades. Activa también el aviso automático cuando el cliente pase cerca de tu local.",
    href: "/panel/loyalty/notificaciones",
    action: "Configurar notificaciones →",
  },
];

export default function LoyaltyHowPage() {
  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 8 }}>
          <Gift size={20} color="var(--adm-text3)" /> Loyalty · ¿Cómo funciona?
        </h1>
        <p style={{ fontFamily: FB, fontSize: "0.88rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
          Un programa de fidelización digital que vive en el teléfono de tus clientes. Sin app, sin papel, sin complicaciones.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
        {STEPS.map((s) => (
          <div key={s.step} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "16px 18px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(244,166,35,0.12)", border: `1.5px solid ${GOLD}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: GOLD }}>{s.step}</span>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: F, fontSize: "0.92rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 4px" }}>{s.title}</p>
              <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>{s.desc}</p>
              {s.href && (
                <Link href={s.href} style={{ display: "inline-block", marginTop: 8, fontFamily: F, fontSize: "0.78rem", fontWeight: 600, color: GOLD, textDecoration: "none" }}>
                  {s.action}
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Accesos rápidos */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
        {[
          { icon: Users, label: "Ver miembros", href: "/panel/loyalty/miembros" },
          { icon: Camera, label: "Escanear QR", href: "/panel/loyalty/escanear" },
        ].map((item) => (
          <Link key={item.href} href={item.href} style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, textDecoration: "none", color: "var(--adm-text)" }}>
            <item.icon size={18} color={GOLD} />
            <span style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 600 }}>{item.label}</span>
            <ChevronRight size={14} color="var(--adm-text3)" style={{ marginLeft: "auto" }} />
          </Link>
        ))}
      </div>

      {/* CTA principal */}
      <div style={{ padding: "18px 20px", background: "rgba(244,166,35,0.08)", border: "1px solid rgba(244,166,35,0.25)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 2px" }}>¿Listo para empezar?</p>
          <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)", margin: 0 }}>Diseña tu tarjeta en minutos y comparte el link con tus clientes.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
          <a href="https://quierocomer.com/fidelidad/hand-roll" target="_blank" rel="noopener noreferrer" style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid rgba(244,166,35,0.4)", background: "transparent", color: "var(--adm-text2)", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
            Ver tarjeta demo →
          </a>
          <Link href="/panel/loyalty/tarjeta" style={{ padding: "10px 18px", borderRadius: 8, background: GOLD, color: "#1a1a1a", fontFamily: F, fontSize: "0.85rem", fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
            Configurar tarjeta <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
