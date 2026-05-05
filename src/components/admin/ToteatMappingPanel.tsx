"use client";

import { useEffect, useState, useCallback } from "react";

const F = "var(--font-display)";
const FB = "var(--font-body)";

interface CatalogEntry { toteatProductId: string; name: string; hierarchyName: string | null; totalSold?: number; }
interface ModifierInfo { id: string; name: string; group: string; template: string; toteatProductId: string | null; toteatName: string | null; mappedBy: string | null; }
interface MappedDish { id: string; name: string; photo: string | null; category: string | null; toteatProductId: string; toteatName: string | null; mappedBy: string; mappedAt: string | null; modifiers: ModifierInfo[]; }
interface UnmappedDish { id: string; name: string; photo: string | null; category: string | null; suggestion: { score: number; toteatProductId: string; name: string } | null; modifiers: ModifierInfo[]; }
interface ToteatStatus {
  summary: { total: number; mapped: number; unmapped: number; mappedPct: number; catalogSize: number };
  mapped: MappedDish[];
  unmapped: UnmappedDish[];
  catalog: CatalogEntry[];
  modifierCatalog: CatalogEntry[];
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
        setMsg("Credenciales guardadas. Sincronizando catalogo y mapeando platos...");
        // Disparar primer sync para cargar el catálogo
        await fetch("/api/admin/toteat/sync-now", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restaurantId }),
        }).catch(() => {});
        // Auto-mapear automaticamente despues del sync
        await Promise.all([
          fetch("/api/admin/dishes/auto-map-toteat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ restaurantId }),
          }).catch(() => {}),
          fetch("/api/admin/modifiers/auto-map-toteat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ restaurantId }),
          }).catch(() => {}),
        ]);
        setMsg("✓ Conexion lista. Revisa abajo cuantos platos quedaron mapeados automaticamente.");
        load();
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
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 16px", marginBottom: 16,
              background: "linear-gradient(90deg, rgba(244,166,35,0.12), rgba(244,166,35,0.04))",
              border: "1.5px solid rgba(244,166,35,0.4)",
              borderRadius: 10, cursor: "pointer", width: "100%",
              fontFamily: F, fontSize: "0.85rem", fontWeight: 700, color: "#92400e",
              textAlign: "left",
            }}
          >
            <span style={{ fontSize: "1.2rem" }}>📧</span>
            <span style={{ flex: 1 }}>¿No tienes las credenciales? Te ayudamos a pedirlas a Toteat</span>
            <span style={{ fontSize: "0.85rem", opacity: 0.7 }}>→</span>
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

Soy el administrador del local ${localName} y necesito las credenciales de API de mi cuenta:

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
              />
            ))}
          </div>
        </div>
      )}

      {/* Mapped list */}
      {filteredMapped.length > 0 && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "14px 16px" }}>
          <p style={{ fontFamily: F, fontSize: "0.84rem", fontWeight: 700, color: "#16a34a", margin: "0 0 12px" }}>
            ✓ Mapeados ({filteredMapped.length})
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
}

function DishWithModifiers({ dish, mappedKind, catalog, modifierCatalog, disabled, onDishMap, onModifierMap }: DishWithModsProps) {
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

function DishMapRow({ dish, catalog, disabled, onSelect, onCancel }: { dish: UnmappedDish; catalog: CatalogEntry[]; disabled: boolean; onSelect: (toteatId: string) => void; onCancel?: () => void }) {
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
