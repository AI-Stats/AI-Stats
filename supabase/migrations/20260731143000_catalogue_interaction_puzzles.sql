-- Freeze each daily catalogue interaction so imports cannot change a puzzle
-- after people have started playing it. Answers are service-role only.
create table if not exists public.catalogue_interaction_puzzles (
  puzzle_id uuid primary key default gen_random_uuid(),
  game_key text not null check (game_key in ('modele', 'timeline', 'pricele', 'head-to-head', 'sprint')),
  puzzle_date date not null,
  public_payload jsonb not null,
  answer_payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (game_key, puzzle_date)
);

create index if not exists catalogue_interaction_puzzles_date_idx
  on public.catalogue_interaction_puzzles (puzzle_date desc, game_key);

alter table public.catalogue_interaction_puzzles enable row level security;

revoke all on table public.catalogue_interaction_puzzles from anon, authenticated;
grant select, insert, update on table public.catalogue_interaction_puzzles to service_role;

comment on table public.catalogue_interaction_puzzles is
  'Server-only frozen payloads for date-based catalogue interactions.';
