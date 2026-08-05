create table if not exists public.catalogue_game_results (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_key text not null check (game_key in ('modele', 'timeline', 'pricele', 'head-to-head', 'sprint')),
  puzzle_id uuid not null references public.catalogue_interaction_puzzles(puzzle_id) on delete cascade,
  puzzle_date date not null,
  won boolean not null,
  score integer not null check (score >= 0),
  max_score integer not null check (max_score > 0 and score <= max_score),
  attempts integer check (attempts is null or attempts >= 0),
  completed_at timestamptz not null default now(),
  primary key (user_id, game_key, puzzle_date)
);

create index if not exists catalogue_game_results_user_date_idx
  on public.catalogue_game_results (user_id, puzzle_date desc);

alter table public.catalogue_game_results enable row level security;

revoke all on table public.catalogue_game_results from anon, authenticated;
grant select, insert, update on table public.catalogue_game_results to service_role;

comment on table public.catalogue_game_results is
  'Server-verified daily catalogue game results for signed-in profiles.';
