"use client";

import { useEffect, useState, useCallback } from "react";

const F = "var(--font-display)";
const FB = "var(--font-body)";

interface CatalogEntry { toteatProductId: string; name: string; hierarchyName: string | null; totalSold?: number; }
interface MappedDish { id: string; name: string; photo: string | null; category: string | null; toteatProductId: string; toteatName: string | null; mappedBy: string; mappedAt: string | null; }
interface UnmappedDish { id: string; name: string; photo: string | null; category: string | null; suggestion: { score: number; toteatProductId: string; name: string } | null; }
interface ToteatStatus {
  summary: { total: number; mapped: number; unmapped: number; mappedPct: number; catalogSize: number };
  mapped: MappedDish[];
  unmapped: UnmappedDish[];
  catalog: CatalogEntry[];
  error?: string;
}

export default function ToteatMappingPanel({ restaurantId }: { restaurantId: string }) {
  const [data, setData] = useState<ToteatStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/dishes/toteat-status?restaurantId=${restaurantId}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setData({ ...d, summary: { total: 0, mapped: 0, unmapped: 0, mappedPct: 0, catalogSize: 0 }, mapped: [], unmapped: [], catalog: [] }); else setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  const runAutoMap = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/dishes/auto-map-toteat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      const d = await res.json();
      if (d.ok) setMsg(`Auto-mapeo: ${d.summary.matched} matcheados · ${d.summary.candidates} candidatos · ${d.summary.unmapped} sin coincidencia`);
      else setMsg(`Error: ${d.error || "desconocido"}`);
      load();
    } finally { setBusy(false); }
  };

  const setMapping = async (dishId: string, toteatProductId: string | null) => {
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

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: "var(--adm-text3)", fontFamily: F }}>Cargando estado de mapeo…</div>;
  if (!data) return <div style={{ padding: 24, color: "#ef4444", fontFamily: F }}>Error al cargar el panel.</div>;

  const noToteat = data.summary.catalogSize === 0;

  if (noToteat) {
    return (
      <div style={{ padding: 24, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, textAlign: "center" }}>
        <p style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 6px" }}>
          🔌 Integración con Toteat no configurada
        </p>
        <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: 0 }}>
          Este local todavía no tiene credenciales de Toteat. Una vez configuradas y después del primer sync de ventas, vas a poder mapear automáticamente cada plato a su producto Toteat para tener métricas cruzadas (vistas vs ventas reales).
        </p>
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
            <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "4px 0 0" }}>
              {data.summary.catalogSize} productos Toteat disponibles (vendidos en los últimos 30 días)
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
              <DishMapRow
                key={d.id}
                dish={d}
                catalog={data.catalog}
                disabled={busy}
                onSelect={(toteatId) => setMapping(d.id, toteatId)}
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
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "rgba(0,0,0,0.02)", borderRadius: 8, border: "1px solid var(--adm-card-border)" }}>
                {d.photo ? <img src={d.photo} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} /> : <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--adm-card-border)" }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text)", margin: 0, fontWeight: 600 }}>{d.name}</p>
                  <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>
                    → {d.toteatName || d.toteatProductId} <span style={{ color: "#16a34a", marginLeft: 6 }}>({d.mappedBy})</span>
                  </p>
                </div>
                <button
                  onClick={() => setMapping(d.id, null)}
                  disabled={busy}
                  style={{ padding: "4px 10px", background: "transparent", border: "1px solid var(--adm-card-border)", borderRadius: 6, fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text3)", cursor: "pointer" }}
                >
                  Desvincular
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DishMapRow({ dish, catalog, disabled, onSelect }: { dish: UnmappedDish; catalog: CatalogEntry[]; disabled: boolean; onSelect: (toteatId: string) => void }) {
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
        Mapear
      </button>
    </div>
  );
}
