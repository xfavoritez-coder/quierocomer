"use client";

import { useState, useEffect } from "react";
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

  // Create
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCat, setNewCat] = useState("OTHER");
  const [newAllergen, setNewAllergen] = useState(false);
  const [newAllergenType, setNewAllergenType] = useState("");

  // Edit
  const [editing, setEditing] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [eCat, setECat] = useState("");
  const [eAllergen, setEAllergen] = useState(false);
  const [eAllergenType, setEAllergenType] = useState("");

  useEffect(() => {
    fetch("/api/admin/ingredients")
      .then(r => r.json())
      .then(d => setIngredients(d.ingredients || []))
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
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {analysisResults.allSuggestions.map(name => (
                    <button key={name} onClick={async () => {
                      // Create ingredient
                      const res = await fetch("/api/admin/ingredients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
                      const d = await res.json();
                      if (d.ingredient) {
                        setIngredients(prev => [...prev, d.ingredient].sort((a, b) => a.name.localeCompare(b.name)));
                        // Remove from suggestions
                        setAnalysisResults(prev => prev ? {
                          ...prev,
                          allSuggestions: prev.allSuggestions.filter(s => s !== name),
                          totalSuggested: prev.totalSuggested - 1,
                          results: prev.results.map(r => ({ ...r, matched: r.suggested.includes(name) ? [...r.matched, name] : r.matched, suggested: r.suggested.filter(s => s !== name) })),
                        } : null);
                        // Re-link: find dishes that had this suggestion and link
                        const dishIds = analysisResults.results.filter(r => r.suggested.includes(name)).map(r => r.dishId);
                        for (const did of dishIds) {
                          await fetch(`/api/admin/dishes/${did}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ingredientIds: undefined }) });
                        }
                      }
                    }} style={{ padding: "4px 12px", borderRadius: 50, border: "1px solid rgba(127,191,220,0.3)", background: "white", fontFamily: F, fontSize: "0.72rem", color: "#7fbfdc", cursor: "pointer", fontWeight: 600 }}>
                      + {name}
                    </button>
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
        {CATEGORIES.map(c => {
          const count = ingredients.filter(i => i.category === c.value).length;
          if (!count) return null;
          return <span key={c.value} style={{ fontFamily: F, fontSize: "0.72rem", padding: "4px 10px", borderRadius: 50, background: "var(--adm-hover)", color: "var(--adm-text2)" }}>{c.icon} {c.label} ({count})</span>;
        })}
        {(() => { const a = ingredients.filter(i => i.isAllergen).length; return a ? <span style={{ fontFamily: F, fontSize: "0.72rem", padding: "4px 10px", borderRadius: 50, background: "rgba(232,85,48,0.08)", color: "#e85530" }}>⚠️ Alérgenos ({a})</span> : null; })()}
      </div>

      {/* Search + filter + create */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input placeholder="Buscar ingrediente..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 180, padding: "10px 14px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.85rem", outline: "none" }} />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          style={{ padding: "10px 14px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", outline: "none" }}>
          <option value="all">Todas</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
        </select>
        {!creating && (
          <button onClick={() => setCreating(true)} style={{ padding: "10px 18px", background: GOLD, color: "white", border: "none", borderRadius: 10, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>+ Nuevo</button>
        )}
      </div>

      {/* Create form */}
      {creating && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nombre del ingrediente" autoFocus
              style={{ flex: 1, padding: "10px 12px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: F, fontSize: "0.85rem", outline: "none" }} />
            <select value={newCat} onChange={e => setNewCat(e.target.value)}
              style={{ padding: "10px 12px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", outline: "none" }}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
            </select>
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
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input value={eName} onChange={e => setEName(e.target.value)} style={{ flex: 1, padding: "8px 10px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", outline: "none" }} />
                  <select value={eCat} onChange={e => setECat(e.target.value)} style={{ padding: "8px 10px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: F, fontSize: "0.78rem", outline: "none" }}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                  </select>
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
            <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 10 }}>
              <span style={{ fontSize: "0.85rem" }}>{cat?.icon}</span>
              <span style={{ fontFamily: F, fontSize: "0.85rem", color: "var(--adm-text)", fontWeight: 500, flex: 1 }}>{i.name}</span>
              <span style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)" }}>{cat?.label}</span>
              {i.isAllergen && <span style={{ fontSize: "0.65rem", padding: "2px 6px", borderRadius: 4, background: "rgba(232,85,48,0.08)", color: "#e85530", fontFamily: F }}>⚠️ {i.allergenType || "alérgeno"}</span>}
              <button onClick={() => { setEditing(i.id); setEName(i.name); setECat(i.category); setEAllergen(i.isAllergen); setEAllergenType(i.allergenType || ""); }} style={{ padding: "4px 10px", background: "rgba(127,191,220,0.1)", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.68rem", color: "#7fbfdc", cursor: "pointer", fontWeight: 600 }}>Editar</button>
              <button onClick={() => remove(i.id)} style={{ padding: "4px 10px", background: "rgba(239,68,68,0.06)", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.68rem", color: "#ef4444", cursor: "pointer" }}>×</button>
            </div>
          );
        })}
        {filtered.length === 0 && <p style={{ fontFamily: F, fontSize: "0.85rem", color: "var(--adm-text3)", textAlign: "center", padding: 40 }}>{search ? "Sin resultados" : "Sin ingredientes"}</p>}
      </div>
    </div>
  );
}
