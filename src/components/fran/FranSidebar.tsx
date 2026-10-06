"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import {
  Building2,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Home,
  BookOpen,
  FileText,
  ArrowLeft,
} from "lucide-react";

const GOLD = "#F4A623";
const F = "var(--font-display)";

interface NavMarca {
  id: string;
  slug: string;
  nombre: string;
  proyectos: { id: string; slug: string; nombre: string; estado: string }[];
}

export default function FranSidebar({ marcas }: { marcas: NavMarca[] }) {
  const path = usePathname();
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(marcas.map((m) => [m.id, true]))
  );

  const isActive = (href: string) => path === href || path.startsWith(href + "/");

  const navItem = (href: string, icon: React.ReactNode, label: string, indent = 0) => (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: `7px ${12 + indent * 16}px 7px ${12 + indent * 12}px`,
        borderRadius: 8,
        textDecoration: "none",
        background: isActive(href) ? `${GOLD}18` : "transparent",
        color: isActive(href) ? GOLD : "var(--adm-text2)",
        fontSize: "0.82rem",
        fontFamily: F,
        fontWeight: isActive(href) ? 600 : 500,
        transition: "all 0.15s",
      }}
    >
      {icon}
      <span style={{ flex: 1 }}>{label}</span>
    </Link>
  );

  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        height: "100vh",
        position: "sticky",
        top: 0,
        background: "var(--adm-card)",
        borderRight: "1px solid var(--adm-card-border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "20px 16px 12px",
          borderBottom: "1px solid var(--adm-card-border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Building2 size={18} color={GOLD} />
          <span
            style={{
              fontFamily: F,
              fontSize: "0.9rem",
              fontWeight: 700,
              color: "var(--adm-text)",
            }}
          >
            Franquicias
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "8px 8px" }}>
        {navItem("/franquicia", <Home size={15} />, "Dashboard")}

        <div
          style={{
            margin: "12px 0 4px 12px",
            fontSize: "0.68rem",
            fontFamily: F,
            fontWeight: 700,
            color: "var(--adm-text3)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Marcas
        </div>

        {marcas.map((marca) => (
          <div key={marca.id}>
            <button
              onClick={() =>
                setExpanded((e) => ({ ...e, [marca.id]: !e[marca.id] }))
              }
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 12px",
                borderRadius: 8,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "var(--adm-text)",
                fontSize: "0.82rem",
                fontFamily: F,
                fontWeight: 600,
              }}
            >
              <Building2 size={15} color={GOLD} />
              <span style={{ flex: 1, textAlign: "left" }}>{marca.nombre}</span>
              {expanded[marca.id] ? (
                <ChevronDown size={13} />
              ) : (
                <ChevronRight size={13} />
              )}
            </button>

            {expanded[marca.id] &&
              marca.proyectos.map((p) => (
                <div key={p.id} style={{ marginLeft: 8 }}>
                  {navItem(
                    `/franquicia/proyecto/${p.slug}`,
                    <FolderOpen size={14} />,
                    p.nombre,
                    1
                  )}
                </div>
              ))}
          </div>
        ))}

        <div
          style={{
            margin: "12px 0 4px 12px",
            fontSize: "0.68rem",
            fontFamily: F,
            fontWeight: 700,
            color: "var(--adm-text3)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Sistema
        </div>
        {navItem("/franquicia/sop", <BookOpen size={15} />, "SOPs / Procedimientos")}
        {navItem("/franquicia/biblioteca", <FileText size={15} />, "Biblioteca")}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: "12px 8px",
          borderTop: "1px solid var(--adm-card-border)",
        }}
      >
        <Link
          href="/panel"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 12px",
            borderRadius: 8,
            textDecoration: "none",
            color: "var(--adm-text3)",
            fontSize: "0.78rem",
            fontFamily: F,
          }}
        >
          <ArrowLeft size={14} />
          Volver al panel
        </Link>
      </div>
    </aside>
  );
}
