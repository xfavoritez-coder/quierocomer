"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import SkeletonLoading from "@/components/admin/SkeletonLoading";
import { PackageSearch, ShoppingCart, ClipboardList, Trash2, BarChart3, ChevronRight, Lock } from "lucide-react";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GREEN = "#16a34a";

interface HubData {
  controlEnabled: boolean;
  insumoCount: number;
  criticoCount: number;
}

function ModuleCard({
  icon: Icon, title, subtitle, href, available,
}: {
  icon: any; title: string; subtitle: string; href?: string; available: boolean;
}) {
  const inner = (
    <div style={{
      background: "var(--adm-card)", border: "1px solid var(--adm-card-border)",
      borderRadius: 14, padding: "18px 20px", display: "flex", alignItems: "center",
      gap: 14, cursor: available ? "pointer" : "default",
      opacity: available ? 1 : 0.55, transition: "box-shadow .15s",
      boxShadow: "var(--adm-card-shadow, none)",
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        background: available ? "rgba(22,163,74,0.12)" : "var(--adm-hover)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {available
          ? <Icon size={22} color={GREEN} />
          : <Lock size={18} color="var(--adm-text3)" />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 600, color: "var(--adm-text)", display: "flex", alignItems: "center", gap: 6 }}>
          {title}
          {!available && (
            <span style={{ fontSize: "0.62rem", background: "var(--adm-hover)", color: "var(--adm-text3)", padding: "2px 6px", borderRadius: 4, fontWeight: 500 }}>
              próximamente
            </span>
          )}
        </div>
        <div style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", marginTop: 2 }}>{subtitle}</div>
      </div>
      {available && <ChevronRight size={16} color="var(--adm-text3)" />}
    </div>
  );

  if (available && href) return <Link href={href} style={{ textDecoration: "none" }}>{inner}</Link>;
  return inner;
}

export default function ControlHubPage() {
  const { selectedRestaurantId } = useAdminSession();
  const router = useRouter();
  const [data, setData] = useState<HubData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedRestaurantId) return;

    async function load() {
      try {
          const res = await fetch(`/api/admin/control/status?restaurantId=${selectedRestaurantId}`);
        const json = res.ok ? await res.json() : {};
        setData({
          controlEnabled: json.controlEnabled ?? false,
          insumoCount: json.insumoCount ?? 0,
          criticoCount: json.criticoCount ?? 0,
        });
      } catch {
        setData({ controlEnabled: false, insumoCount: 0, criticoCount: 0 });
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [selectedRestaurantId]);

  if (loading) return <SkeletonLoading />;

  if (!data?.controlEnabled) {
    return (
      <div style={{ padding: "40px 24px", maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h2 style={{ fontFamily: F, fontSize: "1.2rem", color: "var(--adm-text)", margin: "0 0 8px" }}>
          Módulo Control no habilitado
        </h2>
        <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text2)", lineHeight: 1.5 }}>
          El módulo de control de costos aún no está activo para este restaurante.
          Contacta a QuieroComer para habilitarlo.
        </p>
      </div>
    );
  }

  const isOnboarded = data.insumoCount > 0;

  if (!isOnboarded) {
    return (
      <div style={{ padding: "40px 24px", maxWidth: 520, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🧮</div>
          <h1 style={{ fontFamily: F, fontSize: "1.5rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 8px" }}>
            Control de Costos
          </h1>
          <p style={{ fontFamily: FB, fontSize: "0.88rem", color: "var(--adm-text2)", lineHeight: 1.5, margin: 0 }}>
            Registra compras, conteos y merma. Conoce tu food cost real cada semana.
          </p>
        </div>

        <div style={{
          background: "var(--adm-card)", border: "1px solid var(--adm-card-border)",
          borderRadius: 16, padding: 24, marginBottom: 16,
        }}>
          <h3 style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 12px" }}>
            Antes de empezar
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              "Seleccionas los insumos que usas en tu cocina",
              "Marcas cuáles son críticos para el conteo semanal",
              "En 5 minutos tienes el sistema listo",
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: GREEN, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.72rem", fontWeight: 700, fontFamily: F, flexShrink: 0, marginTop: 1,
                }}>{i + 1}</div>
                <span style={{ fontFamily: FB, fontSize: "0.84rem", color: "var(--adm-text2)", lineHeight: 1.4 }}>{step}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => router.push("/panel/control/onboarding")}
          style={{
            width: "100%", padding: "14px", background: GREEN, color: "#fff",
            border: "none", borderRadius: 10, fontFamily: F, fontSize: "0.95rem",
            fontWeight: 600, cursor: "pointer", letterSpacing: "0.01em",
          }}
        >
          Configurar mis insumos →
        </button>
      </div>
    );
  }

  // Onboarded: mostrar hub
  return (
    <div style={{ padding: "24px", maxWidth: 680 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px" }}>
          🧮 Control de Costos
        </h1>
        <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: 0 }}>
          {data.insumoCount} insumos registrados · {data.criticoCount} críticos para conteo
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ModuleCard
          icon={PackageSearch}
          title="Catálogo de insumos"
          subtitle={`${data.insumoCount} insumos · ${data.criticoCount} críticos para conteo semanal`}
          href="/panel/control/insumos"
          available
        />
        <ModuleCard
          icon={ShoppingCart}
          title="Registro de compras"
          subtitle="Foto de boleta → IA extrae → tú confirmas"
          available={false}
        />
        <ModuleCard
          icon={ClipboardList}
          title="Conteo de inventario"
          subtitle="Hoja imprimible → foto → IA completa el formulario"
          available={false}
        />
        <ModuleCard
          icon={Trash2}
          title="Registro de merma"
          subtitle="Qué se perdió, cuánto y por qué"
          available={false}
        />
        <ModuleCard
          icon={BarChart3}
          title="Dashboard de food cost"
          subtitle="Tu food cost % real, alertas de precio, historial"
          available={false}
        />
      </div>

      <div style={{ marginTop: 20, textAlign: "right" }}>
        <Link
          href="/panel/control/onboarding"
          style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", textDecoration: "none" }}
        >
          Reconfigurar insumos →
        </Link>
      </div>
    </div>
  );
}
