-- Relance des membres inactifs depuis l'administration (page « Clients potentiels ») : e-mail
-- personnel envoyé par un administrateur, au plus une fois tous les 14 jours par membre.
create table if not exists public.reengagement_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  sent_at timestamptz not null default now(),
  sent_by uuid references public.users (id) on delete set null
);
create index if not exists reengagement_sends_user_idx on public.reengagement_sends (user_id, sent_at desc);
alter table public.reengagement_sends enable row level security;
revoke all on public.reengagement_sends from anon, authenticated;
