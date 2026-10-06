"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const GOLD = "#F4A623";
const F = "var(--font-display)";
const FB = "var(--font-body)";

interface Props {
  proyecto: {
    slug: string;
    nombre: string;
    marcaNombre: string;
    localNombre?: string;
  };
  pct: number;
}

export default function FranProyectoNav({ proyecto, pct }: Props) {
  const path = usePathname();
  const base = `/franquicia/proyecto/${proyecto.slug}`;

  const tabs = [
    { href: `${base}/etapas`, label: "Etapas" },
    { href: `${base}/bitacora`, label: "Bitácora" },
    { href: `${base}/aprendizajes`, label: "Aprendizajes" },
  ];

  return (
    <div
      style={{
        padding: "28px 36px 0",
        borderBottom: "1px solid var(--adm-card-border)",
        marginBottom: 0,
      }}
    >
      {/* Breadcrumb */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 8,
        }}
      >
        <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)" }}>
          {proyecto.marcaNombre}
        </span>
        <span style={{ color: "var(--adm-text3)", fontSize: "0.75rem" }}>›</span>
        <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text2)" }}>
          {proyecto.localNombre || proyecto.nombre}
        </span>
      </div>

      {/* Title + progress */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <h1
          style={{
            fontFamily: F,
            fontSize: "1.3rem",
            fontWeight: 700,
            color: "var(--adm-text)",
            margin: 0,
          }}
        >
          {proyecto.nombre}
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 120,
              height: 5,
              background: "var(--adm-card-border)",
              borderRadius: 99,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${pct}%`,
                background: GOLD,
                borderRadius: 99,
              }}
            />
          </div>
          <span
            style={{
              fontFamily: F,
              fontSize: "0.85rem",
              fontWeight: 700,
              color: GOLD,
              minWidth: 36,
            }}
          >
            {pct}%
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0 }}>
        {tabs.map((tab) => {
          const active = path.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                padding: "8px 16px",
                fontFamily: F,
                fontSize: "0.82rem",
                fontWeight: active ? 600 : 500,
                color: active ? GOLD : "var(--adm-text2)",
                textDecoration: "none",
                borderBottom: active ? `2px solid ${GOLD}` : "2px solid transparent",
                marginBottom: -1,
                transition: "all 0.15s",
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
