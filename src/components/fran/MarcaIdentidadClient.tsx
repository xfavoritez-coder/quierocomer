"use client";
import { useState } from "react";
import { toast } from "sonner";

const GOLD = "#F4A623";
const F = "var(--font-display)";
const FB = "var(--font-body)";

type IdentidadData = {
  proposito: string | null;
  mision: string | null;
  vision: string | null;
  promesaMarca: string | null;
  clienteObjetivo: string | null;
  posicionamiento: string | null;
  personalidad: string | null;
  queSomos: string | null;
  queNoSomos: string | null;
  principiosProducto: string | null;
  principiosExperiencia: string | null;
  principiosServicio: string | null;
  elementosCore: string | null;
  elementosFlexibles: string | null;
  reglasNoNegociables: string | null;
  libertadesFranquiciado: string | null;
};

type Section = {
  key: string;
  label: string;
  fields: { key: keyof IdentidadData; label: string; hint: string }[];
};

const SECTIONS: Section[] = [
  {
    key: "proposito",
    label: "Propósito y dirección",
    fields: [
      { key: "proposito", label: "Propósito", hint: "¿Por qué existe esta marca? La razón de ser más allá del negocio." },
      { key: "mision", label: "Misión", hint: "Qué hacemos, para quién y cómo lo hacemos hoy." },
      { key: "vision", label: "Visión", hint: "Qué queremos ser o lograr a futuro." },
    ],
  },
  {
    key: "posicionamiento",
    label: "Posicionamiento",
    fields: [
      { key: "promesaMarca", label: "Promesa de marca", hint: "La promesa concreta que le hacemos a cada cliente en cada visita." },
      { key: "clienteObjetivo", label: "Cliente objetivo", hint: "A quién le hablamos: perfil, contexto, necesidades, momentos de consumo." },
      { key: "posicionamiento", label: "Posicionamiento", hint: "Cómo queremos ser percibidos versus la competencia." },
      { key: "personalidad", label: "Personalidad de marca", hint: "Si la marca fuera una persona, ¿cómo sería? Valores, tono, carácter." },
    ],
  },
  {
    key: "identidad",
    label: "Identidad",
    fields: [
      { key: "queSomos", label: "Qué somos", hint: "Los atributos que nos definen. Lo que siempre debe ser verdad sobre esta marca." },
      { key: "queNoSomos", label: "Qué no somos", hint: "Los límites claros. Lo que nunca debe asociarse con esta marca." },
    ],
  },
  {
    key: "principios",
    label: "Principios",
    fields: [
      { key: "principiosProducto", label: "Principios de producto", hint: "Qué define la calidad, la consistencia y la identidad de la carta." },
      { key: "principiosExperiencia", label: "Principios de experiencia", hint: "Cómo debe sentirse cada visita para el cliente." },
      { key: "principiosServicio", label: "Principios de servicio", hint: "Cómo se relaciona el equipo con el cliente y entre sí." },
    ],
  },
  {
    key: "sistema",
    label: "Sistema de franquicia",
    fields: [
      { key: "elementosCore", label: "Elementos core (no negociables)", hint: "Lo que todos los locales deben tener igual. Garantizan la identidad de marca." },
      { key: "elementosFlexibles", label: "Elementos flexibles", hint: "Lo que cada franquiciado puede adaptar a su contexto local." },
      { key: "reglasNoNegociables", label: "Reglas no negociables", hint: "Las líneas que ningún franquiciado puede cruzar bajo ninguna circunstancia." },
      { key: "libertadesFranquiciado", label: "Libertades del franquiciado", hint: "Decisiones que el franquiciado puede tomar de forma autónoma." },
    ],
  },
];

