-- Ejecutar en Supabase Dashboard → SQL Editor

create table if not exists english_pronunciation_progress (
  id uuid default gen_random_uuid() primary key,
  card_id uuid references english_cards(id) on delete cascade,
  type text not null check (type in ('listen', 'speak')),
  ease_factor float not null default 2.5,
  interval_days int not null default 0,
  repetitions int not null default 0,
  next_review_at timestamptz not null default now(),
  unique(card_id, type)
);

create table if not exists english_pronunciation_reviews (
  id uuid default gen_random_uuid() primary key,
  card_id uuid references english_cards(id) on delete cascade,
  type text not null,
  quality int not null check (quality between 0 and 2),
  reviewed_at timestamptz default now()
);
