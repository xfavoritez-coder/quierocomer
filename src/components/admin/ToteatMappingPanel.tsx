"use client";

import { useEffect, useState, useCallback } from "react";

const F = "var(--font-display)";
const FB = "var(--font-body)";

interface CatalogEntry { toteatProductId: string; name: string; hierarchyName: string | null; totalSold?: number; }
interface ModifierInfo { id: string; name: string; group: string; template: string; toteatProductId: string | null; toteatName: string | null; mappedBy: string | null; }
interface MappedDish { id: string; name: string; photo: string | null; category: string | null; toteatProductId: string; toteatName: string | null; mappedBy: string; mappedAt: string | null; modifiers: ModifierInfo[]; }
interface ViaModifiersDish { id: string; name: string; photo: string | null; category: string | null; isManualOverride?: boolean; modifiers: ModifierInfo[]; }
interface UnmappedDish { id: string; name: string; photo: string | null; category: string | null; suggestion: { score: number; toteatProductId: string; name: string } | null; hasMappedModifiers?: boolean; modifiers: ModifierInfo[]; }
interface ToteatStatus {
  summary: { total: number; mapped: number; mappedDirectly?: number; mappedViaModifiers?: number; unmapped: number; mappedPct: number; catalogSize: number };
  mapped: MappedDish[];
  viaModifiers?: ViaModifiersDish[];
  unmapped: UnmappedDish[];
  catalog: CatalogEntry[];
  modifierCatalog: CatalogEntry[];
  webhookSecret?: string | null;
  importDone?: boolean;
  error?: string;
}

