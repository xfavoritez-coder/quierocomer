"use client";

import React, { useState, useEffect } from "react";
import SkeletonLoading from "@/components/admin/SkeletonLoading";
import { useAdminSession } from "@/lib/admin/useAdminSession";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

interface Ingredient {
  id: string;
  name: string;
  category: string;
  isAllergen: boolean;
  allergenType: string | null;
}

const CATEGORIES = [
  { value: "PROTEIN", label: "Proteína", icon: "🥩" },
  { value: "VEGETABLE", label: "Vegetal", icon: "🥬" },
  { value: "FRUIT", label: "Fruta", icon: "🍎" },
  { value: "DAIRY", label: "Lácteo", icon: "🧀" },
  { value: "CARB", label: "Carbohidrato", icon: "🍚" },
  { value: "SAUCE", label: "Salsa", icon: "🫙" },
  { value: "SPICE", label: "Especia", icon: "🌶️" },
  { value: "OTHER", label: "Otro", icon: "📦" },
];

const ALLERGEN_TYPES = ["gluten", "lactosa", "frutos secos", "maní", "mariscos", "soja", "huevo", "sésamo", "apio", "mostaza"];

interface AnalysisResult {
  dishId: string;
  dishName: string;
  matched: string[];
  suggested: string[];
  linkedCount: number;
}

