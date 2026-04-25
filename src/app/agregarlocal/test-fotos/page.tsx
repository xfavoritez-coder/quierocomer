"use client";
import { useState, useEffect } from "react";

export default function TestFotos() {
  const [restaurantId, setRestaurantId] = useState("");
  const [dishes, setDishes] = useState<{ id: string; name: string; photos: string[] }[]>([]);
  const [results, setResults] = useState<{ name: string; photoUrl: string | null; selected: boolean }[]>([]);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState<"load" | "searching" | "preview" | "applying">("load");

  const loadDishes = async () => {
    const slug = restaurantId.trim() || "calendula";
    setProgress("Cargando platos...");
    try {
      const res = await fetch(`/api/agregarlocal/test-dishes?slug=${slug}`);
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setDishes(data.dishes || []);
      setProgress(`${data.dishes?.length || 0} platos cargados`);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const searchPhotos = async () => {
    const needsPhotos = dishes.filter(d => !d.photos?.length);
    if (needsPhotos.length === 0) { setError("Todos los platos ya tienen fotos"); return; }
    setStep("searching");
    setError("");
    const r: typeof results = [];
    for (let i = 0; i < needsPhotos.length; i++) {
      const d = needsPhotos[i];
      setProgress(`Buscando foto ${i + 1} de ${needsPhotos.length}: ${d.name}`);
      const query = d.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z\s]/g, "").trim() || d.name;
      let photoUrl: string | null = null;
      try {
        const res = await fetch(`/api/agregarlocal/search-photo?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        photoUrl = data.url || null;
        if (data.error) console.log(`Error for ${d.name}:`, data.error);
      } catch (e: any) {
        console.log(`Fetch error for ${d.name}:`, e.message);
      }
      r.push({ name: d.name, photoUrl, selected: !!photoUrl });
      // Delay to respect Unsplash rate limit (50 req/hour on free plan)
      if (i < needsPhotos.length - 1) await new Promise(ok => setTimeout(ok, 1500));
    }
    setResults(r);
    setStep("preview");
    setProgress(`${r.filter(x => x.photoUrl).length} fotos encontradas de ${r.length} platos`);
  };

  const applyPhotos = async () => {
    const selected = results.filter(r => r.selected && r.photoUrl);
    if (!selected.length) return;
    setStep("applying");
    const rid = dishes[0]?.id ? await fetch(`/api/agregarlocal/test-dishes?slug=${restaurantId.trim() || "calendula"}`).then(r => r.json()).then(d => d.restaurantId) : "";
    setProgress(`Aplicando ${selected.length} fotos...`);
    try {
      await fetch("/api/agregarlocal/photos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: rid, photosByName: selected.map(r => ({ name: r.name, url: r.photoUrl })) }),
      });
      setProgress(`${selected.length} fotos aplicadas`);
      setStep("load");
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0e0e0e", color: "white", padding: "40px 20px", fontFamily: "sans-serif", maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ color: "#F4A623", marginBottom: 20 }}>Test Fotos Unsplash</h1>

      <div style={{ marginBottom: 20 }}>
        <input value={restaurantId} onChange={e => setRestaurantId(e.target.value)} placeholder="slug del local (default: calendula)" style={{ padding: 12, borderRadius: 8, border: "1px solid #333", background: "#1a1a1a", color: "white", width: "100%", marginBottom: 8, boxSizing: "border-box" }} />
        <button onClick={loadDishes} style={{ padding: "12px 24px", background: "#F4A623", color: "#0e0e0e", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", marginRight: 8 }}>Cargar platos</button>
        <button onClick={searchPhotos} disabled={!dishes.length} style={{ padding: "12px 24px", background: dishes.length ? "#4ade80" : "#333", color: "#0e0e0e", border: "none", borderRadius: 8, fontWeight: 700, cursor: dishes.length ? "pointer" : "not-allowed" }}>Buscar fotos</button>
      </div>

      {progress && <p style={{ color: "#F4A623", marginBottom: 10 }}>{progress}</p>}
      {error && <p style={{ color: "#ef4444", marginBottom: 10 }}>{error}</p>}

      {dishes.length > 0 && step === "load" && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: "#888", marginBottom: 8 }}>{dishes.length} platos · {dishes.filter(d => d.photos?.length).length} con foto · {dishes.filter(d => !d.photos?.length).length} sin foto</p>
          {dishes.slice(0, 10).map(d => (
            <div key={d.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", borderBottom: "1px solid #222" }}>
              {d.photos?.[0] ? <img src={d.photos[0]} style={{ width: 30, height: 30, borderRadius: 4, objectFit: "cover" }} /> : <div style={{ width: 30, height: 30, borderRadius: 4, background: "#222" }} />}
              <span style={{ fontSize: "0.85rem" }}>{d.name}</span>
            </div>
          ))}
          {dishes.length > 10 && <p style={{ color: "#666", fontSize: "0.8rem" }}>...y {dishes.length - 10} más</p>}
        </div>
      )}

      {step === "preview" && results.length > 0 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            {results.map((r, i) => (
              <div key={i} onClick={() => setResults(prev => prev.map((p, j) => j === i ? { ...p, selected: !p.selected } : p))}
                style={{ borderRadius: 8, overflow: "hidden", border: `2px solid ${r.selected ? "#F4A623" : "#222"}`, cursor: "pointer", opacity: r.selected ? 1 : 0.4 }}>
                {r.photoUrl ? <img src={r.photoUrl} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover" }} /> : <div style={{ width: "100%", aspectRatio: "4/3", background: "#222", display: "flex", alignItems: "center", justifyContent: "center", color: "#555" }}>Sin foto</div>}
                <p style={{ padding: "4px 8px", margin: 0, fontSize: "0.75rem", background: "#111" }}>{r.name}</p>
              </div>
            ))}
          </div>
          <button onClick={applyPhotos} style={{ padding: "14px 32px", background: "#F4A623", color: "#0e0e0e", border: "none", borderRadius: 50, fontWeight: 700, fontSize: "1rem", cursor: "pointer" }}>
            Aplicar {results.filter(r => r.selected && r.photoUrl).length} fotos
          </button>
        </>
      )}
    </div>
  );
}
