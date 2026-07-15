import { supabase } from "./supabase";

export type Card = {
  id: string;
  phrase_en: string;
  phrase_es: string;
  pronunciation_hint: string | null;
  notes: string | null;
  created_at: string;
};

export type Progress = {
  id: string;
  card_id: string;
  direction: "en_to_es" | "es_to_en";
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_at: string;
};

export type StudyItem = {
  card: Card;
  progress: Progress | null;
  direction: "en_to_es" | "es_to_en";
};

// SM-2: quality 0=fail, 1=difícil, 2=bien, 3=perfecto
export function sm2(
  quality: 0 | 1 | 2 | 3,
  ease: number,
  interval: number,
  reps: number
) {
  if (quality < 2) {
    return {
      ease_factor: Math.max(1.3, ease - 0.2),
      interval_days: 1,
      repetitions: 0,
    };
  }

  let newInterval: number;
  if (reps === 0) newInterval = 1;
  else if (reps === 1) newInterval = 3;
  else newInterval = Math.round(interval * ease);

  const newEase = Math.max(
    1.3,
    ease + 0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02)
  );

  return {
    ease_factor: newEase,
    interval_days: newInterval,
    repetitions: reps + 1,
  };
}

export async function getDueItems(newLimit = 20): Promise<StudyItem[]> {
  const [{ data: cards }, { data: allProgress }] = await Promise.all([
    supabase.from("english_cards").select("*").order("created_at"),
    supabase.from("english_progress").select("*"),
  ]);

  if (!cards?.length) return [];

  const now = new Date().toISOString();
  const progressMap = new Map<string, Progress>();
  for (const p of allProgress || []) {
    progressMap.set(`${p.card_id}__${p.direction}`, p);
  }

  const due: StudyItem[] = [];
  const newItems: StudyItem[] = [];

  for (const card of cards) {
    for (const dir of ["en_to_es", "es_to_en"] as const) {
      const progress = progressMap.get(`${card.id}__${dir}`) ?? null;
      if (!progress) {
        newItems.push({ card, progress: null, direction: dir });
      } else if (progress.next_review_at <= now) {
        due.push({ card, progress, direction: dir });
      }
    }
  }

  // Reviews first, then new cards (limited)
  const combined = [
    ...due.sort(() => Math.random() - 0.5),
    ...newItems.slice(0, newLimit).sort(() => Math.random() - 0.5),
  ];

  return combined;
}

export async function submitReview(
  cardId: string,
  direction: "en_to_es" | "es_to_en",
  quality: 0 | 1 | 2 | 3,
  currentProgress: Progress | null
) {
  const base = currentProgress ?? {
    ease_factor: 2.5,
    interval_days: 0,
    repetitions: 0,
  };

  const next = sm2(quality, base.ease_factor, base.interval_days, base.repetitions);
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + next.interval_days);
  const nextReviewAt = nextDate.toISOString();

  if (currentProgress?.id) {
    await supabase
      .from("english_progress")
      .update({ ...next, next_review_at: nextReviewAt })
      .eq("id", currentProgress.id);
  } else {
    await supabase.from("english_progress").insert({
      card_id: cardId,
      direction,
      ...next,
      next_review_at: nextReviewAt,
    });
  }

  await supabase.from("english_reviews").insert({
    card_id: cardId,
    direction,
    quality,
  });
}

export async function getStats() {
  const [{ data: cards }, { data: progress }, { data: reviews }] = await Promise.all([
    supabase.from("english_cards").select("id"),
    supabase.from("english_progress").select("interval_days, next_review_at"),
    supabase
      .from("english_reviews")
      .select("reviewed_at")
      .order("reviewed_at", { ascending: false })
      .limit(365),
  ]);

  const now = new Date().toISOString();
  const mature = progress?.filter((p) => p.interval_days >= 21).length ?? 0;
  const due = progress?.filter((p) => p.next_review_at <= now).length ?? 0;

  // Racha: días consecutivos con al menos una revisión
  let streak = 0;
  if (reviews?.length) {
    const days = new Set(reviews.map((r) => r.reviewed_at.slice(0, 10)));
    let d = new Date();
    // Si hoy no tiene reviews aún, empezar desde ayer para no romper racha
    if (!days.has(d.toISOString().slice(0, 10))) {
      d.setDate(d.getDate() - 1);
    }
    while (days.has(d.toISOString().slice(0, 10))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
  }

  return {
    totalCards: cards?.length ?? 0,
    mature,
    due,
    streak,
  };
}

export async function getAllCards(): Promise<(Card & { progress_en: Progress | null; progress_es: Progress | null })[]> {
  const [{ data: cards }, { data: progress }] = await Promise.all([
    supabase.from("english_cards").select("*").order("created_at"),
    supabase.from("english_progress").select("*"),
  ]);

  if (!cards) return [];

  const pm = new Map<string, Progress>();
  for (const p of progress || []) pm.set(`${p.card_id}__${p.direction}`, p);

  return cards.map((c) => ({
    ...c,
    progress_en: pm.get(`${c.id}__en_to_es`) ?? null,
    progress_es: pm.get(`${c.id}__es_to_en`) ?? null,
  }));
}

export async function saveCard(data: {
  id?: string;
  phrase_en: string;
  phrase_es: string;
  pronunciation_hint?: string;
  notes?: string;
}) {
  if (data.id) {
    return supabase.from("english_cards").update({
      phrase_en: data.phrase_en,
      phrase_es: data.phrase_es,
      pronunciation_hint: data.pronunciation_hint || null,
      notes: data.notes || null,
    }).eq("id", data.id);
  }
  return supabase.from("english_cards").insert({
    phrase_en: data.phrase_en,
    phrase_es: data.phrase_es,
    pronunciation_hint: data.pronunciation_hint || null,
    notes: data.notes || null,
  });
}

export async function deleteCard(id: string) {
  return supabase.from("english_cards").delete().eq("id", id);
}
