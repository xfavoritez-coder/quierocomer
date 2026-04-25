"use client";

import { useState, useRef, useEffect } from "react";

const LOADING_MESSAGES = [
  "Leyendo la carta...",
  "Detectando categorías...",
  "Extrayendo platos y precios...",
  "Identificando tipos de comida...",
  "Casi listo, afinando detalles...",
];

function LoadingAnalysis({ name }: { name: string }) {
  const [msgIdx, setMsgIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const msgTimer = setInterval(() => setMsgIdx(i => Math.min(i + 1, LOADING_MESSAGES.length - 1)), 4000);
    const progTimer = setInterval(() => setProgress(p => Math.min(p + 2, 90)), 500);
    return () => { clearInterval(msgTimer); clearInterval(progTimer); };
  }, []);
  return (
    <div style={{ textAlign: "center", padding: "60px 0" }}>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
        <span style={{ fontSize: "1.5rem", animation: "sparkle1 1.5s ease-in-out infinite" }}>✨</span>
        <span style={{ fontSize: "2rem", animation: "sparkle2 1.5s ease-in-out infinite 0.3s" }}>⭐</span>
        <span style={{ fontSize: "1.5rem", animation: "sparkle1 1.5s ease-in-out infinite 0.6s" }}>✨</span>
      </div>
      <p style={{ color: "#F4A623", fontSize: "1rem", fontWeight: 600, marginBottom: 4 }}>Analizando la carta de {name}</p>
      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.88rem", marginBottom: 20, transition: "opacity 0.3s" }}>{LOADING_MESSAGES[msgIdx]}</p>
      <div style={{ width: "100%", maxWidth: 280, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", margin: "0 auto", overflow: "hidden" }}>
        <div style={{ width: `${progress}%`, height: "100%", background: "#F4A623", borderRadius: 2, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

interface Dish {
  name: string;
  description: string | null;
  price: number;
  diet: string;
  isSpicy: boolean;
}

interface Category {
  name: string;
  type: string;
  dishes: Dish[];
}

const F = "var(--font-display)";

export default function AgregarLocalPage() {
  const [step, setStep] = useState<"upload" | "loading" | "preview" | "saving" | "done">("upload");
  const [name, setName] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ slug: string; restaurantId: string; totalDishes: number; totalCategories: number; url: string } | null>(null);
  const [photoResults, setPhotoResults] = useState<{ dishId: string; dishName: string; query: string; photoUrl: string | null; selected: boolean }[]>([]);
  const [photoProgress, setPhotoProgress] = useState("");
  const [mode, setMode] = useState<"photos" | "url">("photos");
  const [urlInput, setUrlInput] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [savingProgress, setSavingProgress] = useState("");
  const [aiModel, setAiModel] = useState<"sonnet" | "haiku">("sonnet");
  const skipIngredientsRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Compress image client-side to max 1200px and ~200KB JPEG
  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 1200;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => resolve(blob || file), "image/jpeg", 0.7);
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const handlePhotos = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).slice(0, 5);
    setPhotos(arr);
    setPreviews(arr.map((f) => URL.createObjectURL(f)));
  };

  const analyze = async () => {
    if (!name.trim() || photos.length === 0) return;
    setStep("loading");
    setError("");

    // Compress photos before uploading
    const compressed = await Promise.all(photos.map(compressImage));

    const formData = new FormData();
    formData.set("name", name.trim());
    formData.set("model", aiModel);
    compressed.forEach((blob, i) => formData.append("photos", blob, `photo-${i}.jpg`));

    const debugInfo = photos.map(p => `${p.name} (${p.type || "sin tipo"}, ${Math.round(p.size/1024)}KB)`).join(", ");
    try {
      const res = await fetch("/api/agregarlocal/parse", { method: "POST", body: formData });
      const rawText = await res.text();
      let data;
      try { data = JSON.parse(rawText); } catch { throw new Error(`Respuesta no JSON: ${rawText.slice(0, 200)}`); }
      if (!res.ok) throw new Error(`[${res.status}] ${data.error || JSON.stringify(data).slice(0, 200)}`);
      if (!data.categories?.length) throw new Error("No se encontraron platos. Intenta con fotos más claras.");
      setCategories(data.categories);
      setStep("preview");
    } catch (e: any) {
      setError(`${e.message || String(e)}\n\nArchivos: ${debugInfo}`);
      setStep("upload");
    }
  };

  const analyzeUrl = async () => {
    if (!urlInput.trim()) return;
    setStep("loading");
    setError("");
    try {
      const res = await fetch("/api/agregarlocal/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim(), name: name.trim() || undefined }),
      });
      const rawText = await res.text();
      let data;
      try { data = JSON.parse(rawText); } catch { throw new Error(`Respuesta no válida: ${rawText.slice(0, 200)}`); }
      if (!res.ok) throw new Error(`[${res.status}] ${data.error || "Error"}`);
      if (!data.categories?.length) throw new Error("No se encontraron platos en esa URL.");
      if (!name.trim() && data.restaurantName) setName(data.restaurantName);
      if (data.logo) setLogo(data.logo);
      setCategories(data.categories);
      setStep("preview");
    } catch (e: any) {
      setError(e.message || String(e));
      setStep("upload");
    }
  };

  const confirm = async () => {
    setStep("saving");
    skipIngredientsRef.current = false;
    setSavingProgress("Creando restaurante y platos...");
    try {
      // Step 1: Create restaurant + dishes
      const res = await fetch("/api/agregarlocal/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), categories, logo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");

      setResult({ slug: data.restaurant.slug, restaurantId: data.restaurant.id, totalDishes: data.totalDishes, totalCategories: data.totalCategories, url: data.url });

      // Step 2: Extract ingredients with real progress (skippable)
      const dishIds: string[] = data.dishIds || [];
      for (let i = 0; i < dishIds.length; i++) {
        if (skipIngredientsRef.current) break;
        setSavingProgress(`Extrayendo ingredientes (${i + 1}/${dishIds.length})...`);
        await fetch("/api/agregarlocal/ingredients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dishId: dishIds[i] }),
        }).catch(() => {});
      }

      setSavingProgress("");
      setStep("done");
    } catch (e: any) {
      setError(e.message);
      setStep("preview");
    }
  };

  const updateDish = (catIdx: number, dishIdx: number, field: string, value: any) => {
    setCategories((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next[catIdx].dishes[dishIdx][field] = value;
      return next;
    });
  };

  const removeDish = (catIdx: number, dishIdx: number) => {
    setCategories((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next[catIdx].dishes.splice(dishIdx, 1);
      return next;
    });
  };

  const removeCategory = (catIdx: number) => {
    setCategories((prev) => prev.filter((_, i) => i !== catIdx));
  };

  const totalDishes = categories.reduce((sum, c) => sum + c.dishes.length, 0);

  return (
    <div style={{ minHeight: "100vh", background: "#0e0e0e", color: "white", fontFamily: "var(--font-dm)" }}>
      <div style={{ maxWidth: 500, margin: "0 auto", padding: "40px 20px 80px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <span style={{ fontSize: "2rem" }}>🧞</span>
          <h1 style={{ fontFamily: F, fontSize: "1.5rem", fontWeight: 800, color: "#F4A623", margin: "8px 0 4px" }}>Agregar Local</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.88rem" }}>Sube fotos de la carta y creamos tu menú digital al instante</p>
        </div>

        {/* STEP: Upload */}
        {step === "upload" && (
          <>
            {/* Mode toggle */}
            <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: 4 }}>
              <button onClick={() => setMode("photos")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, background: mode === "photos" ? "#F4A623" : "transparent", color: mode === "photos" ? "#0e0e0e" : "rgba(255,255,255,0.5)" }}>
                📸 Subir fotos
              </button>
              <button onClick={() => setMode("url")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, background: mode === "url" ? "#F4A623" : "transparent", color: mode === "url" ? "#0e0e0e" : "rgba(255,255,255,0.5)" }}>
                🔗 Desde URL
              </button>
            </div>

            {/* Name input — only for photo mode, URL mode auto-detects */}
            {mode === "photos" && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>Nombre del local</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: La Parrilla de Nico"
                  style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "white", fontSize: "1rem", outline: "none", boxSizing: "border-box" }}
                />
              </div>
            )}

            {mode === "photos" ? (
              <>
                {/* Photo upload */}
                <div style={{ marginBottom: 24 }}>
                  <label style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>Fotos de la carta (máx 5)</label>
                  <input ref={inputRef} type="file" accept="image/*" multiple onChange={(e) => handlePhotos(e.target.files)} style={{ display: "none" }} />
                  <button onClick={() => inputRef.current?.click()} style={{ width: "100%", padding: "40px 20px", borderRadius: 14, border: "2px dashed rgba(244,166,35,0.3)", background: "rgba(244,166,35,0.04)", color: "#F4A623", fontSize: "0.95rem", fontWeight: 600, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "2rem" }}>📸</span>
                    {photos.length > 0 ? `${photos.length} foto${photos.length > 1 ? "s" : ""} seleccionada${photos.length > 1 ? "s" : ""}` : "Toca para subir fotos"}
                  </button>
                  {previews.length > 0 && (
                    <div style={{ display: "flex", gap: 8, marginTop: 12, overflowX: "auto" }}>
                      {previews.map((src, i) => (
                        <img key={i} src={src} alt={`Foto ${i + 1}`} style={{ width: 80, height: 80, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* URL input */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>URL de la carta del local</label>
                  <input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://www.ejemplo.com/menu"
                    style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "white", fontSize: "0.92rem", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>Nombre del local (opcional, se detecta automáticamente)</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Se detecta de la página"
                    style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "white", fontSize: "0.92rem", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              </>
            )}

            {/* AI model selector — only for photo mode */}
            {mode === "photos" && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>Modelo de lectura</label>
                <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: 4 }}>
                  <button onClick={() => setAiModel("haiku")} style={{ flex: 1, padding: "10px 8px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, background: aiModel === "haiku" ? "#F4A623" : "transparent", color: aiModel === "haiku" ? "#0e0e0e" : "rgba(255,255,255,0.5)", lineHeight: 1.3 }}>
                    ⚡ Rápido<br /><span style={{ fontSize: "0.68rem", fontWeight: 400, opacity: 0.7 }}>~10 seg</span>
                  </button>
                  <button onClick={() => setAiModel("sonnet")} style={{ flex: 1, padding: "10px 8px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, background: aiModel === "sonnet" ? "#F4A623" : "transparent", color: aiModel === "sonnet" ? "#0e0e0e" : "rgba(255,255,255,0.5)", lineHeight: 1.3 }}>
                    🔍 Preciso<br /><span style={{ fontSize: "0.68rem", fontWeight: 400, opacity: 0.7 }}>~30 seg</span>
                  </button>
                </div>
              </div>
            )}

            {error && (
              <pre style={{ color: "#ef4444", fontSize: "0.75rem", marginBottom: 16, textAlign: "left", whiteSpace: "pre-wrap", wordBreak: "break-all", background: "rgba(239,68,68,0.08)", padding: 12, borderRadius: 10 }}>{error}</pre>
            )}

            <button
              onClick={mode === "photos" ? analyze : analyzeUrl}
              disabled={mode === "photos" ? (!name.trim() || photos.length === 0) : !urlInput.trim()}
              style={{
                width: "100%", padding: "16px", borderRadius: 50, border: "none",
                background: (mode === "photos" ? (name.trim() && photos.length > 0) : urlInput.trim()) ? "#F4A623" : "rgba(255,255,255,0.1)",
                color: (mode === "photos" ? (name.trim() && photos.length > 0) : urlInput.trim()) ? "#0e0e0e" : "rgba(255,255,255,0.3)",
                fontSize: "1rem", fontWeight: 700, cursor: (mode === "photos" ? (name.trim() && photos.length > 0) : urlInput.trim()) ? "pointer" : "not-allowed",
              }}
            >
              {mode === "photos" ? "Analizar carta" : "Importar desde URL"}
            </button>
          </>
        )}

        {/* STEP: Loading */}
        {step === "loading" && <LoadingAnalysis name={name} />}

        {/* STEP: Preview */}
        {step === "preview" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>{name}</h2>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.78rem", margin: "2px 0 0" }}>{categories.length} categorías · {totalDishes} platos</p>
              </div>
              <button onClick={() => setStep("upload")} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.5)", fontSize: "0.75rem", cursor: "pointer" }}>
                ← Volver
              </button>
            </div>

            {error && (
              <p style={{ color: "#ef4444", fontSize: "0.85rem", marginBottom: 12 }}>{error}</p>
            )}

            {categories.map((cat, catIdx) => (
              <div key={catIdx} style={{ marginBottom: 24, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>{cat.name}</h3>
                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.75rem" }}>({cat.dishes.length})</span>
                  </div>
                  <button onClick={() => removeCategory(catIdx)} style={{ background: "none", border: "none", color: "rgba(255,100,100,0.5)", fontSize: "0.72rem", cursor: "pointer" }}>Quitar</button>
                </div>

                {cat.dishes.map((dish: any, dishIdx: number) => (
                  <div key={dishIdx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: dishIdx > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                    {/* Photo thumbnail */}
                    {dish.photo && (
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <img src={dish.photo} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover" }} />
                        <span style={{ position: "absolute", bottom: -2, right: -2, fontSize: "8px", background: "#0e0e0e", borderRadius: 4, padding: "0 3px" }}>{dish._unsplash ? "🔍" : "📷"}</span>
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <input
                        value={dish.name}
                        onChange={(e) => updateDish(catIdx, dishIdx, "name", e.target.value)}
                        style={{ width: "100%", background: "transparent", border: "none", color: "white", fontSize: "0.88rem", fontWeight: 600, outline: "none", padding: 0 }}
                      />
                      {dish.description && (
                        <input
                          value={dish.description}
                          onChange={(e) => updateDish(catIdx, dishIdx, "description", e.target.value)}
                          style={{ width: "100%", background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", fontSize: "0.78rem", outline: "none", padding: "2px 0 0", fontFamily: "inherit" }}
                        />
                      )}
                      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                        {dish.diet !== "OMNIVORE" && (
                          <span style={{ fontSize: "0.65rem", padding: "1px 6px", borderRadius: 4, background: "rgba(74,222,128,0.1)", color: "#4ade80" }}>
                            {dish.diet === "VEGAN" ? "🌿 Vegano" : "🌱 Vegetariano"}
                          </span>
                        )}
                        {dish.isSpicy && <span style={{ fontSize: "0.65rem", padding: "1px 6px", borderRadius: 4, background: "rgba(232,85,48,0.1)", color: "#e85530" }}>🌶️</span>}
                        {dish.modifiers?.length > 0 && <span style={{ fontSize: "0.65rem", padding: "1px 6px", borderRadius: 4, background: "rgba(127,191,220,0.1)", color: "#7fbfdc" }}>⚙️ {dish.modifiers.length} opciones</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                      <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.82rem" }}>$</span>
                      <input
                        value={dish.price || ""}
                        onChange={(e) => updateDish(catIdx, dishIdx, "price", Number(e.target.value.replace(/\D/g, "")))}
                        style={{ width: 60, background: "transparent", border: "none", color: "#F4A623", fontSize: "0.88rem", fontWeight: 600, outline: "none", textAlign: "right", padding: 0 }}
                      />
                    </div>
                    <button onClick={() => removeDish(catIdx, dishIdx)} style={{ background: "none", border: "none", color: "rgba(255,100,100,0.4)", fontSize: "1rem", cursor: "pointer", flexShrink: 0, padding: "0 4px" }}>×</button>
                  </div>
                ))}
              </div>
            ))}

            <button
              onClick={confirm}
              style={{
                width: "100%", padding: "16px", borderRadius: 50, border: "none",
                background: "#F4A623", color: "#0e0e0e",
                fontSize: "1rem", fontWeight: 700, cursor: "pointer",
              }}
            >
              Crear local con {totalDishes} platos
            </button>
          </>
        )}

        {/* STEP: Saving */}
        {step === "saving" && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
              <span style={{ fontSize: "1.3rem", animation: "sparkle1 1.5s ease-in-out infinite" }}>✨</span>
              <span style={{ fontSize: "1.8rem", animation: "sparkle2 1.5s ease-in-out infinite 0.3s" }}>⭐</span>
              <span style={{ fontSize: "1.3rem", animation: "sparkle1 1.5s ease-in-out infinite 0.6s" }}>✨</span>
            </div>
            <p style={{ color: "#F4A623", fontSize: "1rem", fontWeight: 600 }}>Creando {name}...</p>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", marginTop: 8 }}>{savingProgress || "Procesando platos..."}</p>
            <div style={{ width: "100%", maxWidth: 280, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", margin: "16px auto 0", overflow: "hidden" }}>
              <div style={{ width: "70%", height: "100%", background: "#F4A623", borderRadius: 2, animation: "progressIndeterminate 1.5s ease-in-out infinite" }} />
            </div>
            {savingProgress.includes("ingredientes") && (
              <button
                onClick={() => { skipIngredientsRef.current = true; }}
                style={{ marginTop: 20, background: "none", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.5)", borderRadius: 50, padding: "8px 24px", fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" }}
              >
                Saltar este paso
              </button>
            )}
          </div>
        )}

        {/* STEP: Done */}
        {/* STEP: Done */}
        {step === "done" && result && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <span style={{ fontSize: "3rem", display: "block", marginBottom: 16 }}>🎉</span>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "white", marginBottom: 4 }}>{name}</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.88rem", marginBottom: 24 }}>
              {result.totalCategories} categorías · {result.totalDishes} platos
            </p>

            {/* Auto photos button */}
            <button
              onClick={async () => {
                setStep("photos" as any);
                setError("");
                setPhotoProgress("Cargando platos...");
                try {
                  // Get dishes from DB using the restaurant slug
                  const dishesRes = await fetch(`/api/agregarlocal/test-dishes?slug=${result.slug}`);
                  const dishesData = await dishesRes.json();
                  const dbDishes: { id: string; name: string; photos: string[] }[] = dishesData.dishes || [];
                  const needsPhotos = dbDishes.filter(d => !d.photos?.length);
                  if (needsPhotos.length === 0) {
                    setError("Todos los platos ya tienen fotos");
                    setStep("done");
                    return;
                  }
                  const dishNames = needsPhotos.map(d => d.name);

                  setPhotoProgress(`Buscando ${dishNames.length} fotos...`);
                  let urls: string[] = [];
                  try {
                    const res = await fetch(`/api/agregarlocal/search-photo?count=${dishNames.length}`);
                    const data = await res.json();
                    urls = data.urls || [];
                  } catch {}
                  const results: typeof photoResults = dishNames.map((name, i) => ({
                    dishId: "", dishName: name, query: name,
                    photoUrl: urls[i] || null,
                    selected: !!urls[i],
                  }));
                  setPhotoResults(results);
                  setPhotoProgress("");
                } catch (e: any) {
                  setError(e.message || String(e));
                  setStep("done");
                }
              }}
              style={{
                display: "block", width: "100%", padding: "16px", borderRadius: 50,
                background: "#F4A623", color: "#0e0e0e",
                fontSize: "1rem", fontWeight: 700, cursor: "pointer", border: "none", marginBottom: 10,
              }}
            >
              📸 Agregar fotos automáticas
            </button>

            <a
              href={result.url.replace("https://quierocomer.cl", "")}
              target="_blank"
              style={{
                display: "block", width: "100%", padding: "14px", borderRadius: 50,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.7)", textDecoration: "none",
                fontSize: "0.92rem", fontWeight: 600, textAlign: "center", marginBottom: 10,
              }}
            >
              Ver carta QR →
            </a>

            <a
              href={`/qr/${result.slug}/garzon`}
              target="_blank"
              style={{
                display: "block", width: "100%", padding: "14px", borderRadius: 50,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.7)", textDecoration: "none",
                fontSize: "0.92rem", fontWeight: 600, textAlign: "center", marginBottom: 16,
              }}
            >
              🔔 Panel Garzón
            </a>

            <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 16 }}>
              <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.3)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Link de la carta</p>
              <p style={{ fontSize: "0.88rem", color: "#F4A623", margin: 0, wordBreak: "break-all" }}>{result.url}</p>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={() => { navigator.clipboard.writeText(result.url); }} style={{ padding: "10px 24px", borderRadius: 50, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: "0.85rem", cursor: "pointer" }}>Copiar link</button>
              <button onClick={() => { setStep("upload"); setName(""); setPhotos([]); setPreviews([]); setCategories([]); setResult(null); setPhotoResults([]); }} style={{ padding: "10px 24px", borderRadius: 50, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: "0.85rem", cursor: "pointer" }}>Agregar otro</button>
            </div>
          </div>
        )}

        {/* STEP: Photos search/preview */}
        {(step as string) === "photos" && result && (
          <div style={{ padding: "20px 0" }}>
            {error && (
              <pre style={{ color: "#ef4444", fontSize: "0.75rem", marginBottom: 16, textAlign: "left", whiteSpace: "pre-wrap", wordBreak: "break-all", background: "rgba(239,68,68,0.08)", padding: 12, borderRadius: 10 }}>{error}</pre>
            )}
            {photoProgress ? (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <span style={{ fontSize: "2rem", display: "block", marginBottom: 16, animation: "spin 2s linear infinite" }}>📸</span>
                <p style={{ color: "#F4A623", fontSize: "1rem", fontWeight: 600 }}>{photoProgress}</p>
                <div style={{ width: "100%", maxWidth: 280, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", margin: "16px auto 0", overflow: "hidden" }}>
                  <div style={{ width: "60%", height: "100%", background: "#F4A623", borderRadius: 2, animation: "progressIndeterminate 1.5s ease-in-out infinite" }} />
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Fotos encontradas</h2>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.78rem" }}>
                    {photoResults.filter(r => r.selected && r.photoUrl).length} de {photoResults.length} seleccionadas
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                  {photoResults.map((r, i) => (
                    <div key={r.dishId} onClick={() => setPhotoResults(prev => prev.map((p, j) => j === i ? { ...p, selected: !p.selected } : p))}
                      style={{ borderRadius: 12, overflow: "hidden", border: `2px solid ${r.selected ? "#F4A623" : "rgba(255,255,255,0.08)"}`, cursor: "pointer", opacity: r.selected ? 1 : 0.5, transition: "all 0.2s" }}>
                      {r.photoUrl ? (
                        <img src={r.photoUrl} alt={r.dishName} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }} />
                      ) : (
                        <div style={{ width: "100%", aspectRatio: "4/3", background: "#222", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.2)" }}>Sin foto</div>
                      )}
                      <div style={{ padding: "8px 10px", background: "#111" }}>
                        <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "white", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.dishName}</p>
                        <p style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.3)", margin: "2px 0 0" }}>{r.query}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={async () => {
                    const selected = photoResults.filter(r => r.selected && r.photoUrl);
                    if (selected.length === 0) { setStep("done"); return; }
                    try {
                      // Apply all photos in one call by dish name
                      setPhotoProgress(`Aplicando ${selected.length} fotos...`);
                      await fetch("/api/agregarlocal/photos", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          restaurantId: result.restaurantId,
                          photosByName: selected.map(r => ({ name: r.dishName, url: r.photoUrl })),
                        }),
                      });
                      setStep("done");
                      setPhotoProgress("");
                    } catch (e: any) {
                      setError(e.message);
                      setPhotoProgress("");
                    }
                  }}
                  style={{ width: "100%", padding: "16px", borderRadius: 50, border: "none", background: "#F4A623", color: "#0e0e0e", fontSize: "1rem", fontWeight: 700, cursor: "pointer", marginBottom: 10 }}
                >
                  Aplicar {photoResults.filter(r => r.selected && r.photoUrl).length} fotos
                </button>

                <button
                  onClick={() => setStep("done")}
                  style={{ width: "100%", padding: "12px", borderRadius: 50, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.5)", fontSize: "0.88rem", cursor: "pointer" }}
                >
                  Omitir fotos
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes sparkle1 {
          0%, 100% { opacity: 0.4; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes sparkle2 {
          0%, 100% { opacity: 0.6; transform: scale(1) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.15) rotate(15deg); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes progressIndeterminate {
          0% { width: 20%; margin-left: 0; }
          50% { width: 40%; margin-left: 30%; }
          100% { width: 20%; margin-left: 80%; }
        }
      `}</style>
    </div>
  );
}
