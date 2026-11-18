-- Question rapide « Vous appréciez LinkProB2B ? » (oui / non) posée aux membres inscrits depuis 7 jours.
-- Une réponse par membre ; écrite par le serveur (service_role), lue par l'administration.
create table if not exists public.app_satisfaction (
  user_id uuid primary key references public.users (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  liked boolean not null,
  answered_at timestamptz not null default now()
);
alter table public.app_satisfaction enable row level security;
revoke all on public.app_satisfaction from anon, authenticated;
grant all on public.app_satisfaction to service_role;
