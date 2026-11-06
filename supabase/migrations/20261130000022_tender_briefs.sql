-- Fiche synthèse d'un appel d'offres (avantage Pro) : résumé structuré de l'avis officiel, préparé une
-- seule fois puis réutilisé. Lecture via le serveur (droits vérifiés côté application).
create table if not exists public.tender_briefs (
  opportunity_id uuid primary key references public.opportunities (id) on delete cascade,
  content jsonb not null,
  source_ref text,
  created_at timestamptz not null default now()
);
alter table public.tender_briefs enable row level security;
drop policy if exists tender_briefs_staff on public.tender_briefs;
create policy tender_briefs_staff on public.tender_briefs for select to authenticated using (public.is_staff());
revoke insert, update, delete on public.tender_briefs from anon, authenticated;

update public.plans set features = features || '{"tender_brief": false}'::jsonb where code = 'FREE';
update public.plans set features = features || '{"tender_brief": true}'::jsonb where code in ('PRO', 'BUSINESS');
