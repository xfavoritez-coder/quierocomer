"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { saveCard } from "@/lib/english-srs";
import { supabase } from "@/lib/supabase";

function highlightPhrase(text: string, phrase: string): React.ReactNode {
  if (!phrase || !text || text === phrase) return text;
  const idx = text.toLowerCase().indexOf(phrase.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: "rgba(99,102,241,0.28)", borderRadius: 4, padding: "0 3px", color: "inherit" }}>
        {text.slice(idx, idx + phrase.length)}
      </mark>
      {text.slice(idx + phrase.length)}
    </>
  );
}

function AddCardForm() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("edit");

  const [form, setForm] = useState({
    phrase_en: "",
    phrase_es: "",
    pronunciation_hint: "",
    notes: "",
    example_en: "",
    example_es: "",
  });
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!editId) return;
    supabase.from("english_cards").select("*").eq("id", editId).single().then(({ data }) => {
      if (data) setForm({
        phrase_en: data.phrase_en ?? "",
        phrase_es: data.phrase_es ?? "",
        pronunciation_hint: data.pronunciation_hint ?? "",
        notes: data.notes ?? "",
        example_en: data.example_en ?? "",
        example_es: data.example_es ?? "",
      });
    });
  }, [editId]);

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function generateExample() {
    if (!form.phrase_en.trim() || !form.phrase_es.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/ingles/generate-example", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase_en: form.phrase_en, phrase_es: form.phrase_es }),
      });
      const data = await res.json();
      if (data.example_en && data.example_es) {
        setForm(f => ({ ...f, example_en: data.example_en, example_es: data.example_es }));
        setShowPreview(true);
      }
    } catch {
      // silent fail
    } finally {
      setGenerating(false);
    }
  }

  async function submit(addAnother = false) {
    if (!form.phrase_en.trim() || !form.phrase_es.trim()) return;
    setSaving(true);

    // Auto-generate example if missing
    if (!form.example_en.trim() && form.phrase_en.trim() && form.phrase_es.trim()) {
      try {
        const res = await fetch("/api/ingles/generate-example", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phrase_en: form.phrase_en, phrase_es: form.phrase_es }),
        });
        const data = await res.json();
        if (data.example_en) {
          form.example_en = data.example_en;
          form.example_es = data.example_es;
        }
      } catch { /* save without example */ }
    }

    await saveCard({ id: editId ?? undefined, ...form });
    setSaving(false);

    if (addAnother) {
      setForm({ phrase_en: "", phrase_es: "", pronunciation_hint: "", notes: "", example_en: "", example_es: "" });
      setShowPreview(false);
      setToast("✓ Guardada");
      setTimeout(() => setToast(""), 2000);
    } else {
      router.push("/ingles/cards");
    }
  }

  const canSave = form.phrase_en.trim() && form.phrase_es.trim();
  const frontText = form.example_en || form.phrase_en;
  const backText = form.example_es || form.phrase_es;

  return (
    <div style={{ minHeight: "100vh", padding: "24px 16px" }}>

      {toast && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          background: "var(--en-green)", color: "#000",
          padding: "10px 20px", borderRadius: 99, fontWeight: 700, fontSize: 14,
          zIndex: 100, boxShadow: "0 4px 20px rgba(52,211,153,0.4)"
        }}>
          {toast}
        </div>
      )}

      <div style={{ width: "100%", maxWidth: 440, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 8 }}>
          <button onClick={() => router.back()} style={{ background: "var(--en-surface-2)", border: "none", borderRadius: 10, padding: "8px 12px", color: "var(--en-text)", fontSize: 18, cursor: "pointer" }}>
            ←
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
            {editId ? "Editar tarjeta" : "Nueva tarjeta"}
          </h1>
        </div>

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Expresión en inglés *" placeholder="ej: give up" value={form.phrase_en} onChange={(v) => set("phrase_en", v)} autoFocus={!editId} />
          <Field label="Significado en español *" placeholder="ej: rendirse / darse por vencido" value={form.phrase_es} onChange={(v) => set("phrase_es", v)} />
          <Field label="Pronunciación (opcional)" placeholder="ej: throo · EI-sap · uh-FORD" value={form.pronunciation_hint} onChange={(v) => set("pronunciation_hint", v)} />

          {/* Example section */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--en-text-2)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Frase de contexto
              </label>
              <button
                onClick={generateExample}
                disabled={generating || !canSave}
                style={{
                  background: canSave ? "rgba(99,102,241,0.15)" : "var(--en-surface-2)",
                  border: "1px solid rgba(99,102,241,0.3)",
                  borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 700,
                  color: canSave ? "var(--en-accent)" : "var(--en-text-3)",
                  cursor: canSave ? "pointer" : "default"
                }}
              >
                {generating ? "Generando..." : "✨ Auto-generar"}
              </button>
            </div>
            <textarea
              className="en-input"
              rows={2}
              placeholder="ej: Don't give up — you're almost there"
              value={form.example_en}
              onChange={(e) => { set("example_en", e.target.value); setShowPreview(!!e.target.value); }}
            />
            <textarea
              className="en-input"
              rows={2}
              placeholder="ej: No te rindas, ya casi llegas"
              value={form.example_es}
              onChange={(e) => set("example_es", e.target.value)}
            />
          </div>
        </div>

        {/* Preview — shows how card will look in session */}
        {showPreview && frontText && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--en-text-3)", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>
              Preview — así se verá en el repaso
            </p>

            {/* Front card */}
            <div style={{
              borderRadius: 20, padding: "24px 20px",
              background: "var(--en-surface)", border: "2px solid var(--en-accent)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center"
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.5px", color: "var(--en-text-3)", textTransform: "uppercase" }}>English</span>
              <p style={{ fontSize: frontText.length > 45 ? 17 : 20, fontWeight: 700, color: "var(--en-text)", margin: 0, lineHeight: 1.5 }}>
                {form.example_en ? highlightPhrase(frontText, form.phrase_en) : frontText}
              </p>
              <span style={{ fontSize: 12, background: "var(--en-surface-2)", padding: "5px 12px", borderRadius: 8, color: "var(--en-text-2)" }}>🔊 Escuchar</span>
            </div>

            {/* Back card */}
            <div style={{
              borderRadius: 16, padding: "16px 20px",
              background: "var(--en-surface-2)", border: "1px solid var(--en-border)",
              textAlign: "center"
            }}>
              <p style={{ fontSize: 11, color: "var(--en-text-3)", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "1px" }}>En español</p>
              <p style={{ fontSize: backText.length > 45 ? 15 : 18, fontWeight: 700, color: "var(--en-text)", margin: 0, lineHeight: 1.5 }}>
                {backText}
              </p>
              {form.pronunciation_hint && (
                <span style={{ display: "inline-block", marginTop: 8, fontSize: 12, fontFamily: "monospace", color: "var(--en-text-2)", background: "var(--en-surface)", padding: "4px 10px", borderRadius: 8 }}>
                  {form.pronunciation_hint}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={() => submit(false)}
            disabled={saving || !canSave}
            style={{
              padding: "15px", borderRadius: 14, fontWeight: 700, fontSize: 15,
              background: canSave ? "linear-gradient(135deg, var(--en-accent), #8b5cf6)" : "var(--en-surface-2)",
              color: canSave ? "#fff" : "var(--en-text-3)",
              border: "none", cursor: canSave ? "pointer" : "default",
            }}
          >
            {saving ? "Guardando..." : editId ? "Guardar cambios" : "Guardar tarjeta"}
          </button>
          {!editId && (
            <button onClick={() => submit(true)} disabled={saving || !canSave} className="en-btn-secondary" style={{ opacity: canSave ? 1 : 0.4 }}>
              Guardar y agregar otra →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AddCardPage() {
  return <Suspense><AddCardForm /></Suspense>;
}

function Field({ label, placeholder, value, onChange, autoFocus }: {
  label: string; placeholder: string; value: string;
  onChange: (v: string) => void; autoFocus?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: "var(--en-text-2)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</label>
      <input className="en-input" type="text" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} />
    </div>
  );
}
