import { supabase } from "./supabase";

export type Card = {
  id: string;
  phrase_en: string;
  phrase_es: string;
  pronunciation_hint: string | null;
  example_es: string | null;
  example_en: string | null;
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

/**
 * SM-2 simplificado — 3 niveles:
 *   0 = No lo sabía  → re-queue en sesión + vuelve mañana, ease baja
 *   1 = Más o menos  → NO re-queue, vuelve mañana, ease baja un poco
 *   2 = Lo tengo     → avance normal (1d → 3d → xEase...)
 */
export function sm2(
  quality: 0 | 1 | 2,
  ease: number,
  interval: number,
  reps: number
) {
  if (quality === 0) {
    return {
      ease_factor: Math.max(1.3, ease - 0.2),
      interval_days: 1,
      repetitions: 0,
    };
  }
  if (quality === 1) {
    return {
      ease_factor: Math.max(1.3, ease - 0.1),
      interval_days: 1,
      repetitions: reps, // no avanza
    };
  }
  // quality === 2: bueno
  let newInterval: number;
  if (reps === 0) newInterval = 1;
  else if (reps === 1) newInterval = 3;
  else newInterval = Math.round(interval * ease);

  return {
    ease_factor: Math.min(2.5, ease + 0.1),
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
  quality: 0 | 1 | 2,
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
  const dueReviews = progress?.filter((p) => p.next_review_at <= now).length ?? 0;
  // Tarjetas nuevas (sin ningún progress record) también cuentan como "para hoy"
  const reviewedPairs = progress?.length ?? 0;
  const totalPairs = (cards?.length ?? 0) * 2;
  const newCards = Math.min(Math.max(0, totalPairs - reviewedPairs), 40); // límite 20 cards × 2 dir
  const due = dueReviews + newCards;

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

  // Pronunciación stats
  const [{ data: pronProgress }, { data: pronReviews }] = await Promise.all([
    supabase.from("english_pronunciation_progress").select("next_review_at, interval_days"),
    supabase.from("english_pronunciation_reviews").select("reviewed_at").order("reviewed_at", { ascending: false }).limit(365),
  ]);

  const duePron = (pronProgress?.filter((p) => p.next_review_at <= now).length ?? 0)
    + Math.min(Math.max(0, (cards?.length ?? 0) * 2 - (pronProgress?.length ?? 0)), 40);

  let streakPron = 0;
  if (pronReviews?.length) {
    const pronDays = new Set(pronReviews.map((r) => r.reviewed_at.slice(0, 10)));
    let d2 = new Date();
    if (!pronDays.has(d2.toISOString().slice(0, 10))) d2.setDate(d2.getDate() - 1);
    while (pronDays.has(d2.toISOString().slice(0, 10))) { streakPron++; d2.setDate(d2.getDate() - 1); }
  }

  // Contexto stats
  const [{ data: ctxProgress }, { data: ctxReviews }] = await Promise.all([
    supabase.from("english_context_progress").select("next_review_at, interval_days"),
    supabase.from("english_context_reviews").select("reviewed_at").order("reviewed_at", { ascending: false }).limit(365),
  ]);

  const dueCtx = (ctxProgress?.filter((p) => p.next_review_at <= now).length ?? 0)
    + Math.min(Math.max(0, (cards?.length ?? 0) - (ctxProgress?.length ?? 0)), 20);

  let streakCtx = 0;
  if (ctxReviews?.length) {
    const ctxDays = new Set(ctxReviews.map((r) => r.reviewed_at.slice(0, 10)));
    let d4 = new Date();
    if (!ctxDays.has(d4.toISOString().slice(0, 10))) d4.setDate(d4.getDate() - 1);
    while (ctxDays.has(d4.toISOString().slice(0, 10))) { streakCtx++; d4.setDate(d4.getDate() - 1); }
  }

  // Racha combinada: días consecutivos donde se hicieron LAS TRES sesiones
  let streakCombined = 0;
  const mDays = new Set((reviews || []).map((r) => r.reviewed_at.slice(0, 10)));
  const pDays = new Set((pronReviews || []).map((r) => r.reviewed_at.slice(0, 10)));
  const cDays = new Set((ctxReviews || []).map((r) => r.reviewed_at.slice(0, 10)));
  if (mDays.size && pDays.size && cDays.size) {
    const today = new Date().toISOString().slice(0, 10);
    let d3 = new Date();
    if (!mDays.has(today) || !pDays.has(today) || !cDays.has(today)) d3.setDate(d3.getDate() - 1);
    while (mDays.has(d3.toISOString().slice(0, 10)) && pDays.has(d3.toISOString().slice(0, 10)) && cDays.has(d3.toISOString().slice(0, 10))) {
      streakCombined++;
      d3.setDate(d3.getDate() - 1);
    }
  }

  // ¿Se completaron las tres hoy?
  const todayStr = new Date().toISOString().slice(0, 10);
  const doneMeaningToday = reviews?.some((r) => r.reviewed_at.slice(0, 10) === todayStr) ?? false;
  const donePronToday = pronReviews?.some((r) => r.reviewed_at.slice(0, 10) === todayStr) ?? false;
  const doneCtxToday = ctxReviews?.some((r) => r.reviewed_at.slice(0, 10) === todayStr) ?? false;

  return {
    totalCards: cards?.length ?? 0,
    mature,
    due,
    streak,
    duePron,
    streakPron,
    dueCtx,
    streakCtx,
    streakCombined,
    doneMeaningToday,
    donePronToday,
    doneCtxToday,
  };
}

// ── PRONUNCIACIÓN ──────────────────────────────────────────

export type PronunciationProgress = {
  id: string;
  card_id: string;
  type: "listen" | "speak";
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_at: string;
};

export type PronunciationItem = {
  card: Card;
  progress: PronunciationProgress | null;
  type: "listen" | "speak";
};

export async function getDuePronunciationItems(newLimit = 20): Promise<PronunciationItem[]> {
  const [{ data: cards }, { data: allProgress }] = await Promise.all([
    supabase.from("english_cards").select("*").order("created_at"),
    supabase.from("english_pronunciation_progress").select("*"),
  ]);

  if (!cards?.length) return [];

  const now = new Date().toISOString();
  const pm = new Map<string, PronunciationProgress>();
  for (const p of allProgress || []) pm.set(`${p.card_id}__${p.type}`, p);

  const due: PronunciationItem[] = [];
  const newItems: PronunciationItem[] = [];

  for (const card of cards) {
    for (const type of ["listen", "speak"] as const) {
      const progress = pm.get(`${card.id}__${type}`) ?? null;
      if (!progress) newItems.push({ card, progress: null, type });
      else if (progress.next_review_at <= now) due.push({ card, progress, type });
    }
  }

  return [
    ...due.sort(() => Math.random() - 0.5),
    ...newItems.slice(0, newLimit).sort(() => Math.random() - 0.5),
  ];
}

export async function submitPronunciationReview(
  cardId: string,
  type: "listen" | "speak",
  quality: 0 | 1 | 2,
  currentProgress: PronunciationProgress | null
) {
  const base = currentProgress ?? { ease_factor: 2.5, interval_days: 0, repetitions: 0 };
  const next = sm2(quality, base.ease_factor, base.interval_days, base.repetitions);
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + next.interval_days);

  if (currentProgress?.id) {
    await supabase.from("english_pronunciation_progress")
      .update({ ...next, next_review_at: nextDate.toISOString() })
      .eq("id", currentProgress.id);
  } else {
    await supabase.from("english_pronunciation_progress").insert({
      card_id: cardId, type, ...next, next_review_at: nextDate.toISOString(),
    });
  }

  await supabase.from("english_pronunciation_reviews").insert({
    card_id: cardId, type, quality,
  });
}

// ── CONTEXTO ──────────────────────────────────────────

export type ContextProgress = {
  id: string;
  card_id: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_at: string;
};

export type ContextItem = {
  card: Card;
  progress: ContextProgress | null;
};

export async function getDueContextItems(newLimit = 20): Promise<ContextItem[]> {
  const [{ data: cards }, { data: allProgress }] = await Promise.all([
    supabase.from("english_cards").select("*").not("example_es", "is", null).order("created_at"),
    supabase.from("english_context_progress").select("*"),
  ]);

  if (!cards?.length) return [];

  const now = new Date().toISOString();
  const pm = new Map<string, ContextProgress>();
  for (const p of allProgress || []) pm.set(p.card_id, p);

  const due: ContextItem[] = [];
  const newItems: ContextItem[] = [];

  for (const card of cards) {
    const progress = pm.get(card.id) ?? null;
    if (!progress) newItems.push({ card, progress: null });
    else if (progress.next_review_at <= now) due.push({ card, progress });
  }

  return [
    ...due.sort(() => Math.random() - 0.5),
    ...newItems.slice(0, newLimit).sort(() => Math.random() - 0.5),
  ];
}

export async function submitContextReview(
  cardId: string,
  quality: 0 | 1 | 2,
  currentProgress: ContextProgress | null
) {
  const base = currentProgress ?? { ease_factor: 2.5, interval_days: 0, repetitions: 0 };
  const next = sm2(quality, base.ease_factor, base.interval_days, base.repetitions);
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + next.interval_days);

  if (currentProgress?.id) {
    await supabase.from("english_context_progress")
      .update({ ...next, next_review_at: nextDate.toISOString() })
      .eq("id", currentProgress.id);
  } else {
    await supabase.from("english_context_progress").insert({
      card_id: cardId, ...next, next_review_at: nextDate.toISOString(),
    });
  }

  await supabase.from("english_context_reviews").insert({ card_id: cardId, quality });
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
