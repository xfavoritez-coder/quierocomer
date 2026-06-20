"use client";
import { useState, useEffect, useMemo } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { norm } from "@/lib/normalize";

interface Local {
  id: string;
  slug: string;
  name: string;
  phone: string | null;
  website: string | null;
  websiteIsOrderUrl: boolean;
  instagram: string | null;
  cartaProvider: string | null;
  isShowcase: boolean;
  isActive: boolean;
  googleMapsUrl: string | null;
}

const PROVIDERS = [
  "", "Fudo", "OlaClick", "Gourmedia", "Queresto", "Toteat", "InfluyeApp",
  "Rappi", "UberEats", "Mercat", "Justo",
];

const PROVIDER_COLORS: Record<string, string> = {
  Rappi: "#ff441f",
  UberEats: "#06c167",
  Mercat: "#1a56db",
  Justo: "#7c3aed",
  Fudo: "#F59E0B",
  OlaClick: "#0ea5e9",
  Gourmedia: "#6366f1",
  Queresto: "#ec4899",
  Toteat: "#10b981",
  InfluyeApp: "#f97316",
};

export default function AdminProveedores() {
  const { isSuper } = useAdminSession();
  const [locals, setLocals] = useState<Local[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterProvider, setFilterProvider] = useState("todos");
  const [saving, setSaving] = useState<string | null>(null);
  const [revalidating, setRevalidating] = useState(false);
  const [revalidated, setRevalidated] = useState(false);
  const [edits, setEdits] = useState<Record<string, Partial<Local>>>({});

  useEffect(() => {
    fetch("/api/admin/locales")
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => {
        const mapped: Local[] = data.map(r => ({
          id: r.id,
          slug: r.slug,
          name: r.name,
          phone: r.phone,
          website: r.website,
          websiteIsOrderUrl: r.websiteIsOrderUrl ?? false,
          instagram: r.instagram,
          cartaProvider: r.cartaProvider,
          isShowcase: r.isShowcase,
          isActive: r.isActive,
          googleMapsUrl: r.googleMapsUrl,
        }));
        setLocals(mapped);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = locals;
    if (filterProvider !== "todos") {
      if (filterProvider === "sin") list = list.filter(r => !r.cartaProvider);
      else list = list.filter(r => r.cartaProvider === filterProvider);
    }
    if (search.trim()) {
      const q = norm(search);
      list = list.filter(r => norm(r.name).includes(q) || norm(r.slug).includes(q));
    }
    return list;
  }, [locals, search, filterProvider]);

  function getEdit<K extends keyof Local>(id: string, key: K, fallback: Local[K]): Local[K] {
    return (edits[id]?.[key] as Local[K]) ?? fallback;
  }

  function setEdit(id: string, key: keyof Local, val: any) {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [key]: val } }));
  }

  async function save(local: Local) {
    const patch = edits[local.id];
    if (!patch || Object.keys(patch).length === 0) return;
    setSaving(local.id);
    try {
      const res = await fetch(`/api/admin/locales/${local.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        setLocals(prev => prev.map(r => r.id === local.id ? { ...r, ...patch } : r));
        setEdits(prev => { const next = { ...prev }; delete next[local.id]; return next; });
      }
    } finally {
      setSaving(null);
    }
  }

  const providerCounts = useMemo(() => {
    const counts: Record<string, number> = { sin: 0 };
    for (const r of locals) {
      if (!r.cartaProvider) counts.sin = (counts.sin || 0) + 1;
      else counts[r.cartaProvider] = (counts[r.cartaProvider] || 0) + 1;
    }
    return counts;
  }, [locals]);

  async function revalidateCache() {
    setRevalidating(true);
    try {
      await fetch("/api/admin/revalidate-feed", { cache: "no-store" });
      setRevalidated(true);
      setTimeout(() => setRevalidated(false), 3000);
    } finally {
      setRevalidating(false);
    }
  }

  if (loading) return <div style={{ padding: 40, color: "#888" }}>Cargando...</div>;

  const inp = (style?: React.CSSProperties): React.CSSProperties => ({
    border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px",
    fontSize: 13, background: "#fff", color: "#111", outline: "none",
    width: "100%", boxSizing: "border-box", ...style,
  });

  return (
    <div style={{ padding: "24px 20px", maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, margin: 0 }}>
          Proveedores
        </h1>
        <button
          onClick={revalidateCache}
          disabled={revalidating}
          style={{
            padding: "6px 14px", borderRadius: 8, border: "none",
            background: revalidated ? "#16a34a" : "#0f172a", color: "#fff",
            fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: revalidating ? 0.6 : 1,
          }}
        >
          {revalidating ? "Actualizando..." : revalidated ? "✓ Cache actualizado" : "Revalidar cache feed"}
        </button>
      </div>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
        {locals.length} locales · edita cartaProvider, website, teléfono e Instagram inline
      </p>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <input
          placeholder="Buscar por nombre o slug..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inp(), width: 240 }}
        />
        <select
          value={filterProvider}
          onChange={e => setFilterProvider(e.target.value)}
          style={{ ...inp(), width: "auto" }}
        >
          <option value="todos">Todos ({locals.length})</option>
          <option value="sin">Sin proveedor ({providerCounts.sin || 0})</option>
          {PROVIDERS.filter(Boolean).map(p => (
            <option key={p} value={p}>{p} ({providerCounts[p] || 0})</option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 4 }}>
          Mostrando {filtered.length}
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
              <th style={th()}>Local</th>
              <th style={th()}>Proveedor</th>
              <th style={th()}>Website / URL pedido</th>
              <th style={th(80)}>¿Es orden?</th>
              <th style={th()}>Teléfono</th>
              <th style={th()}>Instagram</th>
              <th style={th(80)}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(local => {
              const hasEdit = !!edits[local.id] && Object.keys(edits[local.id]).length > 0;
              const provider = getEdit(local.id, "cartaProvider", local.cartaProvider);
              const provColor = provider ? (PROVIDER_COLORS[provider] ?? "#6366f1") : "#94a3b8";
              return (
                <tr key={local.id} style={{
                  borderBottom: "1px solid #f1f5f9",
                  background: hasEdit ? "#fffbeb" : undefined,
                }}>
                  {/* Name */}
                  <td style={td()}>
                    <div style={{ fontWeight: 600, color: "#0f172a" }}>{local.name}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>
                      /{local.slug}
                      {local.isShowcase && <span style={{ marginLeft: 4, color: "#f59e0b" }}>showcase</span>}
                      {!local.isActive && <span style={{ marginLeft: 4, color: "#ef4444" }}>inactivo</span>}
                    </div>
                  </td>

                  {/* Provider */}
                  <td style={td()}>
                    <select
                      value={provider ?? ""}
                      onChange={e => setEdit(local.id, "cartaProvider", e.target.value || null)}
                      style={{
                        ...inp(),
                        color: provider ? provColor : "#94a3b8",
                        fontWeight: provider ? 600 : 400,
                        borderColor: provider ? provColor + "66" : "#e2e8f0",
                      }}
                    >
                      {PROVIDERS.map(p => (
                        <option key={p} value={p}>{p || "—"}</option>
                      ))}
                    </select>
                  </td>

                  {/* Website */}
                  <td style={td(220)}>
                    <input
                      value={getEdit(local.id, "website", local.website) ?? ""}
                      onChange={e => setEdit(local.id, "website", e.target.value || null)}
                      placeholder="https://..."
                      style={inp()}
                    />
                  </td>

                  {/* websiteIsOrderUrl */}
                  <td style={{ ...td(80), textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={getEdit(local.id, "websiteIsOrderUrl", local.websiteIsOrderUrl) ?? false}
                      onChange={e => setEdit(local.id, "websiteIsOrderUrl", e.target.checked)}
                      style={{ width: 16, height: 16, cursor: "pointer" }}
                    />
                  </td>

                  {/* Phone */}
                  <td style={td(140)}>
                    <input
                      value={getEdit(local.id, "phone", local.phone) ?? ""}
                      onChange={e => setEdit(local.id, "phone", e.target.value || null)}
                      placeholder="+56 9..."
                      style={inp()}
                    />
                  </td>

                  {/* Instagram */}
                  <td style={td(160)}>
                    <input
                      value={getEdit(local.id, "instagram", local.instagram) ?? ""}
                      onChange={e => setEdit(local.id, "instagram", e.target.value || null)}
                      placeholder="@handle"
                      style={inp()}
                    />
                  </td>

                  {/* Actions */}
                  <td style={{ ...td(80), textAlign: "center" }}>
                    {hasEdit && (
                      <button
                        onClick={() => save(local)}
                        disabled={saving === local.id}
                        style={{
                          padding: "4px 12px", borderRadius: 6, border: "none",
                          background: "#0f172a", color: "#fff",
                          fontSize: 12, fontWeight: 600, cursor: "pointer",
                          opacity: saving === local.id ? 0.6 : 1,
                        }}
                      >
                        {saving === local.id ? "..." : "Guardar"}
                      </button>
                    )}
                    {!hasEdit && local.website && (
                      <a
                        href={local.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 11, color: "#3b82f6", textDecoration: "none" }}
                      >
                        ↗ web
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Sin resultados</div>
        )}
      </div>
    </div>
  );
}

function th(width?: number): React.CSSProperties {
  return {
    textAlign: "left", padding: "8px 10px", fontSize: 11,
    fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
    color: "#64748b", whiteSpace: "nowrap", width: width ?? undefined,
  };
}

function td(width?: number): React.CSSProperties {
  return { padding: "6px 10px", verticalAlign: "middle", width: width ?? undefined };
}
