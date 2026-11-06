-- Offre « membre fondateur » (préparée, INACTIVE) : réglage désactivé par défaut et journal des
-- e-mails envoyés (une seule fois par personne et par étape : annonce, rappel, dernier rappel).
insert into public.platform_settings (key, value, description)
values ('founder_offer', '{"enabled": false}'::jsonb, 'Offre membre fondateur (Pro à moitié prix à vie) : enabled, launched_at, ends_at')
on conflict (key) do nothing;

create table if not exists public.founder_offer_sends (
  user_id uuid not null references public.users (id) on delete cascade,
  step text not null check (step in ('ANNONCE', 'RAPPEL', 'DERNIER')),
  created_at timestamptz not null default now(),
  primary key (user_id, step)
);
alter table public.founder_offer_sends enable row level security;
drop policy if exists founder_offer_sends_staff on public.founder_offer_sends;
create policy founder_offer_sends_staff on public.founder_offer_sends for select to authenticated using (public.is_staff());
revoke insert, update, delete on public.founder_offer_sends from anon, authenticated;