function SuggestionRow({ originalName, existingIngredients, onApprove, onAliasOf, onReject }: {
  originalName: string;
  existingIngredients: Ingredient[];
  onApprove: (name: string) => void;
  onAliasOf: (targetId: string) => void;
  onReject: () => void;
}) {
  const [mode, setMode] = useState<"default" | "edit" | "alias">("default");
  const [editName, setEditName] = useState(originalName);
  const [aliasSearch, setAliasSearch] = useState("");
  const F = "var(--font-display)";

  if (mode === "edit") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "var(--adm-card)", borderRadius: 10, border: "1px solid var(--adm-card-border)" }}>
        <input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && editName.trim()) onApprove(editName.trim()); }} style={{ flex: 1, padding: "6px 10px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text)", outline: "none" }} autoFocus />
        <button onClick={() => { if (editName.trim()) onApprove(editName.trim()); }} style={{ padding: "5px 12px", background: "#F4A623", color: "white", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.72rem", fontWeight: 700, cursor: "pointer" }}>OK</button>
        <button onClick={() => setMode("default")} style={{ padding: "5px 10px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", cursor: "pointer" }}>X</button>
      </div>
    );
  }

  if (mode === "alias") {
    const filtered = existingIngredients.filter(i => !aliasSearch || i.name.includes(aliasSearch.toLowerCase()));
    return (
      <div style={{ padding: "10px 12px", background: "var(--adm-card)", borderRadius: 10, border: "1px solid rgba(244,166,35,0.25)", maxWidth: 320 }}>
        <p style={{ fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text)", margin: "0 0 8px" }}>
          <strong style={{ color: "#F4A623" }}>{originalName}</strong> es alias de:
        </p>
        <input value={aliasSearch} onChange={e => setAliasSearch(e.target.value)} placeholder="Buscar ingrediente..." style={{ width: "100%", padding: "7px 10px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text)", outline: "none", marginBottom: 6, boxSizing: "border-box" as const }} autoFocus />
        <div style={{ maxHeight: 140, overflowY: "auto", border: "1px solid var(--adm-card-border)", borderRadius: 8, marginBottom: 8 }}>
          {filtered.slice(0, 15).map(i => (
            <button key={i.id} onClick={() => onAliasOf(i.id)} style={{ display: "flex", alignItems: "center", width: "100%", padding: "8px 10px", background: "transparent", border: "none", borderBottom: "1px solid var(--adm-card-border)", textAlign: "left", cursor: "pointer", fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text)" }}
              onMouseOver={e => (e.currentTarget.style.background = "rgba(244,166,35,0.06)")}
              onMouseOut={e => (e.currentTarget.style.background = "transparent")}
            >
              {i.name}
            </button>
          ))}
          {filtered.length === 0 && <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", padding: 12, margin: 0, textAlign: "center" }}>Sin resultados</p>}
        </div>
        <button onClick={() => setMode("default")} style={{ padding: "5px 12px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", cursor: "pointer" }}>Cancelar</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "var(--adm-card)", borderRadius: 10, border: "1px solid var(--adm-card-border)" }}>
      <span style={{ fontFamily: F, fontSize: "0.78rem", color: "#7fbfdc", fontWeight: 600, flex: 1 }}>{originalName}</span>
      <button onClick={() => setMode("edit")} style={{ padding: "2px 6px", background: "none", border: "none", cursor: "pointer", opacity: 0.5, fontSize: "0.65rem" }} title="Editar nombre">✏️</button>
      <button onClick={() => onApprove(originalName)} style={{ padding: "4px 10px", background: "rgba(22,163,74,0.1)", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.68rem", color: "#16a34a", cursor: "pointer", fontWeight: 600 }}>Aprobar</button>
      <button onClick={() => setMode("alias")} style={{ padding: "4px 10px", background: "rgba(244,166,35,0.1)", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.68rem", color: "#F4A623", cursor: "pointer", fontWeight: 600 }}>Es alias de...</button>
      <button onClick={onReject} style={{ padding: "4px 10px", background: "rgba(239,68,68,0.06)", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.68rem", color: "#ef4444", cursor: "pointer" }}>Ignorar</button>
    </div>
  );
}

export default function IngredientesPage() {
  const { restaurants } = useAdminSession();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");

  // Analyze carta
  const [analyzeLocal, setAnalyzeLocal] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<{ dishesProcessed: number; totalMatched: number; totalSuggested: number; allSuggestions: string[]; results: AnalysisResult[] } | null>(null);

  // Review
  const [reviewing, setReviewing] = useState(false);
  const [reviewResults, setReviewResults] = useState<{ total: number; issues: any[]; summary: any } | null>(null);

  // Create
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCat, setNewCat] = useState("OTHER");
  const [newAllergen, setNewAllergen] = useState(false);
  const [newAllergenType, setNewAllergenType] = useState("");

  // Edit + merge
  const [editing, setEditing] = useState<string | null>(null);
  const [merging, setMerging] = useState<string | null>(null);
  const [mergeSearch, setMergeSearch] = useState("");
  const [ignoredList, setIgnoredList] = useState<{ id: string; name: string }[]>([]);
  const [eName, setEName] = useState("");
  const [eCat, setECat] = useState("");
  const [eAllergen, setEAllergen] = useState(false);
  const [eAllergenType, setEAllergenType] = useState("");

  useEffect(() => {
    fetch("/api/admin/ingredients")
      .then(r => r.json())
      .then(d => { setIngredients(d.ingredients || []); setIgnoredList(d.ignored || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = ingredients.filter(i => {
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (catFilter !== "all" && i.category !== catFilter) return false;
    return true;
  });

  const create = async () => {
    if (!newName.trim()) return;
    const res = await fetch("/api/admin/ingredients", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), category: newCat }),
    });
    const d = await res.json();
    if (d.ingredient) {
      // Update allergen if needed
      if (newAllergen) {
        await fetch("/api/admin/ingredients", {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: d.ingredient.id, isAllergen: true, allergenType: newAllergenType || null }),
        });
        d.ingredient.isAllergen = true;
        d.ingredient.allergenType = newAllergenType || null;
      }
      setIngredients(prev => [...prev, d.ingredient].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName(""); setNewCat("OTHER"); setNewAllergen(false); setNewAllergenType(""); setCreating(false);
    }
  };

  const update = async () => {
    if (!editing || !eName.trim()) return;
    await fetch("/api/admin/ingredients", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing, name: eName.trim(), category: eCat, isAllergen: eAllergen, allergenType: eAllergenType || null }),
    });
    setIngredients(prev => prev.map(i => i.id === editing ? { ...i, name: eName.trim().toLowerCase(), category: eCat, isAllergen: eAllergen, allergenType: eAllergenType || null } : i));
    setEditing(null);
  };

  const remove = async (id: string) => {
    const res = await fetch("/api/admin/ingredients", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setIngredients(prev => prev.filter(i => i.id !== id));
  };

  const catLabel = (cat: string) => CATEGORIES.find(c => c.value === cat);

  if (loading) return <SkeletonLoading type="list" />;

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: GOLD, margin: "0 0 4px" }}>Ingredientes</h1>
      <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 20px" }}>Base de ingredientes compartida por todos los locales · {ingredients.length} total</p>

      {/* Analyze carta */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 20px", marginBottom: 20 }}>
        <h3 style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px" }}>Analizar carta con IA</h3>
        <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "0 0 12px" }}>Extrae ingredientes automáticamente de todos los platos de un local usando IA (nombre + descripción + foto).</p>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={analyzeLocal} onChange={e => setAnalyzeLocal(e.target.value)}
            style={{ flex: 1, padding: "8px 12px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", outline: "none" }}>
            <option value="">Selecciona un local</option>
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button onClick={async () => {
            if (!analyzeLocal || analyzing) return;
            setAnalyzing(true);
            setAnalysisResults(null);
            const res = await fetch("/api/admin/analyze-carta", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ restaurantId: analyzeLocal }),
            });
            const data = await res.json();
            if (!data.error) {
              setAnalysisResults(data);
              // Reload ingredients
              fetch("/api/admin/ingredients").then(r => r.json()).then(d => setIngredients(d.ingredients || []));
            }
            setAnalyzing(false);
          }} disabled={!analyzeLocal || analyzing}
            style={{ padding: "8px 18px", background: GOLD, color: "white", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", opacity: !analyzeLocal || analyzing ? 0.5 : 1, whiteSpace: "nowrap" }}>
            {analyzing ? "Analizando..." : "Analizar"}
          </button>
        </div>

        {/* Results */}
        {analysisResults && (
          <div style={{ marginTop: 14, borderTop: "1px solid var(--adm-card-border)", paddingTop: 14 }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <span style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)" }}>{analysisResults.dishesProcessed} platos</span>
              <span style={{ fontFamily: F, fontSize: "0.78rem", color: GOLD, fontWeight: 600 }}>{analysisResults.totalMatched} vinculados</span>
              <span style={{ fontFamily: F, fontSize: "0.78rem", color: "#7fbfdc", fontWeight: 600 }}>{analysisResults.totalSuggested} sugeridos</span>
            </div>

            {/* Suggestions to approve */}
            {analysisResults.allSuggestions.length > 0 && (
              <div style={{ background: "rgba(127,191,220,0.06)", border: "1px solid rgba(127,191,220,0.15)", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
                <p style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 600, color: "#7fbfdc", margin: "0 0 8px" }}>Ingredientes sugeridos (no creados aún)</p>
                <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", margin: "0 0 10px" }}>Aprueba los que quieras agregar a la base maestra. Al aprobar, se vinculan automáticamente a los platos que los usan.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {analysisResults.allSuggestions.map(originalName => (
                    <SuggestionRow key={originalName} originalName={originalName} existingIngredients={ingredients} onApprove={async (finalName) => {
                      const res = await fetch("/api/admin/ingredients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: finalName, originalName: finalName !== originalName ? originalName : undefined }) });
                      const d = await res.json();
                      if (d.ingredient) {
                        setIngredients(prev => [...prev, d.ingredient].sort((a, b) => a.name.localeCompare(b.name)));
                        setAnalysisResults(prev => prev ? {
                          ...prev,
                          allSuggestions: prev.allSuggestions.filter(s => s !== originalName),
                          totalSuggested: prev.totalSuggested - 1,
                          results: prev.results.map(r => ({ ...r, matched: r.suggested.includes(originalName) ? [...r.matched, finalName] : r.matched, suggested: r.suggested.filter(s => s !== originalName) })),
                        } : null);
                      }
                    }} onAliasOf={async (targetId) => {
                      // Add originalName as alias to the target ingredient
                      const target = ingredients.find(i => i.id === targetId);
                      if (!target) return;
                      await fetch("/api/admin/ingredients", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: targetId, addAlias: originalName }) });
                      // Update local state
                      setIngredients(prev => prev.map(i => i.id === targetId ? { ...i } : i));
                      setAnalysisResults(prev => prev ? {
                        ...prev,
                        allSuggestions: prev.allSuggestions.filter(s => s !== originalName),
                        totalSuggested: prev.totalSuggested - 1,
                        results: prev.results.map(r => ({ ...r, matched: r.suggested.includes(originalName) ? [...r.matched, target.name] : r.matched, suggested: r.suggested.filter(s => s !== originalName) })),
                      } : null);
                    }} onReject={async () => {
                      await fetch("/api/admin/ingredients", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ignoreName: originalName }) });
                      setAnalysisResults(prev => prev ? {
                        ...prev,
                        allSuggestions: prev.allSuggestions.filter(s => s !== originalName),
                        totalSuggested: prev.totalSuggested - 1,
                        results: prev.results.map(r => ({ ...r, suggested: r.suggested.filter(s => s !== originalName) })),
                      } : null);
                    }} />
                  ))}
                </div>
              </div>
            )}

            {/* Per dish results */}
            <div style={{ maxHeight: 300, overflowY: "auto" }}>
              {analysisResults.results.map(r => (
                <div key={r.dishId} style={{ padding: "8px 0", borderBottom: "1px solid var(--adm-card-border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 600, color: "var(--adm-text)" }}>{r.dishName}</span>
                    <span style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)" }}>{r.matched.length} vinculados · {r.suggested.length} sugeridos</span>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {r.matched.map(ing => <span key={ing} style={{ fontSize: "0.68rem", padding: "2px 8px", borderRadius: 50, background: "rgba(244,166,35,0.08)", color: GOLD, fontFamily: F }}>{ing}</span>)}
                    {r.suggested.map(ing => <span key={ing} style={{ fontSize: "0.68rem", padding: "2px 8px", borderRadius: 50, background: "rgba(127,191,220,0.08)", color: "#7fbfdc", fontFamily: F, fontStyle: "italic" }}>{ing}</span>)}
                    {r.matched.length === 0 && r.suggested.length === 0 && <span style={{ fontSize: "0.68rem", color: "var(--adm-text3)", fontFamily: F }}>Sin ingredientes detectados</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {(() => { const a = ingredients.filter(i => i.isAllergen).length; return a ? <span style={{ fontFamily: F, fontSize: "0.72rem", padding: "4px 10px", borderRadius: 50, background: "rgba(232,85,48,0.08)", color: "#e85530" }}>⚠️ {a} alérgenos</span> : null; })()}
      </div>

      {/* Review consistency */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: reviewResults ? 12 : 0 }}>
          <div>
            <h3 style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 2px" }}>Revisar consistencia</h3>
            <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", margin: 0 }}>IA busca duplicados, errores y sugerencias de limpieza</p>
          </div>
          <button onClick={async () => {
            setReviewing(true); setReviewResults(null);
            try {
              const res = await fetch("/api/admin/ingredients-review", { method: "POST" });
              const data = await res.json();
              if (!data.error) setReviewResults(data);
              else setReviewResults({ total: 0, issues: [{ type: "ERROR", ingredients: [], suggestion: data.error, action: "review" }], summary: { duplicates: 0, typos: 0, generic: 0, orphans: 0, short: 0, mergeSuggestions: 0 } });
            } catch {
              setReviewResults({ total: 0, issues: [{ type: "ERROR", ingredients: [], suggestion: "Error de conexión o timeout. Intenta de nuevo.", action: "review" }], summary: { duplicates: 0, typos: 0, generic: 0, orphans: 0, short: 0, mergeSuggestions: 0 } });
            }
            setReviewing(false);
          }} disabled={reviewing} style={{ padding: "8px 18px", background: GOLD, color: "white", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", opacity: reviewing ? 0.5 : 1, whiteSpace: "nowrap" }}>
            {reviewing ? "Revisando..." : "Revisar"}
          </button>
        </div>

        {reviewResults && (
          <div>
            {/* Summary */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {reviewResults.summary.duplicates > 0 && <span style={{ fontSize: "0.68rem", padding: "3px 10px", borderRadius: 50, background: "rgba(239,68,68,0.08)", color: "#ef4444", fontFamily: F, fontWeight: 600 }}>Duplicados: {reviewResults.summary.duplicates}</span>}
              {reviewResults.summary.typos > 0 && <span style={{ fontSize: "0.68rem", padding: "3px 10px", borderRadius: 50, background: "rgba(244,166,35,0.08)", color: GOLD, fontFamily: F, fontWeight: 600 }}>Errores: {reviewResults.summary.typos}</span>}
              {reviewResults.summary.generic > 0 && <span style={{ fontSize: "0.68rem", padding: "3px 10px", borderRadius: 50, background: "rgba(127,191,220,0.08)", color: "#7fbfdc", fontFamily: F, fontWeight: 600 }}>Genéricos: {reviewResults.summary.generic}</span>}
              {reviewResults.summary.orphans > 0 && <span style={{ fontSize: "0.68rem", padding: "3px 10px", borderRadius: 50, background: "rgba(0,0,0,0.04)", color: "var(--adm-text3)", fontFamily: F, fontWeight: 600 }}>Sin usar: {reviewResults.summary.orphans}</span>}
              {reviewResults.issues.length === 0 && <span style={{ fontSize: "0.78rem", color: "#16a34a", fontFamily: F, fontWeight: 600 }}>Todo limpio, sin problemas detectados</span>}
            </div>

            {/* Issues list */}
            {reviewResults.issues.length > 0 && (
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                {reviewResults.issues.map((issue: any, idx: number) => {
                  const colors: Record<string, { bg: string; color: string; label: string }> = {
                    DUPLICATE: { bg: "rgba(239,68,68,0.06)", color: "#ef4444", label: "Duplicado" },
                    TYPO: { bg: "rgba(244,166,35,0.06)", color: GOLD, label: "Error" },
                    TOO_GENERIC: { bg: "rgba(127,191,220,0.06)", color: "#7fbfdc", label: "Genérico" },
                    ORPHAN: { bg: "rgba(0,0,0,0.02)", color: "var(--adm-text3)", label: "Sin usar" },
                    SHORT: { bg: "rgba(244,166,35,0.06)", color: GOLD, label: "Corto" },
                    MERGE_SUGGESTION: { bg: "rgba(192,132,252,0.06)", color: "#c084fc", label: "Fusionar" },
                    ERROR: { bg: "rgba(239,68,68,0.06)", color: "#ef4444", label: "Error" },
                  };
                  const c = colors[issue.type] || colors.ORPHAN;
                  return (
                    <div key={idx} style={{ padding: "8px 12px", background: c.bg, borderRadius: 8, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: "0.62rem", padding: "2px 6px", borderRadius: 50, background: c.bg, color: c.color, fontFamily: F, fontWeight: 700, border: `1px solid ${c.color}20`, flexShrink: 0 }}>{c.label}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text)", fontWeight: 600 }}>{issue.ingredients.join(" / ")}</span>
                        <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>{issue.suggestion}</p>
                      </div>
                      <span style={{ fontSize: "0.6rem", color: "var(--adm-text3)", fontFamily: F, flexShrink: 0 }}>{issue.action}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search + create */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input placeholder="Buscar ingrediente..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 180, padding: "10px 14px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.85rem", outline: "none" }} />
        {!creating && (
          <button onClick={() => setCreating(true)} style={{ padding: "10px 18px", background: GOLD, color: "white", border: "none", borderRadius: 10, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>+ Nuevo</button>
        )}
      </div>

      {/* Ignored */}
      {ignoredList.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
          <span style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", marginRight: 4 }}>Ignorados:</span>
          {ignoredList.map(ig => (
            <span key={ig.id} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 50, background: "rgba(0,0,0,0.04)", fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)" }}>
              {ig.name}
              <button onClick={async () => {
                await fetch("/api/admin/ingredients", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unignoreId: ig.id }) });
                setIgnoredList(prev => prev.filter(x => x.id !== ig.id));
              }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.55rem", color: "var(--adm-text3)", padding: 0 }}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* Create form */}
      {creating && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ marginBottom: 10 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nombre del ingrediente" autoFocus
              style={{ width: "100%", padding: "10px 12px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: F, fontSize: "0.85rem", outline: "none", boxSizing: "border-box" as const }} />
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", cursor: "pointer" }}>
              <input type="checkbox" checked={newAllergen} onChange={e => setNewAllergen(e.target.checked)} /> ⚠️ Es alérgeno
            </label>
            {newAllergen && (
              <select value={newAllergenType} onChange={e => setNewAllergenType(e.target.value)}
                style={{ padding: "6px 10px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 6, color: "var(--adm-text)", fontFamily: F, fontSize: "0.78rem", outline: "none" }}>
                <option value="">Tipo de alérgeno</option>
                {ALLERGEN_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={create} disabled={!newName.trim()} style={{ padding: "8px 16px", background: GOLD, color: "white", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", opacity: !newName.trim() ? 0.5 : 1 }}>Crear</button>
            <button onClick={() => setCreating(false)} style={{ padding: "8px 16px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)", cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {filtered.map(i => {
          const cat = catLabel(i.category);
          if (editing === i.id) {
            return (
              <div key={i.id} style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: 14 }}>
                <div style={{ marginBottom: 8 }}>
                  <input value={eName} onChange={e => setEName(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", outline: "none", boxSizing: "border-box" as const }} />
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text2)", cursor: "pointer" }}>
                    <input type="checkbox" checked={eAllergen} onChange={e => setEAllergen(e.target.checked)} /> ⚠️ Alérgeno
                  </label>
                  {eAllergen && (
                    <select value={eAllergenType} onChange={e => setEAllergenType(e.target.value)} style={{ padding: "4px 8px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 6, fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text)", outline: "none" }}>
                      <option value="">Tipo</option>
                      {ALLERGEN_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  )}
                  <div style={{ flex: 1 }} />
                  <button onClick={update} style={{ padding: "6px 12px", background: GOLD, color: "white", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.72rem", fontWeight: 700, cursor: "pointer" }}>Guardar</button>
                  <button onClick={() => setEditing(null)} style={{ padding: "6px 12px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 6, fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", cursor: "pointer" }}>X</button>
                </div>
              </div>
            );
          }
          return (
            <React.Fragment key={i.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 10 }}>
              <span style={{ fontFamily: F, fontSize: "0.85rem", color: "var(--adm-text)", fontWeight: 500, flex: 1 }}>{i.name}</span>
              {i.isAllergen && <span style={{ fontSize: "0.65rem", padding: "2px 6px", borderRadius: 4, background: "rgba(232,85,48,0.08)", color: "#e85530", fontFamily: F }}>⚠️ {i.allergenType || "alérgeno"}</span>}
              <button onClick={() => { setEditing(i.id); setEName(i.name); setECat(i.category); setEAllergen(i.isAllergen); setEAllergenType(i.allergenType || ""); }} style={{ padding: "4px 10px", background: "rgba(127,191,220,0.1)", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.68rem", color: "#7fbfdc", cursor: "pointer", fontWeight: 600 }}>Editar</button>
              <button onClick={() => { setMerging(i.id); setMergeSearch(""); }} style={{ padding: "4px 10px", background: "rgba(244,166,35,0.08)", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.68rem", color: GOLD, cursor: "pointer", fontWeight: 600 }}>Es alias de...</button>
              <button onClick={() => remove(i.id)} style={{ padding: "4px 10px", background: "rgba(239,68,68,0.06)", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.68rem", color: "#ef4444", cursor: "pointer" }}>×</button>
            </div>
            {merging === i.id && (
              <div style={{ background: "var(--adm-card)", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 10, padding: "10px 14px", marginTop: -4, marginBottom: 4 }}>
                <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", margin: "0 0 6px" }}><strong>{i.name}</strong> es alias de:</p>
                <input value={mergeSearch} onChange={e => setMergeSearch(e.target.value)} placeholder="Buscar ingrediente..." style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--adm-card-border)", borderRadius: 6, fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text)", outline: "none", marginBottom: 4, boxSizing: "border-box" as const }} autoFocus />
                <div style={{ maxHeight: 120, overflowY: "auto" }}>
                  {ingredients.filter(t => t.id !== i.id && (!mergeSearch || t.name.includes(mergeSearch.toLowerCase()))).slice(0, 10).map(target => (
                    <button key={target.id} onClick={async () => {
                      // 1. Add alias
                      await fetch("/api/admin/ingredients", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: target.id, addAlias: i.name }) });
                      // 2. Reassign dish links from source to target
                      await fetch("/api/admin/ingredients", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: i.id, mergeInto: target.id }) });
                      // 3. Update local state
                      setIngredients(prev => prev.filter(x => x.id !== i.id));
                      setMerging(null);
                    }} style={{ display: "flex", alignItems: "center", width: "100%", padding: "8px 10px", background: "transparent", border: "none", borderBottom: "1px solid var(--adm-card-border)", textAlign: "left", cursor: "pointer", fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text)" }}
                      onMouseOver={e => (e.currentTarget.style.background = "rgba(244,166,35,0.06)")}
                      onMouseOut={e => (e.currentTarget.style.background = "transparent")}
                    >
                      {target.name}
                    </button>
                  ))}
                </div>
                <button onClick={() => setMerging(null)} style={{ marginTop: 4, padding: "3px 10px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 6, fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", cursor: "pointer" }}>Cancelar</button>
              </div>
            )}
            </React.Fragment>
          );
        })}
        {filtered.length === 0 && <p style={{ fontFamily: F, fontSize: "0.85rem", color: "var(--adm-text3)", textAlign: "center", padding: 40 }}>{search ? "Sin resultados" : "Sin ingredientes"}</p>}
      </div>

    </div>
  );
}
