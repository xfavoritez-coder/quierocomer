"use client";
import { useState, useEffect, useMemo } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";

const PROVIDERS = ["", "Mercat", "Justo", "Rappi", "UberEats", "Fudo", "OlaClick", "Gourmedia", "Queresto", "Toteat", "InfluyeApp"];
const F = "var(--font-display)";

interface Row {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  cartaProvider: string | null;
  websiteIsOrderUrl: boolean;
}

interface RowState {
  website: string;
  cartaProvider: string;
  saving: boolean;
  saved: boolean;
  error: string | null;
}

export default function LocalesBarrido() {
  const { isSuper, loading: authLoading } = useAdminSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [states, setStates] = useState<Record<string, RowState>>({});
  const [search, setSearch] = useState("");
  const [filterProvider, setFilterProvider] = useState<"all" | "filled" | "empty">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/locales")
      .then(r => r.json())
      .then((data: { restaurants?: Row[] } | Row[]) => {
        const list: Row[] = Array.isArray(data) ? data : [];
        const sorted = list.sort((a, b) => a.name.localeCompare(b.name, "es"));
        setRows(sorted);
        const init: Record<string, RowState> = {};
        sorted.forEach(r => {
          init[r.id] = {
            website: r.website ?? "",
            cartaProvider: r.cartaProvider ?? "",
            saving: false,
            saved: false,
            error: null,
          };
        });
        setStates(init);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      const s = states[r.id];
      if (!s) return false;
      const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase());
      const matchProvider =
        filterProvider === "all" ? true :
        filterProvider === "filled" ? (s.cartaProvider !== "" || s.website !== "") :
        (s.cartaProvider === "" && s.website === "");
      return matchSearch && matchProvider;
    });
  }, [rows, states, search, filterProvider]);

  function updateState(id: string, patch: Partial<RowState>) {
    setStates(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function save(row: Row) {
    const s = states[row.id];
    if (!s) return;
    updateState(row.id, { saving: true, saved: false, error: null });
    try {
      const res = await fetch(`/api/admin/locales/${row.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website: s.website || null,
          cartaProvider: s.cartaProvider || null,
        }),
      });
      if (!res.ok) throw new Error("Error");
      updateState(row.id, { saving: false, saved: true });
      setTimeout(() => updateState(row.id, { saved: false }), 2000);
    } catch {
      updateState(row.id, { saving: false, error: "Error al guardar" });
    }
  }

  if (authLoading) return null;
  if (!isSuper) return <p style={{ color: "#fff", padding: 32 }}>Sin acceso</p>;

  const filledCount = rows.filter(r => states[r.id]?.cartaProvider || states[r.id]?.website).length;

  return (
    <div style={{ color: "#fff", fontFamily: F, maxWidth: 900 }}>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: 4 }}>Barrido de cartas online</h1>
      <p style={{ color: "#888", fontSize: "0.82rem", marginBottom: 20 }}>
        {rows.length} locales · {filledCount} con carta/proveedor · Esta página es temporal
      </p>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          placeholder="Buscar local..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: "8px 12px", borderRadius: 8, border: "1px solid #333", background: "#1a1a1a", color: "#fff", fontFamily: F, fontSize: "0.85rem" }}
        />
        <select
          value={filterProvider}
          onChange={e => setFilterProvider(e.target.value as typeof filterProvider)}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #333", background: "#1a1a1a", color: "#fff", fontFamily: F, fontSize: "0.85rem" }}
        >
          <option value="all">Todos ({rows.length})</option>
          <option value="filled">Con carta/proveedor ({filledCount})</option>
          <option value="empty">Sin carta ({rows.length - filledCount})</option>
        </select>
      </div>

      {loading ? (
        <p style={{ color: "#666" }}>Cargando...</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 220px 150px 80px", gap: 8, padding: "6px 10px", color: "#555", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", borderBottom: "1px solid #2a2a2a" }}>
            <span>Local</span>
            <span>URL de carta</span>
            <span>Proveedor</span>
            <span></span>
          </div>

          {filtered.map(row => {
            const s = states[row.id];
            if (!s) return null;
            const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(row.name + " carta online")}`;
            const isDirty = s.website !== (row.website ?? "") || s.cartaProvider !== (row.cartaProvider ?? "");

            return (
              <div key={row.id} style={{ display: "grid", gridTemplateColumns: "1fr 220px 150px 80px", gap: 8, padding: "8px 10px", borderRadius: 8, background: s.saved ? "rgba(74,222,128,0.08)" : (isDirty ? "rgba(244,166,35,0.06)" : "transparent"), alignItems: "center", borderBottom: "1px solid #1e1e1e" }}>
                {/* Nombre */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <a href={googleUrl} target="_blank" rel="noopener noreferrer" title="Buscar en Google" style={{ fontSize: "0.85rem", color: isDirty ? "#F4A623" : (s.cartaProvider || s.website ? "#4ade80" : "#ccc"), textDecoration: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                    {row.name}
                    <span style={{ marginLeft: 4, opacity: 0.4, fontSize: "0.7rem" }}>↗</span>
                  </a>
                </div>

                {/* URL */}
                <input
                  value={s.website}
                  onChange={e => updateState(row.id, { website: e.target.value, saved: false })}
                  placeholder="https://..."
                  style={{ padding: "5px 8px", borderRadius: 6, border: `1px solid ${s.website ? "#F4A623" : "#2a2a2a"}`, background: "#111", color: "#fff", fontFamily: F, fontSize: "0.78rem", width: "100%" }}
                />

                {/* Proveedor */}
                <select
                  value={s.cartaProvider}
                  onChange={e => updateState(row.id, { cartaProvider: e.target.value, saved: false })}
                  style={{ padding: "5px 8px", borderRadius: 6, border: `1px solid ${s.cartaProvider ? "#F4A623" : "#2a2a2a"}`, background: "#111", color: "#fff", fontFamily: F, fontSize: "0.78rem", width: "100%" }}
                >
                  {PROVIDERS.map(p => <option key={p} value={p}>{p || "— ninguno"}</option>)}
                </select>

                {/* Guardar */}
                <button
                  onClick={() => save(row)}
                  disabled={s.saving || !isDirty}
                  style={{ padding: "5px 10px", borderRadius: 6, border: "none", background: s.saved ? "#4ade80" : (isDirty ? "#F4A623" : "#2a2a2a"), color: s.saved ? "#000" : (isDirty ? "#000" : "#555"), fontFamily: F, fontSize: "0.75rem", fontWeight: 700, cursor: isDirty ? "pointer" : "default" }}
                >
                  {s.saving ? "..." : s.saved ? "✓" : s.error ? "Error" : "Guardar"}
                </button>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <p style={{ color: "#555", padding: "16px 10px" }}>Sin resultados</p>
          )}
        </div>
      )}
    </div>
  );
}
