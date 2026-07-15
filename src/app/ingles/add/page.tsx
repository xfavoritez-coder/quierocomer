"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { saveCard } from "@/lib/english-srs";
import { supabase } from "@/lib/supabase";

function AddCardForm() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("edit");

  const [form, setForm] = useState({
    phrase_en: "",
    phrase_es: "",
    pronunciation_hint: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    if (!editId) return;
    supabase
      .from("english_cards")
      .select("*")
      .eq("id", editId)
      .single()
      .then(({ data }) => {
        if (data)
          setForm({
            phrase_en: data.phrase_en,
            phrase_es: data.phrase_es,
            pronunciation_hint: data.pronunciation_hint ?? "",
            notes: data.notes ?? "",
          });
      });
  }, [editId]);

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(addAnother = false) {
    if (!form.phrase_en.trim() || !form.phrase_es.trim()) return;
    setSaving(true);
    await saveCard({ id: editId ?? undefined, ...form });
    setSaving(false);
    if (addAnother) {
      setForm({ phrase_en: "", phrase_es: "", pronunciation_hint: "", notes: "" });
      setToast(true);
      setTimeout(() => setToast(false), 2000);
    } else {
      router.push("/ingles");
    }
  }

  const canSave = form.phrase_en.trim() && form.phrase_es.trim();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          background: "var(--en-green)", color: "#000",
          padding: "10px 20px", borderRadius: 99, fontWeight: 700, fontSize: 14,
          zIndex: 100, boxShadow: "0 4px 20px rgba(52,211,153,0.4)"
        }}>
          ✓ Guardada
        </div>
      )}

      <div style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => router.back()}
            style={{ background: "var(--en-surface-2)", border: "none", borderRadius: 10, padding: "8px 12px", color: "var(--en-text)", fontSize: 18, cursor: "pointer" }}
          >
            ←
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
            {editId ? "Editar tarjeta" : "Nueva tarjeta"}
          </h1>
        </div>

        {/* Card preview */}
        <div style={{
          borderRadius: 20, padding: "20px",
          background: "var(--en-surface)", border: "1px solid var(--en-border)",
          display: "flex", flexDirection: "column", gap: 6
        }}>
          <p style={{ fontSize: 11, color: "var(--en-text-3)", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>Preview</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: "var(--en-text)", margin: 0, minHeight: 28 }}>
            {form.phrase_en || <span style={{ color: "var(--en-text-3)" }}>Frase en inglés...</span>}
          </p>
          {form.pronunciation_hint && (
            <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--en-text-2)", background: "var(--en-surface-2)", padding: "3px 8px", borderRadius: 6, alignSelf: "flex-start" }}>
              {form.pronunciation_hint}
            </span>
          )}
          <p style={{ fontSize: 15, color: "var(--en-text-2)", margin: "4px 0 0", minHeight: 22 }}>
            {form.phrase_es || <span style={{ color: "var(--en-text-3)" }}>Significado en español...</span>}
          </p>
        </div>

        {/* Form fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field
            label="Frase en inglés *"
            placeholder="ej: Did the transfer go through?"
            value={form.phrase_en}
            onChange={(v) => set("phrase_en", v)}
            multiline
            autoFocus={!editId}
          />
          <Field
            label="Significado en español *"
            placeholder="ej: ¿Se procesó el pago?"
            value={form.phrase_es}
            onChange={(v) => set("phrase_es", v)}
            multiline
          />
          <Field
            label="Pronunciación (opcional)"
            placeholder="ej: pei-shens · throo · uh-PREE-shee-ate"
            value={form.pronunciation_hint}
            onChange={(v) => set("pronunciation_hint", v)}
          />
          <Field
            label="Contexto / notas (opcional)"
            placeholder="ej: go through = procesarse, concretarse (depende del contexto)"
            value={form.notes}
            onChange={(v) => set("notes", v)}
            multiline
          />
        </div>

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
              transition: "all 0.15s"
            }}
          >
            {saving ? "Guardando..." : editId ? "Guardar cambios" : "Guardar tarjeta"}
          </button>
          {!editId && (
            <button
              onClick={() => submit(true)}
              disabled={saving || !canSave}
              className="en-btn-secondary"
              style={{ opacity: canSave ? 1 : 0.4 }}
            >
              Guardar y agregar otra →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AddCardPage() {
  return (
    <Suspense>
      <AddCardForm />
    </Suspense>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  multiline,
  autoFocus,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: "var(--en-text-2)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {label}
      </label>
      {multiline ? (
        <textarea
          className="en-input"
          rows={2}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
        />
      ) : (
        <input
          className="en-input"
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          style={{ resize: "none" }}
        />
      )}
    </div>
  );
}
