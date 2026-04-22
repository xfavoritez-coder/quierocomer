"use client";

import React, { useState, useEffect, useRef } from "react";
import SkeletonLoading from "@/components/admin/SkeletonLoading";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { norm } from "@/lib/normalize";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

interface Ingredient {
  id: string;
  name: string;
  category: string;
  allergens: { id: string; name: string }[];
  aliases?: string[];
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
    const filtered = existingIngredients.filter(i => !aliasSearch || norm(i.name).includes(norm(aliasSearch)));
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

function AllergenRestrictionTab({ ingredients, type }: { ingredients: Ingredient[]; type: "ALLERGEN" | "RESTRICTION" }) {
  const isRestriction = type === "RESTRICTION";
  const label = isRestriction ? "restricción" : "alérgeno";
  const labelPlural = isRestriction ? "restricciones" : "alérgenos";
  const icon = isRestriction ? "🚫" : "⚠️";
  const chipBg = isRestriction ? "rgba(139,92,246,0.1)" : "#faeeda";
  const chipColor = isRestriction ? "#7c3aed" : "#854f0b";

  const [items, setItems] = useState<{ id: string; name: string; ingredients: { id: string; name: string }[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [ingSearch, setIngSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const F = "var(--font-display)";
  const GOLD = "#F4A623";

  useEffect(() => {
    fetch(`/api/admin/allergens?type=${type}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setItems(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [type]);

  const create = async () => {
    if (!newName.trim()) return;
    const res = await fetch("/api/admin/allergens", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName.trim().toLowerCase(), type }) });
    const a = await res.json();
    if (res.ok) { setItems(prev => [...prev, { ...a, ingredients: [] }]); setNewName(""); }
  };

  const remove = async (id: string) => {
    if (!confirm(`¿Eliminar este ${label}?`)) return;
    await fetch("/api/admin/allergens", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setItems(prev => prev.filter(a => a.id !== id));
  };

  const linkIngredient = async (itemId: string, ingredientId: string) => {
    await fetch("/api/admin/allergens", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ allergenId: itemId, linkIngredientId: ingredientId }) });
    const ing = ingredients.find(i => i.id === ingredientId);
    if (ing) setItems(prev => prev.map(a => a.id === itemId ? { ...a, ingredients: [...a.ingredients, { id: ing.id, name: ing.name }] } : a));
  };

  const unlinkIngredient = async (itemId: string, ingredientId: string) => {
    await fetch("/api/admin/allergens", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ allergenId: itemId, unlinkIngredientId: ingredientId }) });
    setItems(prev => prev.map(a => a.id === itemId ? { ...a, ingredients: a.ingredients.filter(i => i.id !== ingredientId) } : a));
  };

  if (loading) return <SkeletonLoading type="cards" />;

  const filtered = items.filter(a => !search || norm(a.name).includes(norm(search)));

  return (
    <div>
      <p style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "0 0 12px", lineHeight: 1.5 }}>
        {isRestriction
          ? "Gestiona restricciones dietarias (cerdo, alcohol, etc.) y vincula ingredientes. El genio usará estas restricciones para filtrar platos."
          : "Gestiona los alérgenos de la plataforma y vincula ingredientes. Los platos mostrarán automáticamente los alérgenos de sus ingredientes."}
      </p>

      {/* Search + Create */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Buscar ${label}...`}
          style={{ flex: 1, padding: "10px 14px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.85rem", outline: "none" }} />
        <div style={{ display: "flex", gap: 6 }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && create()} placeholder={`Nuevo ${label}`}
            style={{ width: 140, padding: "10px 12px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", outline: "none" }} />
          <button onClick={create} disabled={!newName.trim()} style={{ padding: "10px 16px", background: GOLD, color: "white", border: "none", borderRadius: 10, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", opacity: !newName.trim() ? 0.5 : 1 }}>+</button>
        </div>
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map(a => {
          const isExp = expanded === a.id;
          return (
            <div key={a.id} style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
                {editingId === a.id ? (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
                    <input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={async e => {
                      if (e.key === "Enter" && editName.trim()) {
                        await fetch("/api/admin/allergens", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ allergenId: a.id, name: editName.trim() }) });
                        setItems(prev => prev.map(x => x.id === a.id ? { ...x, name: editName.trim().toLowerCase() } : x));
                        setEditingId(null);
                      }
                      if (e.key === "Escape") setEditingId(null);
                    }} style={{ flex: 1, padding: "4px 8px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 6, fontFamily: F, fontSize: "0.85rem", color: "var(--adm-text)", outline: "none" }} autoFocus />
                    <button onClick={async () => {
                      if (!editName.trim()) return;
                      await fetch("/api/admin/allergens", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ allergenId: a.id, name: editName.trim() }) });
                      setItems(prev => prev.map(x => x.id === a.id ? { ...x, name: editName.trim().toLowerCase() } : x));
                      setEditingId(null);
                    }} style={{ padding: "4px 10px", background: GOLD, color: "white", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.68rem", fontWeight: 700, cursor: "pointer" }}>OK</button>
                    <button onClick={() => setEditingId(null)} style={{ padding: "4px 8px", background: "none", border: "none", color: "var(--adm-text3)", cursor: "pointer", fontSize: "0.68rem" }}>×</button>
                  </div>
                ) : (
                <button onClick={() => setExpanded(isExp ? null : a.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "1rem" }}>{icon}</span>
                  <span style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 600, color: chipColor }}>{a.name}</span>
                  <span style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)" }}>{a.ingredients.length} ingrediente{a.ingredients.length !== 1 ? "s" : ""}</span>
                  <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "var(--adm-text3)", transform: isExp ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▾</span>
                </button>
                )}
                <span onClick={(e) => { e.stopPropagation(); setEditingId(a.id); setEditName(a.name); }} style={{ fontSize: "0.6rem", cursor: "pointer", opacity: 0.5 }}>✏️</span>
                <button onClick={() => remove(a.id)} style={{ padding: "3px 8px", background: "rgba(239,68,68,0.06)", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.62rem", color: "#ef4444", cursor: "pointer" }}>×</button>
              </div>

              {isExp && (
                <div style={{ padding: "0 14px 14px", borderTop: "1px solid var(--adm-card-border)" }}>
                  {a.ingredients.length > 0 && (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", margin: "10px 0" }}>
                      {a.ingredients.map(ing => (
                        <span key={ing.id} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.72rem", padding: "3px 10px", borderRadius: 50, background: chipBg, color: chipColor, fontFamily: F }}>
                          {ing.name}
                          <button onClick={() => unlinkIngredient(a.id, ing.id)} style={{ background: "none", border: "none", cursor: "pointer", color: chipColor, fontSize: "0.6rem", padding: 0 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <input value={ingSearch} onChange={e => setIngSearch(e.target.value)} placeholder="Buscar ingrediente para vincular..."
                    style={{ width: "100%", padding: "8px 10px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: F, fontSize: "0.78rem", outline: "none", marginBottom: 4, boxSizing: "border-box" as const }} />
                  {ingSearch && (
                    <div style={{ maxHeight: 120, overflowY: "auto", border: "1px solid var(--adm-card-border)", borderRadius: 8 }}>
                      {ingredients
                        .filter(i => norm(i.name).includes(norm(ingSearch)) && !a.ingredients.some(ai => ai.id === i.id))
                        .slice(0, 10)
                        .map(i => (
                          <button key={i.id} onClick={() => { linkIngredient(a.id, i.id); setIngSearch(""); }}
                            style={{ display: "block", width: "100%", padding: "7px 10px", background: "none", border: "none", borderBottom: "1px solid var(--adm-card-border)", textAlign: "left", cursor: "pointer", fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text)" }}
                            onMouseOver={e => (e.currentTarget.style.background = isRestriction ? "rgba(139,92,246,0.06)" : "rgba(234,179,8,0.06)")}
                            onMouseOut={e => (e.currentTarget.style.background = "transparent")}
                          >{i.name}</button>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <p style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text3)", textAlign: "center", padding: 32 }}>{search ? "Sin resultados" : `No hay ${labelPlural}`}</p>}
      </div>
    </div>
  );
}

export default function IngredientesPage() {
  const { restaurants } = useAdminSession();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"ingredientes" | "alergenos" | "restricciones" | "ignorados">("ingredientes");
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

  // Edit + merge
  const [editing, setEditing] = useState<string | null>(null);
  const [merging, setMerging] = useState<string | null>(null);
  const [mergeSearch, setMergeSearch] = useState("");
  const [mergeMsg, setMergeMsg] = useState("");
  const mergeRef = useRef<HTMLDivElement>(null);

  // Close merge dropdown on click outside
  useEffect(() => {
    if (!merging) return;
    const handler = (e: MouseEvent) => {
      if (mergeRef.current && !mergeRef.current.contains(e.target as Node)) setMerging(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [merging]);
  const [ignoredList, setIgnoredList] = useState<{ id: string; name: string }[]>([]);
  const [eName, setEName] = useState("");
  const [eCat, setECat] = useState("");

  useEffect(() => {
    fetch("/api/admin/ingredients")
      .then(r => r.json())
      .then(d => { setIngredients(d.ingredients || []); setIgnoredList(d.ignored || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = ingredients.filter(i => {
    if (search && !norm(i.name).includes(norm(search))) return false;
    if (catFilter !== "all" && i.category !== catFilter) return false;
    return true;
  });

  // Check for exact duplicate or similar names
  const checkDuplicate = (name: string, excludeId?: string): { exact: boolean; similar: string[] } => {
    const lower = name.toLowerCase().trim();
    const exact = ingredients.some(i => i.id !== excludeId && i.name.toLowerCase() === lower);
    const similar = ingredients
      .filter(i => i.id !== excludeId && i.name.toLowerCase() !== lower)
      .filter(i => norm(i.name).includes(lower) || lower.includes(norm(i.name)))
      .map(i => i.name)
      .slice(0, 3);
    return { exact, similar };
  };

  const create = async () => {
    if (!newName.trim()) return;
    const dup = checkDuplicate(newName);
    if (dup.exact) { alert(`"${newName.trim()}" ya existe en la lista.`); return; }
    if (dup.similar.length > 0 && !confirm(`Ya existen ingredientes similares: ${dup.similar.join(", ")}.\n\n¿Crear "${newName.trim()}" de todas formas?`)) return;
    const res = await fetch("/api/admin/ingredients", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), category: newCat }),
    });
    const d = await res.json();
    if (d.ingredient) {
      setIngredients(prev => [...prev, { ...d.ingredient, allergens: [] }].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName(""); setNewCat("OTHER"); setCreating(false);
    }
  };

  const update = async () => {
    if (!editing || !eName.trim()) return;
    const dup = checkDuplicate(eName, editing);
    if (dup.exact) { alert(`"${eName.trim()}" ya existe en la lista.`); return; }
    if (dup.similar.length > 0 && !confirm(`Ya existen ingredientes similares: ${dup.similar.join(", ")}.\n\n¿Guardar "${eName.trim()}" de todas formas?`)) return;
    await fetch("/api/admin/ingredients", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing, name: eName.trim(), category: eCat }),
    });
    setIngredients(prev => prev.map(i => i.id === editing ? { ...i, name: eName.trim().toLowerCase(), category: eCat } : i));
    setEditing(null);
  };

  const remove = async (id: string) => {
    const ing = ingredients.find(i => i.id === id);
    if (!ing) return;
    if (!confirm(`¿Eliminar "${ing.name}"? Se desvinculará de todos los platos que lo usen.`)) return;
    const res = await fetch("/api/admin/ingredients", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setIngredients(prev => prev.filter(i => i.id !== id));
    } else {
      const data = await res.json().catch(() => null);
      alert(data?.error || "No se pudo eliminar");
    }
  };

  const catLabel = (cat: string) => CATEGORIES.find(c => c.value === cat);

  if (loading) return <SkeletonLoading type="list" />;

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: GOLD, margin: "0 0 4px" }}>Ingredientes</h1>
      <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 16px" }}>Base de ingredientes compartida por todos los locales · {ingredients.length} total</p>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--adm-hover)", borderRadius: 10, padding: 3 }}>
        {([
          { key: "ingredientes" as const, label: "Ingredientes" },
          { key: "alergenos" as const, label: "Alérgenos" },
          { key: "restricciones" as const, label: "Restricciones" },
          { key: "ignorados" as const, label: `Ignorados (${ignoredList.length})` },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer",
            fontFamily: F, fontSize: "0.82rem", fontWeight: 600,
            background: tab === t.key ? "white" : "transparent",
            color: tab === t.key ? GOLD : "var(--adm-text3)",
            boxShadow: tab === t.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
          }}>{t.label}</button>
        ))}
      </div>

      {tab === "ingredientes" && (<>

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
                        // Auto-link to all dishes that had this suggestion
                        const dishIds = analysisResults.results.filter(r => r.suggested.includes(originalName)).map(r => r.dishId);
                        if (dishIds.length > 0) {
                          await fetch("/api/admin/ingredients", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: d.ingredient.id, linkToDishes: dishIds }) });
                        }
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
        {(() => { const a = ingredients.filter(i => i.allergens.length > 0).length; return a ? <span style={{ fontFamily: F, fontSize: "0.72rem", padding: "4px 10px", borderRadius: 50, background: "rgba(232,85,48,0.08)", color: "#e85530" }}>⚠️ {a} con alérgenos</span> : null; })()}
      </div>

      {/* Search + create */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input placeholder="Buscar ingrediente..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 180, padding: "10px 14px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.85rem", outline: "none" }} />
        {!creating && (
          <button onClick={() => setCreating(true)} style={{ padding: "10px 18px", background: GOLD, color: "white", border: "none", borderRadius: 10, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>+ Nuevo</button>
        )}
      </div>



      {/* Create form */}
      {creating && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ marginBottom: 10 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nombre del ingrediente" autoFocus
              style={{ width: "100%", padding: "10px 12px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text)", fontFamily: F, fontSize: "0.85rem", outline: "none", boxSizing: "border-box" as const }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={create} disabled={!newName.trim()} style={{ padding: "8px 16px", background: GOLD, color: "white", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", opacity: !newName.trim() ? 0.5 : 1 }}>Crear</button>
            <button onClick={() => setCreating(false)} style={{ padding: "8px 16px", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 8, fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)", cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* List */}
      {mergeMsg && (
        <div style={{ padding: "10px 14px", background: "rgba(192,132,252,0.08)", border: "1px solid rgba(192,132,252,0.15)", borderRadius: 10, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.82rem" }}>🔗</span>
          <span style={{ fontFamily: F, fontSize: "0.78rem", color: "#c084fc" }}>{mergeMsg}</span>
        </div>
      )}
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
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontFamily: F, fontSize: "0.85rem", color: "var(--adm-text)", fontWeight: 500 }}>{i.name}</span>
                {i.aliases && i.aliases.length > 0 && (
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 3 }}>
                    {i.aliases.map(a => (
                      <span key={a} style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: "0.6rem", padding: "1px 6px", borderRadius: 50, background: "rgba(192,132,252,0.08)", color: "#c084fc", fontFamily: F }}>
                        ← {a}
                        <button onClick={async (e) => {
                          e.stopPropagation();
                          await fetch("/api/admin/ingredients", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: i.id, removeAlias: a }) });
                          setIngredients(prev => prev.map(x => x.id === i.id ? { ...x, aliases: (x.aliases || []).filter(al => al !== a) } : x));
                        }} style={{ background: "none", border: "none", cursor: "pointer", color: "#c084fc", fontSize: "0.55rem", padding: 0, marginLeft: 1 }}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {i.allergens.length > 0 && <span style={{ fontSize: "0.65rem", padding: "2px 6px", borderRadius: 4, background: "rgba(232,85,48,0.08)", color: "#e85530", fontFamily: F }}>⚠️ {i.allergens.map(a => a.name).join(", ")}</span>}
              <button onClick={() => { setEditing(i.id); setEName(i.name); setECat(i.category); }} style={{ padding: "4px 10px", background: "rgba(127,191,220,0.1)", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.68rem", color: "#7fbfdc", cursor: "pointer", fontWeight: 600 }}>Editar</button>
              <button onClick={() => { setMerging(merging === i.id ? null : i.id); setMergeSearch(""); }} style={{ padding: "4px 10px", background: "rgba(244,166,35,0.08)", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.68rem", color: GOLD, cursor: "pointer", fontWeight: 600 }}>Es alias de...</button>
              <button onClick={() => remove(i.id)} style={{ padding: "4px 10px", background: "rgba(239,68,68,0.06)", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.68rem", color: "#ef4444", cursor: "pointer" }}>×</button>
            </div>
            {merging === i.id && (
              <div ref={mergeRef} style={{ background: "var(--adm-card)", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 10, padding: "10px 14px", marginTop: -4, marginBottom: 4 }}>
                <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", margin: "0 0 6px" }}><strong>{i.name}</strong> es alias de:</p>
                <input value={mergeSearch} onChange={e => setMergeSearch(e.target.value)} placeholder="Buscar ingrediente..." style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--adm-card-border)", borderRadius: 6, fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text)", outline: "none", marginBottom: 4, boxSizing: "border-box" as const }} autoFocus />
                <div style={{ maxHeight: 120, overflowY: "auto" }}>
                  {ingredients.filter(t => t.id !== i.id && (!mergeSearch || norm(t.name).includes(norm(mergeSearch)))).slice(0, 10).map(target => (
                    <button key={target.id} onClick={async () => {
                      if (!confirm(`¿Fusionar "${i.name}" → "${target.name}"? Los platos que tenían "${i.name}" se reasignarán a "${target.name}".`)) return;
                      // 1. Add alias
                      await fetch("/api/admin/ingredients", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: target.id, addAlias: i.name }) });
                      // 2. Reassign dish links from source to target
                      const mergeRes = await fetch("/api/admin/ingredients", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: i.id, mergeInto: target.id }) });
                      const mergeData = await mergeRes.json();
                      // 3. Update local state
                      setIngredients(prev => prev.filter(x => x.id !== i.id).map(x => x.id === target.id ? { ...x, aliases: [...(x.aliases || []), i.name] } : x));
                      setMerging(null);
                      setMergeMsg(`"${i.name}" fusionado con "${target.name}" (${mergeData.merged || 0} platos actualizados)`);
                      setTimeout(() => setMergeMsg(""), 6000);
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
      </>)}

      {/* Tab: Alérgenos */}
      {tab === "alergenos" && (<AllergenRestrictionTab ingredients={ingredients} type="ALLERGEN" />)}

      {/* Tab: Restricciones */}
      {tab === "restricciones" && (<AllergenRestrictionTab ingredients={ingredients} type="RESTRICTION" />)}

      {/* Tab: Ignorados */}
      {tab === "ignorados" && (
        <div>
          <p style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "0 0 16px", lineHeight: 1.5 }}>
            Ingredientes que la IA no volverá a sugerir. Puedes restaurarlos si cambias de opinión.
          </p>
          <input placeholder="Buscar ignorado..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", padding: "10px 14px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.85rem", outline: "none", marginBottom: 12, boxSizing: "border-box" as const }} />
          {(() => {
            const filteredIgnored = ignoredList.filter(ig => !search || norm(ig.name).includes(norm(search)));
            return filteredIgnored.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {filteredIgnored.map(ig => (
                  <div key={ig.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 10 }}>
                    <span style={{ fontFamily: F, fontSize: "0.85rem", color: "var(--adm-text3)", flex: 1 }}>{ig.name}</span>
                    <button onClick={async () => {
                      await fetch("/api/admin/ingredients", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unignoreId: ig.id }) });
                      setIgnoredList(prev => prev.filter(x => x.id !== ig.id));
                    }} style={{ padding: "4px 10px", background: "rgba(22,163,74,0.06)", border: "none", borderRadius: 6, fontFamily: F, fontSize: "0.68rem", color: "#16a34a", cursor: "pointer", fontWeight: 600 }}>Restaurar</button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text3)", textAlign: "center", padding: 32 }}>{search ? "Sin resultados" : "No hay ingredientes ignorados"}</p>
            );
          })()}
        </div>
      )}
    </div>
  );
}
