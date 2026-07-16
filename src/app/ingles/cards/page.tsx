"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAllCards, deleteCard } from "@/lib/english-srs";

type CardRow = Awaited<ReturnType<typeof getAllCards>>[number];

export default function CardsPage() {
  const router = useRouter();
  const [cards, setCards] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const data = await getAllCards();
    setCards(data);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta tarjeta?")) return;
    setDeleting(id);
    await deleteCard(id);
    setCards((cs) => cs.filter((c) => c.id !== id));
    setDeleting(null);
  }

  const filtered = cards.filter(
    (c) =>
      c.phrase_en.toLowerCase().includes(search.toLowerCase()) ||
      c.phrase_es.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight: "100vh", padding: "16px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 8 }}>
          <button
            onClick={() => router.push("/ingles")}
            style={{ background: "var(--en-surface-2)", border: "none", borderRadius: 10, padding: "8px 12px", color: "var(--en-text)", fontSize: 18, cursor: "pointer" }}
          >
            ←
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, flex: 1 }}>
            Mis tarjetas {cards.length > 0 && <span style={{ color: "var(--en-text-3)", fontSize: 16, fontWeight: 500 }}>({cards.length})</span>}
          </h1>
          <Link
            href="/ingles/add"
            style={{
              textDecoration: "none",
              background: "linear-gradient(135deg, var(--en-accent), #8b5cf6)",
              color: "#fff", borderRadius: 12, padding: "9px 16px",
              fontWeight: 700, fontSize: 14
            }}
          >
            + Nueva
          </Link>
        </div>

        {/* Search */}
        <input
          className="en-input"
          type="text"
          placeholder="Buscar frase o significado..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* List */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--en-text-3)" }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--en-text-3)" }}>
            {search ? "Sin resultados" : "No hay tarjetas aún"}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((card) => (
              <CardItem
                key={card.id}
                card={card}
                onEdit={() => router.push(`/ingles/add?edit=${card.id}`)}
                onDelete={() => handleDelete(card.id)}
                deleting={deleting === card.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function progressStatus(p: { interval_days: number; repetitions: number } | null) {
  if (!p) return { label: "nueva", color: "var(--en-text-3)" };
  if (p.interval_days >= 21) return { label: "dominada", color: "var(--en-green)" };
  if (p.repetitions === 0) return { label: "aprendiendo", color: "var(--en-orange)" };
  return { label: `${p.interval_days}d`, color: "var(--en-text-2)" };
}

function CardItem({
  card,
  onEdit,
  onDelete,
  deleting,
}: {
  card: CardRow;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const en = progressStatus(card.progress_en);
  const es = progressStatus(card.progress_es);

  return (
    <div style={{
      borderRadius: 18, padding: "16px",
      background: "var(--en-surface)", border: "1px solid var(--en-border)",
      display: "flex", flexDirection: "column", gap: 10
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Key expression */}
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--en-accent)", margin: "0 0 3px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {card.phrase_en}
          </p>
          {/* Example sentence (or fallback to phrase) */}
          <p style={{ fontWeight: 600, fontSize: 14, margin: 0, lineHeight: 1.4, color: "var(--en-text)" }}>
            {card.example_en || card.phrase_en}
          </p>
          <p style={{ fontSize: 13, color: "var(--en-text-3)", margin: "3px 0 0", lineHeight: 1.4 }}>
            {card.example_es || card.phrase_es}
          </p>
          {card.pronunciation_hint && (
            <p style={{ fontSize: 11, fontFamily: "monospace", color: "var(--en-text-3)", margin: "4px 0 0" }}>
              {card.pronunciation_hint}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button
            onClick={onEdit}
            style={{
              width: 34, height: 34, borderRadius: 9, border: "none",
              background: "var(--en-surface-2)", fontSize: 15, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}
          >
            ✏️
          </button>
          <button
            onClick={onDelete}
            disabled={deleting}
            style={{
              width: 34, height: 34, borderRadius: 9, border: "none",
              background: "var(--en-surface-2)", fontSize: 15, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: deleting ? 0.3 : 1
            }}
          >
            🗑
          </button>
        </div>
      </div>

      {/* Progress chips */}
      <div style={{ display: "flex", gap: 6 }}>
        <Chip label="EN→ES" status={en} />
        <Chip label="ES→EN" status={es} />
      </div>
    </div>
  );
}

function Chip({ label, status }: { label: string; status: { label: string; color: string } }) {
  return (
    <span style={{
      fontSize: 11, padding: "3px 8px", borderRadius: 99,
      background: "var(--en-surface-2)", color: "var(--en-text-3)",
      display: "flex", alignItems: "center", gap: 4
    }}>
      {label}:&nbsp;<span style={{ color: status.color, fontWeight: 700 }}>{status.label}</span>
    </span>
  );
}
