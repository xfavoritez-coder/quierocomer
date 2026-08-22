"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#F4A623";

export default function ComingSoon({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "8px 4px 40px" }}>
      <Link href="/panel/ecommerce" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", textDecoration: "none", marginBottom: 20 }}>
        <ArrowLeft size={15} /> Ecommerce
      </Link>
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 18, padding: "40px 28px", textAlign: "center" }}>
        <div style={{ width: 60, height: 60, borderRadius: 16, background: `${ACCENT}1a`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
          <Icon size={28} color={ACCENT} />
        </div>
        <h1 style={{ fontFamily: F, fontSize: "1.25rem", fontWeight: 800, color: "var(--adm-text)", margin: "0 0 8px" }}>{title}</h1>
        <p style={{ fontFamily: FB, fontSize: "0.88rem", color: "var(--adm-text2)", lineHeight: 1.6, margin: 0 }}>{desc}</p>
        <span style={{ display: "inline-block", marginTop: 18, fontFamily: FB, fontSize: "0.68rem", fontWeight: 700, color: ACCENT, background: `${ACCENT}22`, padding: "4px 12px", borderRadius: 999 }}>
          Próximamente
        </span>
      </div>
    </div>
  );
}