export default function MarcaIdentidadClient({
  marcaSlug,
  marcaNombre,
  identidadInicial,
}: {
  marcaSlug: string;
  marcaNombre: string;
  identidadInicial: IdentidadData | null;
}) {
  const empty: IdentidadData = {
    proposito: null, mision: null, vision: null,
    promesaMarca: null, clienteObjetivo: null, posicionamiento: null, personalidad: null,
    queSomos: null, queNoSomos: null,
    principiosProducto: null, principiosExperiencia: null, principiosServicio: null,
    elementosCore: null, elementosFlexibles: null, reglasNoNegociables: null, libertadesFranquiciado: null,
  };
  const [data, setData] = useState<IdentidadData>(identidadInicial ?? empty);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<IdentidadData>>({});
  const [saving, setSaving] = useState(false);

  const startEdit = (sectionKey: string) => {
    setEditingSection(sectionKey);
    setDraft({});
  };

  const save = async (sectionKey: string, fields: (keyof IdentidadData)[]) => {
    setSaving(true);
    const payload: Partial<IdentidadData> = {};
    for (const f of fields) {
      payload[f] = draft[f] !== undefined ? draft[f] : data[f];
    }
    try {
      const res = await fetch(`/api/fran/marca/${marcaSlug}/identidad`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      setData((d) => ({ ...d, ...payload }));
      setEditingSection(null);
      setDraft({});
      toast.success("Guardado");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = {
    padding: "8px 10px",
    borderRadius: 7,
    border: "1px solid var(--adm-input-border)",
    background: "var(--adm-input)",
    color: "var(--adm-text)",
    fontFamily: FB,
    fontSize: "0.82rem",
    resize: "vertical" as const,
    width: "100%",
    boxSizing: "border-box" as const,
  };

  return (
    <div style={{ marginTop: 48 }}>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{ flex: 1, height: 1, background: "var(--adm-card-border)" }} />
        <span style={{ fontFamily: F, fontSize: "0.72rem", fontWeight: 700, color: GOLD, letterSpacing: "0.08em" }}>
          ADN DE MARCA — {marcaNombre.toUpperCase()}
        </span>
        <div style={{ flex: 1, height: 1, background: "var(--adm-card-border)" }} />
      </div>
      <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text3)", marginBottom: 28, marginTop: -16 }}>
        Define la identidad, los valores y las reglas de la marca. Esta información orienta todas las decisiones
        de los franquiciados y garantiza la consistencia entre locales.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {SECTIONS.map((section) => {
          const isEditing = editingSection === section.key;
          const hasContent = section.fields.some((f) => data[f.key]);

          return (
            <div
              key={section.key}
              style={{
                background: "var(--adm-card)",
                border: "1px solid var(--adm-card-border)",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              {/* Section header */}
              <div
                style={{
                  padding: "14px 16px",
                  borderBottom: isEditing || hasContent ? "1px solid var(--adm-card-border)" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)" }}>
                    {section.label}
                  </span>
                  {!hasContent && !isEditing && (
                    <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}>
                      Sin completar
                    </span>
                  )}
                </div>
                {!isEditing && (
                  <button
                    onClick={() => startEdit(section.key)}
                    style={{
                      padding: "4px 12px",
                      background: "var(--adm-card-border)",
                      color: "var(--adm-text2)",
                      border: "none",
                      borderRadius: 7,
                      fontFamily: F,
                      fontSize: "0.75rem",
                      cursor: "pointer",
                    }}
                  >
                    {hasContent ? "Editar" : "Completar"}
                  </button>
                )}
              </div>

              {/* Content */}
              {isEditing ? (
                <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>
                  {section.fields.map((f) => (
                    <div key={f.key}>
                      <label style={{ fontFamily: F, fontSize: "0.72rem", fontWeight: 700, color: "var(--adm-text2)", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>
                        {f.label.toUpperCase()}
                      </label>
                      <textarea
                        rows={3}
                        value={(draft[f.key] !== undefined ? draft[f.key] : data[f.key]) ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                        placeholder={f.hint}
                        style={fieldStyle}
                      />
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <button
                      onClick={() => save(section.key, section.fields.map((f) => f.key))}
                      disabled={saving}
                      style={{
                        padding: "7px 18px",
                        background: GOLD,
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        fontFamily: F,
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        cursor: saving ? "wait" : "pointer",
                        opacity: saving ? 0.7 : 1,
                      }}
                    >
                      {saving ? "Guardando..." : "Guardar"}
                    </button>
                    <button
                      onClick={() => { setEditingSection(null); setDraft({}); }}
                      style={{
                        padding: "7px 14px",
                        background: "var(--adm-card-border)",
                        color: "var(--adm-text2)",
                        border: "none",
                        borderRadius: 8,
                        fontFamily: F,
                        fontSize: "0.8rem",
                        cursor: "pointer",
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : hasContent ? (
                <div style={{ padding: "12px 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                  {section.fields.map((f) =>
                    data[f.key] ? (
                      <div key={f.key}>
                        <div style={{ fontFamily: F, fontSize: "0.68rem", fontWeight: 700, color: "var(--adm-text3)", letterSpacing: "0.06em", marginBottom: 3 }}>
                          {f.label.toUpperCase()}
                        </div>
                        <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)", margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                          {data[f.key]}
                        </p>
                      </div>
                    ) : null
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
