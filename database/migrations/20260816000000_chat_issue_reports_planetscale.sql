create table if not exists public.chat_issue_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  issue_fingerprint text not null,
  model_id text,
  request_id text,
  created_at timestamptz not null default now()
);

create index if not exists chat_issue_reports_user_created_at_idx
  on public.chat_issue_reports (user_id, created_at desc);

drop function if exists public.reserve_chat_issue_report(text, text, text);
alter table public.chat_issue_reports disable row level security;
