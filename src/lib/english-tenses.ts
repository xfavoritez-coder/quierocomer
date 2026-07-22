import { supabase } from "./supabase";

export type TenseLevel = {
  id: string;
  name_es: string;
  order_num: number;
  unlock_threshold: number;
  progress: {
    total_correct: number;
    total_attempts: number;
    is_unlocked: boolean;
    mastered_at: string | null;
  } | null;
};

export type TenseSentence = {
  id: string;
  level_id: string;
  sentence_es: string;
  sentence_en: string;
  order_num: number;
};

export async function getTenseLevels(): Promise<TenseLevel[]> {
  const [{ data: levels }, { data: progress }] = await Promise.all([
    supabase.from("english_tense_levels").select("*").order("order_num"),
    supabase.from("english_tense_progress").select("*"),
  ]);

  const progressMap = new Map((progress ?? []).map((p: any) => [p.level_id, p]));

  return (levels ?? []).map((l: any) => ({
    ...l,
    progress: progressMap.get(l.id) ?? null,
  }));
}

export async function getTenseSentences(levelId: string): Promise<TenseSentence[]> {
  const { data } = await supabase
    .from("english_tense_sentences")
    .select("*")
    .eq("level_id", levelId)
    .order("order_num");
  return data ?? [];
}

export async function markCorrect(levelId: string, nextLevelId: string | null): Promise<void> {
  // Upsert progress: increment correct + attempts
  const { data: existing } = await supabase
    .from("english_tense_progress")
    .select("total_correct, total_attempts, is_unlocked")
    .eq("level_id", levelId)
    .single();

  const current = existing ?? { total_correct: 0, total_attempts: 0, is_unlocked: false };
  await supabase.from("english_tense_progress").upsert({
    level_id: levelId,
    total_correct: current.total_correct + 1,
    total_attempts: current.total_attempts + 1,
    is_unlocked: current.is_unlocked,
  }, { onConflict: "level_id" });
}

export async function markWrong(levelId: string): Promise<void> {
  const { data: existing } = await supabase
    .from("english_tense_progress")
    .select("total_correct, total_attempts, is_unlocked")
    .eq("level_id", levelId)
    .single();

  const current = existing ?? { total_correct: 0, total_attempts: 0, is_unlocked: false };
  await supabase.from("english_tense_progress").upsert({
    level_id: levelId,
    total_correct: current.total_correct,
    total_attempts: current.total_attempts + 1,
    is_unlocked: current.is_unlocked,
  }, { onConflict: "level_id" });
}

export async function unlockNextLevel(nextLevelId: string): Promise<void> {
  await supabase.from("english_tense_progress").upsert({
    level_id: nextLevelId,
    total_correct: 0,
    total_attempts: 0,
    is_unlocked: true,
    mastered_at: null,
  }, { onConflict: "level_id" });
}

export async function setMastered(levelId: string): Promise<void> {
  await supabase.from("english_tense_progress")
    .update({ mastered_at: new Date().toISOString() })
    .eq("level_id", levelId);
}