export default function ToteatMappingPanel({ restaurantId }: { restaurantId: string }) {
  const [data, setData] = useState<ToteatStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Form para que el dueño cargue sus credenciales Toteat directamente
  const [credForm, setCredForm] = useState({ restaurantId: "", localId: "", userId: "", apiToken: "" });
  const [savingCreds, setSavingCreds] = useState(false);
  const [credsErr, setCredsErr] = useState<string | null>(null);
  const [credsOk, setCredsOk] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const [restaurantName, setRestaurantName] = useState("");
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [showWebhookHelp, setShowWebhookHelp] = useState(false);

  // Wizard de import: cuando el dueno conecta Toteat por primera vez
  type WizardItem = {
    toteatId: string; toteatName: string; toteatPrice: number; toteatCategory: string | null;
    action: "already-mapped" | "match-found" | "new";
    suggestedDishId: string | null; suggestedDishName: string | null;
    chosen: "map" | "create" | "skip"; // decision del owner
  };
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardItems, setWizardItems] = useState<WizardItem[] | null>(null);
  const [wizardSummary, setWizardSummary] = useState<any>(null);
  const [wizardQcOnly, setWizardQcOnly] = useState<{ id: string; name: string }[]>([]);
  const [wizardApplying, setWizardApplying] = useState(false);

  const loadWizard = async () => {
    setWizardLoading(true);
    try {
      const res = await fetch("/api/admin/toteat/import-preview", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      const items: WizardItem[] = data.items.map((i: any) => ({
        ...i,
        chosen: i.action === "already-mapped" ? "skip" : i.action === "match-found" ? "map" : "create",
      }));
      setWizardItems(items);
      setWizardSummary(data.summary);
      setWizardQcOnly(data.qcOnly || []);
      setWizardOpen(true);
    } finally {
      setWizardLoading(false);
    }
  };

  const applyWizard = async () => {
    if (!wizardItems) return;
    setWizardApplying(true);
    try {
      const actions = wizardItems
        .filter((i) => i.action !== "already-mapped")
        .map((i) => ({
          toteatId: i.toteatId,
          action: i.chosen,
          dishId: i.chosen === "map" ? i.suggestedDishId : undefined,
          name: i.chosen === "create" ? i.toteatName : undefined,
          price: i.chosen === "create" ? i.toteatPrice : undefined,
          category: i.chosen === "create" ? i.toteatCategory : undefined,
        }));
      const res = await fetch("/api/admin/toteat/import-apply", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, actions }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg("Error: " + (data.error || ""));
        return;
      }
      const s = data.summary;
      setMsg(`✓ Importacion completa: ${s.mapped} mapeados, ${s.created} creados, ${s.skipped} saltados`);
      // Mapear modificadores automaticamente despues
      await fetch("/api/admin/modifiers/auto-map-toteat", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId }),
      }).catch(() => {});
      setWizardOpen(false);
      setWizardItems(null);
      load();
    } finally {
      setWizardApplying(false);
    }
  };

  useEffect(() => {
    fetch(`/api/admin/locales/${restaurantId}`).then(r => r.ok ? r.json() : null).then(d => { if (d?.name) setRestaurantName(d.name); }).catch(() => {});
  }, [restaurantId]);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/dishes/toteat-status?restaurantId=${restaurantId}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setData({ ...d, summary: { total: 0, mapped: 0, unmapped: 0, mappedPct: 0, catalogSize: 0 }, mapped: [], unmapped: [], catalog: [], modifierCatalog: [] }); else setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  const runAutoMap = async () => {
    setBusy(true); setMsg(null);
    try {
      const [resDishes, resMods] = await Promise.all([
        fetch("/api/admin/dishes/auto-map-toteat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId }) }).then(r => r.json()),
        fetch("/api/admin/modifiers/auto-map-toteat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId }) }).then(r => r.json()),
      ]);
      const dishMatches = resDishes?.summary?.matched ?? 0;
      const modMatches = resMods?.summary?.matched ?? 0;
      setMsg(`Auto-mapeo: ${dishMatches} platos · ${modMatches} modificadores matcheados`);
      load();
    } finally { setBusy(false); }
  };

  const setDishMapping = async (dishId: string, toteatProductId: string | null) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/dishes/${dishId}/map-toteat`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toteatProductId }),
      });
      if (res.ok) load();
    } finally { setBusy(false); }
  };

  const markDishAsComposite = async (dishId: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/dishes/${dishId}/map-toteat`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noDirectMapping: true }),
      });
      if (res.ok) load();
    } finally { setBusy(false); }
  };

  const setModifierMapping = async (modifierId: string, toteatProductId: string | null) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/modifiers/${modifierId}/map-toteat`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toteatProductId }),
      });
      if (res.ok) load();
    } finally { setBusy(false); }
  };

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: "var(--adm-text3)", fontFamily: F }}>Cargando estado de mapeo…</div>;
  if (!data) return <div style={{ padding: 24, color: "#ef4444", fontFamily: F }}>Error al cargar el panel.</div>;

  const noToteat = data.summary.catalogSize === 0;

  if (noToteat) {
    const handleSaveCreds = async () => {
      setCredsErr(null); setCredsOk(false);
      if (!credForm.restaurantId.trim() || !credForm.localId.trim() || !credForm.userId.trim() || !credForm.apiToken.trim()) {
        setCredsErr("Completa los 4 campos");
        return;
      }
      setSavingCreds(true);
      try {
        const res = await fetch(`/api/admin/locales/${restaurantId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toteatRestaurantId: credForm.restaurantId.trim(),
            toteatLocalId: credForm.localId.trim(),
            toteatUserId: credForm.userId.trim(),
            toteatApiToken: credForm.apiToken.trim(),
          }),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) {
          setCredsErr(out.error || "Error al guardar");
          setSavingCreds(false);
          return;
        }
        // Verifica que los campos quedaron guardados (si plan no es PREMIUM, el server los descarta)
        if (!out.toteatApiToken) {
          setCredsErr("Las credenciales no se guardaron. Esta integración requiere plan Premium.");
          setSavingCreds(false);
          return;
        }
        setCredsOk(true);
        setMsg("Credenciales guardadas. Cargando tu catalogo de Toteat...");
        // Cargar catalogo de Toteat (la primera consulta puede tardar unos segundos)
        await fetch("/api/admin/toteat/sync-now", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restaurantId }),
        }).catch(() => {});
        setMsg(null);
        // Forzar re-render al estado normal y abrir wizard
        load();
        await loadWizard();
      } finally {
        setSavingCreds(false);
      }
    };

    const inputStyle: React.CSSProperties = {
      width: "100%", padding: "10px 12px", background: "var(--adm-input)",
      border: "1px solid var(--adm-card-border)", borderRadius: 8,
      color: "var(--adm-text)", fontFamily: F, fontSize: "0.85rem", outline: "none", boxSizing: "border-box",
    };
    const labelStyle: React.CSSProperties = {
      display: "block", fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text2)",
      textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6,
    };

    return (
      <div style={{ padding: 24, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <p style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 6px" }}>
            🔌 Integración con Toteat no configurada
          </p>
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
            Una vez ingresadas las credenciales y después del primer sync de ventas, vas a poder mapear cada plato a su producto Toteat para tener métricas cruzadas (vistas vs ventas reales).
          </p>
        </div>

        <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--adm-card-border)" }}>
          <p style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px" }}>
            ¿Tienes tus credenciales? Cárgalas acá
          </p>
          <p style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text3)", margin: "0 0 8px", lineHeight: 1.5 }}>
            Las puedes encontrar en tu panel de Toteat → Integraciones → API.
          </p>
          <button
            type="button"
            onClick={() => setRequestModalOpen(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "7px 14px", marginBottom: 16,
              background: "rgba(244,166,35,0.12)",
              border: "1px solid rgba(244,166,35,0.4)",
              borderRadius: 999, cursor: "pointer",
              fontFamily: F, fontSize: "0.78rem", fontWeight: 600, color: "#92400e",
            }}
          >
            <span>📧</span>
            <span>¿No las tienes? Te ayudamos a pedirlas a Toteat</span>
            <span style={{ fontSize: "0.85rem", marginLeft: 2 }}>→</span>
          </button>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Restaurant ID (xir)</label>
              <input value={credForm.restaurantId} onChange={(e) => setCredForm((f) => ({ ...f, restaurantId: e.target.value }))} placeholder="Ej: 1234" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Local ID (xil)</label>
              <input value={credForm.localId} onChange={(e) => setCredForm((f) => ({ ...f, localId: e.target.value }))} placeholder="Ej: 567" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>User ID (xiu)</label>
              <input value={credForm.userId} onChange={(e) => setCredForm((f) => ({ ...f, userId: e.target.value }))} placeholder="Ej: 89" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>API Token (xapitoken)</label>
              <input type="password" value={credForm.apiToken} onChange={(e) => setCredForm((f) => ({ ...f, apiToken: e.target.value }))} placeholder="••••••••" style={inputStyle} />
            </div>
          </div>

          {credsErr && (
            <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#ef4444", margin: "0 0 12px" }}>{credsErr}</p>
          )}
          {credsOk && (
            <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#16a34a", margin: "0 0 12px" }}>✓ Credenciales guardadas</p>
          )}

          <button
            onClick={handleSaveCreds}
            disabled={savingCreds}
            style={{
              padding: "10px 22px",
              background: savingCreds ? "#ccc" : "#F4A623",
              color: "white",
              border: "none",
              borderRadius: 999,
              fontFamily: F,
              fontSize: "0.85rem",
              fontWeight: 700,
              cursor: savingCreds ? "wait" : "pointer",
            }}
          >
            {savingCreds ? "Guardando…" : "Guardar y conectar"}
          </button>
        </div>

        {requestModalOpen && (() => {
          const localName = restaurantName || "[NOMBRE DEL RESTAURANTE]";
          const subject = "Solicitud de credenciales API";
          const body = `Hola,

Soy el administrador del local ${localName} (RUT [REEMPLAZAR CON RUT DE LA EMPRESA]) y necesito las credenciales de API de mi cuenta:

- Restaurant ID (xir)
- Local ID (xil)
- User ID (xiu)
- API Token (xapitoken)

Quedo atento. Gracias.`;

          const handleCopy = async () => {
            try {
              await navigator.clipboard.writeText(body);
              setEmailCopied(true);
              setTimeout(() => setEmailCopied(false), 2500);
            } catch {}
          };

          return (
            <div onClick={() => setRequestModalOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
              <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, maxWidth: 460, width: "100%", padding: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <p style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>Solicitar credenciales a Toteat</p>
                  <button onClick={() => setRequestModalOpen(false)} style={{ background: "none", border: "none", color: "var(--adm-text3)", fontSize: "1.2rem", cursor: "pointer", lineHeight: 1, padding: 0 }}>✕</button>
                </div>

                <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "0 0 12px", lineHeight: 1.5 }}>
                  Envía este mensaje a <strong style={{ color: "var(--adm-text)" }}>clientes@toteat.com</strong>:
                </p>

                <pre style={{
                  background: "var(--adm-input)", border: "1px solid var(--adm-card-border)",
                  borderRadius: 10, padding: 14, fontFamily: FB,
                  fontSize: "0.82rem", color: "var(--adm-text)", lineHeight: 1.55,
                  whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, marginBottom: 14,
                }}>{body}</pre>

                <button
                  onClick={handleCopy}
                  style={{
                    width: "100%", padding: "11px 16px",
                    background: emailCopied ? "#16a34a" : "#F4A623", color: "white",
                    border: "none", borderRadius: 999, fontFamily: F, fontSize: "0.85rem",
                    fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  {emailCopied ? "✓ Copiado" : "📋 Copiar texto"}
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  const filterText = search.trim().toLowerCase();
  const filteredUnmapped = filterText
    ? data.unmapped.filter((d) => d.name.toLowerCase().includes(filterText) || (d.category || "").toLowerCase().includes(filterText))
    : data.unmapped;
  const filteredMapped = filterText
    ? data.mapped.filter((d) => d.name.toLowerCase().includes(filterText) || (d.toteatName || "").toLowerCase().includes(filterText))
    : data.mapped;

  // Total modifier mapping stats across all dishes
  const allMods = [...data.mapped, ...data.unmapped].flatMap((d) => d.modifiers);
  const mappedMods = allMods.filter((m) => m.toteatProductId).length;
  const totalMods = allMods.length;

  // Paso del wizard segun el estado actual del mapeo
  const allMapped = data.summary.unmapped === 0 && data.summary.mapped > 0;
  const someMapped = data.summary.mapped > 0 && data.summary.unmapped > 0;
  const noneMapped = data.summary.mapped === 0;
  const lowMapping = data.summary.mappedPct < 50 && data.summary.mapped > 0;

  // Header de seccion reutilizable
  const SectionHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "8px 0 4px", borderBottom: "1px solid var(--adm-card-border)", marginBottom: 4 }}>
      <p style={{ fontFamily: F, fontSize: "0.7rem", fontWeight: 700, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>{title}</p>
      {subtitle && <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: 0 }}>· {subtitle}</p>}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* TODO: Re-habilitar el bloque de Webhook URL cuando Toteat confirme:
          1. Si "Tipo de Servicio Externo: No usa" permite POST hooks libres
          2. Como autentica Toteat al disparar el Post Hook (header / token / etc)
          Mientras tanto, el endpoint /api/toteat/webhook sigue funcionando para
          quien lo invoque con ?secret=, pero no lo mostramos al duenio para no
          dar instrucciones equivocadas. El sync de visibilidad sigue corriendo
          via cron de 30 min. */}

      {/* ──────────── 2. ESTADO DE LA INTEGRACIÓN ──────────── */}
      <SectionHeader title="Estado de la integración" subtitle="Cómo va el mapeo de tu carta con Toteat" />

      {/* Wizard didactico de estado */}
      <div style={{
        background: allMapped ? "rgba(22,163,74,0.08)" : "rgba(244,166,35,0.08)",
        border: `1px solid ${allMapped ? "rgba(22,163,74,0.3)" : "rgba(244,166,35,0.3)"}`,
        borderRadius: 12, padding: "14px 16px",
      }}>
        <p style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 700, color: allMapped ? "#16a34a" : "#92400e", margin: "0 0 6px" }}>
          {allMapped ? "✓ Todo listo" : noneMapped ? "⚠ Faltan platos por conectar" : "🔧 Casi listo, te falta poco"}
        </p>
        {allMapped && (
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
            Tus {data.summary.mapped} platos están conectados a Toteat. En unos minutos vas a ver estadísticas cruzadas (vistas vs ventas reales) en la sección <strong>Analytics</strong>.
          </p>
        )}
        {someMapped && !allMapped && (
          <>
            <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "0 0 6px", lineHeight: 1.5 }}>
              Conectamos automáticamente <strong>{data.summary.mapped} de {data.summary.total} platos</strong>. Los <strong>{data.summary.unmapped}</strong> que faltan los puedes mapear a mano abajo (sección "Sin mapear"): hacemos match cuando los nombres coinciden, así que si tu plato se llama distinto en Toteat vas a tener que elegir el match manual.
            </p>
            {lowMapping && (
              <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", margin: "6px 0 0", lineHeight: 1.5 }}>
                💡 <strong>Tip:</strong> coincidieron pocos. Probablemente los nombres son muy distintos entre tu carta y Toteat. Revisa que estén bien escritos, o usa "Auto-mapear" otra vez después de ajustar.
              </p>
            )}
          </>
        )}
        {noneMapped && (
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
            La conexión con Toteat está lista pero <strong>ninguno</strong> de tus {data.summary.total} platos coincidió automáticamente con tu catálogo Toteat (tenemos {data.summary.catalogSize} productos disponibles). Mapea cada plato a su producto Toteat abajo, o usa "Auto-mapear" si ajustaste nombres.
          </p>
        )}
      </div>

      {/* Summary card */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "16px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <p style={{ fontFamily: F, fontSize: "0.74rem", color: "var(--adm-text3)", margin: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>Estado del mapeo</p>
            <p style={{ fontFamily: F, fontSize: "1.4rem", fontWeight: 700, color: "var(--adm-text)", margin: "2px 0 0" }}>
              {data.summary.mapped} <span style={{ color: "var(--adm-text3)", fontWeight: 500, fontSize: "1rem" }}>/ {data.summary.total} platos mapeados</span>
              <span style={{ marginLeft: 10, fontSize: "0.95rem", color: data.summary.mappedPct >= 80 ? "#16a34a" : data.summary.mappedPct >= 50 ? "#F4A623" : "#ef4444", fontWeight: 700 }}>
                ({data.summary.mappedPct}%)
              </span>
            </p>
            {totalMods > 0 && (
              <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "4px 0 0" }}>
                {mappedMods} / {totalMods} modificadores mapeados
              </p>
            )}
            <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "4px 0 0" }}>
              {data.summary.catalogSize} productos Toteat disponibles
            </p>
          </div>
          <button
            onClick={runAutoMap}
            disabled={busy}
            style={{ padding: "10px 18px", background: "#F4A623", color: "#fff", border: "none", borderRadius: 10, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1 }}
          >
            {busy ? "Procesando..." : "Auto-mapear"}
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 12, height: 6, borderRadius: 3, background: "var(--adm-card-border)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${data.summary.mappedPct}%`, background: "linear-gradient(90deg, #F4A623, #F4A623)", borderRadius: 3, transition: "width 0.4s" }} />
        </div>

        {msg && (
          <p style={{ marginTop: 10, padding: "8px 12px", background: "rgba(244,166,35,0.08)", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 8, fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text)" }}>{msg}</p>
        )}
      </div>

      {/* Boton para re-abrir wizard */}
      {data.summary.total > 0 && (
        <button
          onClick={loadWizard}
          disabled={wizardLoading}
          style={{ alignSelf: "flex-start", padding: "8px 16px", background: "var(--adm-hover)", color: "var(--adm-text2)", border: "1px solid var(--adm-card-border)", borderRadius: 999, fontFamily: F, fontSize: "0.78rem", fontWeight: 600, cursor: wizardLoading ? "wait" : "pointer" }}
        >
          {wizardLoading ? "Cargando..." : "🔄 Comparar con mi carta de Toteat"}
        </button>
      )}

      {/* ──────────── 3. DETALLE DE MAPEOS ──────────── */}
      <div style={{ marginTop: 8 }}>
        <SectionHeader title="Detalle de mapeos" subtitle="Busca y ajusta platos uno por uno" />
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Buscar plato o producto Toteat..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ padding: "10px 14px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 10, fontFamily: F, fontSize: "0.85rem", color: "var(--adm-text)", outline: "none" }}
      />

      {/* Unmapped list */}
      {filteredUnmapped.length > 0 && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "14px 16px" }}>
          <p style={{ fontFamily: F, fontSize: "0.84rem", fontWeight: 700, color: "#ef4444", margin: "0 0 12px" }}>
            ✗ Sin mapear ({filteredUnmapped.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filteredUnmapped.map((d) => (
              <DishWithModifiers
                key={d.id}
                dish={d}
                mappedKind="unmapped"
                catalog={data.catalog}
                modifierCatalog={data.modifierCatalog}
                disabled={busy}
                onDishMap={(toteatId) => setDishMapping(d.id, toteatId)}
                onModifierMap={setModifierMapping}
                onMarkComposite={() => markDishAsComposite(d.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Via modifiers list */}
      {data.viaModifiers && data.viaModifiers.length > 0 && (() => {
        const filteredVia = filterText
          ? data.viaModifiers.filter((d) => d.name.toLowerCase().includes(filterText) || (d.category || "").toLowerCase().includes(filterText))
          : data.viaModifiers;
        if (filteredVia.length === 0) return null;
        return (
          <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "14px 16px" }}>
            <p style={{ fontFamily: F, fontSize: "0.84rem", fontWeight: 700, color: "#7c3aed", margin: "0 0 4px" }}>
              ✓ Mapeados vía modificadores ({filteredVia.length})
            </p>
            <p style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text3)", margin: "0 0 12px", lineHeight: 1.4 }}>
              Estos son platos "compuestos" en tu carta: la atribución de ventas pasa por sus modificadores (que ya están conectados a Toteat), no por el plato padre. Ejemplo típico: una "Limonada Artesanal" con varios sabores como modifiers.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {filteredVia.map((d) => (
                <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "rgba(124,58,237,0.04)", border: "1px solid rgba(124,58,237,0.15)", borderRadius: 8 }}>
                  {d.photo ? (
                    <img src={d.photo} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: 6, background: "var(--adm-input)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "1rem", opacity: 0.4 }}>🍽️</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 600, color: "var(--adm-text)", margin: 0 }}>{d.name}</p>
                    <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>
                      {d.category && `${d.category} · `}{d.modifiers.filter((m) => m.toteatProductId).length} modifier{d.modifiers.filter((m) => m.toteatProductId).length !== 1 ? "s" : ""} mapeado{d.modifiers.filter((m) => m.toteatProductId).length !== 1 ? "s" : ""}
                      {d.isManualOverride && " · marcado manualmente"}
                    </p>
                  </div>
                  {d.isManualOverride && (
                    <button
                      onClick={async () => {
                        await fetch(`/api/admin/dishes/${d.id}/map-toteat`, {
                          method: "PATCH", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ noDirectMapping: false }),
                        });
                        load();
                      }}
                      style={{ padding: "4px 10px", background: "transparent", border: "1px solid var(--adm-card-border)", borderRadius: 6, color: "var(--adm-text3)", fontFamily: F, fontSize: "0.68rem", cursor: "pointer" }}
                    >
                      Quitar override
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Mapped list */}
      {filteredMapped.length > 0 && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "14px 16px" }}>
          <p style={{ fontFamily: F, fontSize: "0.84rem", fontWeight: 700, color: "#16a34a", margin: "0 0 12px" }}>
            ✓ Mapeados directo ({filteredMapped.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filteredMapped.map((d) => (
              <DishWithModifiers
                key={d.id}
                dish={d}
                mappedKind="mapped"
                catalog={data.catalog}
                modifierCatalog={data.modifierCatalog}
                disabled={busy}
                onDishMap={(toteatId) => setDishMapping(d.id, toteatId)}
                onModifierMap={setModifierMapping}
              />
            ))}
          </div>
        </div>
      )}

      {/* Wizard de import — modal */}
      {wizardOpen && wizardItems && (
        <div onClick={() => { if (!wizardApplying) { setWizardOpen(false); setWizardItems(null); } }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, maxWidth: 720, width: "100%", maxHeight: "90vh", overflowY: "auto", padding: 24, position: "relative" }}>
            <button
              onClick={() => { setWizardOpen(false); setWizardItems(null); }}
              disabled={wizardApplying}
              aria-label="Cerrar"
              style={{ position: "absolute", top: 14, right: 16, background: "none", border: "none", color: "var(--adm-text3)", fontSize: "1.4rem", cursor: wizardApplying ? "wait" : "pointer", lineHeight: 1, padding: 4 }}
            >✕</button>
            <div style={{ marginBottom: 16, paddingRight: 24 }}>
              <p style={{ fontFamily: F, fontSize: "1.1rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 6px" }}>
                Importar tu carta desde Toteat
              </p>
              <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
                Encontramos <strong>{wizardSummary?.toteatTotal} productos</strong> en tu Toteat.
                Decide qué hacer con cada uno. Los platos que ya tienes en QuieroComer <strong>no se sobrescriben</strong> (foto, descripción y modificadores quedan intactos).
              </p>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <span style={{ fontSize: "0.78rem", padding: "4px 10px", borderRadius: 50, background: "rgba(74,222,128,0.12)", color: "#16a34a", fontFamily: F, fontWeight: 600 }}>
                {wizardSummary?.alreadyMapped || 0} ya mapeados
              </span>
              <span style={{ fontSize: "0.78rem", padding: "4px 10px", borderRadius: 50, background: "rgba(244,166,35,0.12)", color: "#92400e", fontFamily: F, fontWeight: 600 }}>
                {wizardSummary?.matchFound || 0} para mapear
              </span>
              <span style={{ fontSize: "0.78rem", padding: "4px 10px", borderRadius: 50, background: "rgba(124,58,237,0.12)", color: "#7c3aed", fontFamily: F, fontWeight: 600 }}>
                {wizardSummary?.newToCreate || 0} nuevos por crear
              </span>
              {wizardQcOnly.length > 0 && (
                <span style={{ fontSize: "0.78rem", padding: "4px 10px", borderRadius: 50, background: "var(--adm-input)", color: "var(--adm-text3)", fontFamily: F, fontWeight: 600 }}>
                  {wizardQcOnly.length} solo en QuieroComer (no se tocan)
                </span>
              )}
            </div>

            {/* Info sobre modificadores */}
            <div style={{ background: "rgba(124,58,237,0.05)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
              <p style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 700, color: "#7c3aed", margin: "0 0 4px" }}>🔧 Sobre los modificadores</p>
              <p style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
                Toteat maneja los modificadores (ej. envolturas de roll, salsas, tamaños) como productos aparte con su propio código. Después de aplicar este import, vamos a auto-mapear automáticamente cada modificador de tu carta a su contraparte en Toteat <strong>cuando los nombres coincidan</strong>. Los que no coincidan los puedes mapear a mano en este mismo panel después.
              </p>
            </div>

            <div style={{ border: "1px solid var(--adm-card-border)", borderRadius: 10, marginBottom: 16 }}>
              {wizardItems.map((it, idx) => {
                const isAlreadyMapped = it.action === "already-mapped";
                return (
                  <div key={it.toteatId} style={{ padding: "10px 14px", borderBottom: idx < wizardItems.length - 1 ? "1px solid var(--adm-card-border)" : "none", display: "flex", alignItems: "center", gap: 12, opacity: isAlreadyMapped ? 0.55 : 1 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 600, color: "var(--adm-text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.toteatName}</p>
                      <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>
                        {it.toteatCategory && `${it.toteatCategory} · `}${it.toteatPrice.toLocaleString("es-CL")}
                        {isAlreadyMapped && <> · ya mapeado a "{it.suggestedDishName}"</>}
                        {it.action === "match-found" && it.suggestedDishName && <> · sugerencia: "{it.suggestedDishName}"</>}
                      </p>
                    </div>
                    {!isAlreadyMapped && (
                      <select
                        value={it.chosen}
                        onChange={(e) => {
                          const newVal = e.target.value as "map" | "create" | "skip";
                          setWizardItems((prev) => prev?.map((p) => p.toteatId === it.toteatId ? { ...p, chosen: newVal } : p) || null);
                        }}
                        style={{ padding: "6px 10px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: F, fontSize: "0.78rem", cursor: "pointer", flexShrink: 0 }}
                      >
                        {it.action === "match-found" && <option value="map">Mapear a "{it.suggestedDishName}"</option>}
                        <option value="create">Crear nuevo plato</option>
                        <option value="skip">Saltar</option>
                      </select>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setWizardOpen(false); setWizardItems(null); }}
                disabled={wizardApplying}
                style={{ padding: "10px 18px", background: "var(--adm-hover)", color: "var(--adm-text2)", border: "1px solid var(--adm-card-border)", borderRadius: 999, fontFamily: F, fontSize: "0.82rem", fontWeight: 600, cursor: wizardApplying ? "wait" : "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={applyWizard}
                disabled={wizardApplying}
                style={{ padding: "10px 22px", background: wizardApplying ? "#ccc" : "#F4A623", color: "white", border: "none", borderRadius: 999, fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: wizardApplying ? "wait" : "pointer" }}
              >
                {wizardApplying ? "Aplicando..." : "Aplicar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface DishWithModsProps {
  dish: MappedDish | UnmappedDish;
  mappedKind: "mapped" | "unmapped";
  catalog: CatalogEntry[];
  modifierCatalog: CatalogEntry[];
  disabled: boolean;
  onDishMap: (toteatId: string | null) => void;
  onModifierMap: (modifierId: string, toteatId: string | null) => void;
  onMarkComposite?: () => void;
}

function DishWithModifiers({ dish, mappedKind, catalog, modifierCatalog, disabled, onDishMap, onModifierMap, onMarkComposite }: DishWithModsProps) {
  const hasMods = dish.modifiers.length > 0;
  const mappedMods = dish.modifiers.filter((m) => m.toteatProductId).length;
  const [showMods, setShowMods] = useState(false);
  const [editingDish, setEditingDish] = useState(false);

  return (
    <div>
      {mappedKind === "unmapped" || editingDish ? (
        <DishMapRow
          dish={mappedKind === "unmapped"
            ? (dish as UnmappedDish)
            : { ...(dish as MappedDish), suggestion: { score: 100, toteatProductId: (dish as MappedDish).toteatProductId, name: (dish as MappedDish).toteatName || "" } }
          }
          catalog={catalog}
          disabled={disabled}
          onMarkComposite={mappedKind === "unmapped" ? onMarkComposite : undefined}
          onSelect={(id) => { onDishMap(id); setEditingDish(false); }}
          onCancel={editingDish ? () => setEditingDish(false) : undefined}
        />
      ) : (
        <MappedDishRow dish={dish as MappedDish} disabled={disabled} onEdit={() => setEditingDish(true)} onUnmap={() => onDishMap(null)} />
      )}
      {hasMods && (
        <div style={{ marginTop: 6, marginLeft: 14, paddingLeft: 12, borderLeft: "2px solid var(--adm-card-border)" }}>
          <button
            onClick={() => setShowMods(!showMods)}
            style={{ padding: "4px 8px", background: "transparent", border: "none", fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", cursor: "pointer", fontWeight: 600 }}
          >
            {showMods ? "▾" : "▸"} {dish.modifiers.length} modificador{dish.modifiers.length !== 1 ? "es" : ""} <span style={{ color: mappedMods === dish.modifiers.length ? "#16a34a" : "#F4A623", marginLeft: 4 }}>({mappedMods}/{dish.modifiers.length} mapeados)</span>
          </button>
          {showMods && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
              {dish.modifiers.map((m) => (
                <ModifierMapRow key={m.id} modifier={m} catalog={modifierCatalog} disabled={disabled} onSelect={(id) => onModifierMap(m.id, id)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MappedDishRow({ dish, disabled, onEdit, onUnmap }: { dish: MappedDish; disabled: boolean; onEdit: () => void; onUnmap: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "rgba(0,0,0,0.02)", borderRadius: 8, border: "1px solid var(--adm-card-border)" }}>
      {dish.photo ? <img src={dish.photo} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} /> : <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--adm-card-border)" }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text)", margin: 0, fontWeight: 600 }}>{dish.name}</p>
        <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>
          → {dish.toteatName || dish.toteatProductId} <span style={{ color: "#16a34a", marginLeft: 6 }}>({dish.mappedBy})</span>
        </p>
      </div>
      <button
        onClick={onEdit}
        disabled={disabled}
        title="Cambiar mapeo"
        style={{ padding: "4px 10px", background: "transparent", border: "1px solid var(--adm-card-border)", borderRadius: 6, fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text2)", cursor: "pointer" }}
      >
        ✎ Editar
      </button>
      <button
        onClick={onUnmap}
        disabled={disabled}
        style={{ padding: "4px 10px", background: "transparent", border: "1px solid var(--adm-card-border)", borderRadius: 6, fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text3)", cursor: "pointer" }}
      >
        Desvincular
      </button>
    </div>
  );
}

function DishMapRow({ dish, catalog, disabled, onSelect, onCancel, onMarkComposite }: { dish: UnmappedDish; catalog: CatalogEntry[]; disabled: boolean; onSelect: (toteatId: string) => void; onCancel?: () => void; onMarkComposite?: () => void }) {
  const [value, setValue] = useState(dish.suggestion?.toteatProductId || "");
  const [customMode, setCustomMode] = useState(false);
  const [customId, setCustomId] = useState("");
  const sugg = dish.suggestion;
  const idToSubmit = customMode ? customId.trim() : value;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(239,68,68,0.04)", borderRadius: 10, border: "1px solid rgba(239,68,68,0.15)", flexWrap: "wrap" }}>
      {dish.photo ? <img src={dish.photo} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} /> : <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--adm-card-border)" }} />}
      <div style={{ flex: 1, minWidth: 140 }}>
        <p style={{ fontFamily: F, fontSize: "0.84rem", color: "var(--adm-text)", margin: 0, fontWeight: 600 }}>{dish.name}</p>
        {dish.category && <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>{dish.category}</p>}
      </div>
      {customMode ? (
        <input
          type="text"
          value={customId}
          onChange={(e) => setCustomId(e.target.value)}
          disabled={disabled}
          placeholder="Código Toteat (ej. HV0230)"
          style={{ flex: "1 1 200px", padding: "7px 10px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text)", outline: "none", minWidth: 200 }}
        />
      ) : (
        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled}
          style={{ flex: "1 1 200px", padding: "6px 10px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text)", outline: "none", minWidth: 200 }}
        >
          <option value="">Seleccionar producto Toteat...</option>
          {catalog.map((c) => (
            <option key={c.toteatProductId} value={c.toteatProductId}>
              {c.name} {c.hierarchyName ? `· ${c.hierarchyName}` : ""}
            </option>
          ))}
        </select>
      )}
      <button
        onClick={() => setCustomMode((m) => !m)}
        disabled={disabled}
        title={customMode ? "Volver a la lista" : "Escribir código manualmente (si no aparece en la lista)"}
        style={{ padding: "6px 10px", background: "transparent", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text3)", cursor: "pointer" }}
      >
        {customMode ? "↩ Lista" : "✎ Código"}
      </button>
      {!customMode && sugg && sugg.toteatProductId && (
        <span style={{ fontFamily: F, fontSize: "0.68rem", color: "#F4A623", fontWeight: 600 }}>
          Sugerencia: {sugg.name} ({sugg.score}%)
        </span>
      )}
      <button
        onClick={() => idToSubmit && onSelect(idToSubmit)}
        disabled={!idToSubmit || disabled}
        style={{ padding: "6px 14px", background: "#F4A623", color: "#fff", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.74rem", fontWeight: 700, cursor: !idToSubmit || disabled ? "not-allowed" : "pointer", opacity: !idToSubmit || disabled ? 0.5 : 1 }}
      >
        {onCancel ? "Guardar" : "Mapear"}
      </button>
      {onCancel && (
        <button
          onClick={onCancel}
          disabled={disabled}
          style={{ padding: "6px 10px", background: "transparent", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text3)", cursor: "pointer" }}
        >
          Cancelar
        </button>
      )}
      {onMarkComposite && (
        <button
          onClick={onMarkComposite}
          disabled={disabled}
          title="Este plato no tiene contraparte directa en Toteat porque sus modificadores son los que efectivamente se venden (ej. Limonada Artesanal con varios sabores)"
          style={{ padding: "6px 10px", background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 8, fontFamily: F, fontSize: "0.7rem", color: "#7c3aed", cursor: "pointer", fontWeight: 600 }}
        >
          🧩 Es plato compuesto
        </button>
      )}
    </div>
  );
}

function ModifierMapRow({ modifier, catalog, disabled, onSelect }: { modifier: ModifierInfo; catalog: CatalogEntry[]; disabled: boolean; onSelect: (toteatId: string | null) => void }) {
  const [value, setValue] = useState(modifier.toteatProductId || "");
  const [customMode, setCustomMode] = useState(false);
  const [customId, setCustomId] = useState("");
  const [editing, setEditing] = useState(false);
  const isMapped = !!modifier.toteatProductId;
  const idToSubmit = customMode ? customId.trim() : value;

  if (isMapped && !editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "rgba(34,197,94,0.04)", borderRadius: 8, border: "1px solid rgba(34,197,94,0.15)" }}>
        <span style={{ fontFamily: F, fontSize: "0.74rem", color: "var(--adm-text2)", flex: 1 }}>
          {modifier.name} <span style={{ color: "var(--adm-text3)", fontSize: "0.65rem", marginLeft: 4 }}>· {modifier.group}</span>
        </span>
        <span style={{ fontFamily: FB, fontSize: "0.7rem", color: "#16a34a" }}>
          → {modifier.toteatName || modifier.toteatProductId} {modifier.mappedBy && <span style={{ color: "var(--adm-text3)", marginLeft: 4 }}>({modifier.mappedBy})</span>}
        </span>
        <button
          onClick={() => { setValue(modifier.toteatProductId || ""); setCustomMode(false); setCustomId(""); setEditing(true); }}
          disabled={disabled}
          title="Cambiar mapeo"
          style={{ padding: "3px 8px", background: "transparent", border: "1px solid var(--adm-card-border)", borderRadius: 6, fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text2)", cursor: "pointer" }}
        >
          ✎
        </button>
        <button
          onClick={() => onSelect(null)}
          disabled={disabled}
          title="Desvincular"
          style={{ padding: "3px 8px", background: "transparent", border: "1px solid var(--adm-card-border)", borderRadius: 6, fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", cursor: "pointer" }}
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "rgba(239,68,68,0.03)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.1)", flexWrap: "wrap" }}>
      <span style={{ fontFamily: F, fontSize: "0.74rem", color: "var(--adm-text)", flex: "0 1 auto", minWidth: 100 }}>
        {modifier.name}<span style={{ color: "var(--adm-text3)", fontSize: "0.65rem", marginLeft: 4 }}>· {modifier.group}</span>
      </span>
      {customMode ? (
        <input
          type="text"
          value={customId}
          onChange={(e) => setCustomId(e.target.value)}
          disabled={disabled}
          placeholder="HV0301"
          style={{ flex: "1 1 140px", padding: "5px 8px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 6, fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text)", outline: "none", minWidth: 140 }}
        />
      ) : (
        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled}
          style={{ flex: "1 1 160px", padding: "4px 8px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 6, fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text)", outline: "none", minWidth: 160 }}
        >
          <option value="">Producto Toteat...</option>
          {catalog.map((c) => (
            <option key={c.toteatProductId} value={c.toteatProductId}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      <button
        onClick={() => setCustomMode((m) => !m)}
        disabled={disabled}
        style={{ padding: "4px 8px", background: "transparent", border: "1px solid var(--adm-card-border)", borderRadius: 6, fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", cursor: "pointer" }}
      >
        {customMode ? "↩" : "✎"}
      </button>
      <button
        onClick={() => { if (idToSubmit) { onSelect(idToSubmit); setEditing(false); } }}
        disabled={!idToSubmit || disabled}
        style={{ padding: "4px 10px", background: "#F4A623", color: "#fff", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.68rem", fontWeight: 700, cursor: !idToSubmit || disabled ? "not-allowed" : "pointer", opacity: !idToSubmit || disabled ? 0.5 : 1 }}
      >
        {editing ? "Guardar" : "Mapear"}
      </button>
      {editing && (
        <button
          onClick={() => setEditing(false)}
          disabled={disabled}
          style={{ padding: "4px 8px", background: "transparent", border: "1px solid var(--adm-card-border)", borderRadius: 6, fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", cursor: "pointer" }}
        >
          Cancelar
        </button>
      )}
    </div>
  );
}
