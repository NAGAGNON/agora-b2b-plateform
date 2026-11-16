-- Comité de direction : réunion du matin, du soir et réunions exceptionnelles (alertes), interventions
-- intégrales, décisions et leur cycle de vie.
-- Lecture réservée aux administrateurs ; écriture uniquement par le serveur (clé de service).
create table if not exists public.board_sessions (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  kind text not null check (kind in ('MATIN', 'SOIR', 'EXCEPTIONNELLE')),
  alert_key text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'RUNNING' check (status in ('RUNNING', 'DONE', 'FAILED')),
  title text,
  ceo_message text,
  error text,
  emailed_at timestamptz
);
create unique index if not exists board_sessions_daily on public.board_sessions (day, kind) where kind in ('MATIN', 'SOIR');
create unique index if not exists board_sessions_alert on public.board_sessions (day, alert_key) where alert_key is not null;
create index if not exists board_sessions_started on public.board_sessions (started_at desc);

create table if not exists public.board_decisions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.board_sessions (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  proposer text not null,
  problem text not null,
  decision text not null,
  justification text not null,
  data_used text,
  expected text,
  budget_eur numeric,
  risks text,
  urgency text not null default 'moyenne' check (urgency in ('basse', 'moyenne', 'haute')),
  metric text,
  target text,
  check_after_days int,
  critic text,
  critic_opinion text,
  critique text,
  ceo_verdict text,
  ceo_reason text,
  status text not null default 'PROPOSEE' check (status in ('PROPOSEE', 'A_VALIDER', 'REFUSEE_CEO', 'PLUS_INFO', 'VALIDEE', 'REFUSEE', 'EN_COURS', 'VERIFIEE', 'ECHOUEE', 'ABANDONNEE')),
  founder_comment text,
  founder_decided_at timestamptz,
  founder_id uuid references public.users (id) on delete set null
);
create index if not exists board_decisions_status on public.board_decisions (status, created_at desc);

create table if not exists public.board_messages (
  id bigint generated always as identity primary key,
  session_id uuid references public.board_sessions (id) on delete cascade,
  decision_id uuid references public.board_decisions (id) on delete cascade,
  created_at timestamptz not null default now(),
  author text not null,
  kind text not null check (kind in ('NOTE', 'CRITIQUE', 'ARBITRAGE', 'FONDATEUR', 'SYSTEME')),
  content jsonb not null
);
create index if not exists board_messages_created on public.board_messages (created_at desc);

alter table public.board_sessions enable row level security;
alter table public.board_decisions enable row level security;
alter table public.board_messages enable row level security;
drop policy if exists board_sessions_admin on public.board_sessions;
create policy board_sessions_admin on public.board_sessions for select to authenticated using (public.is_admin());
drop policy if exists board_decisions_admin on public.board_decisions;
create policy board_decisions_admin on public.board_decisions for select to authenticated using (public.is_admin());
drop policy if exists board_messages_admin on public.board_messages;
create policy board_messages_admin on public.board_messages for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.board_sessions, public.board_decisions, public.board_messages from anon, authenticated;
