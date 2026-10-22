-- Suivi des inscrits par e-mail : accueil des nouveaux comptes, relance des absents, nouveautés.
-- Réutilise l'envoi de la veille (plafond quotidien, jetons, clics, désinscription, rebonds) :
-- une campagne « SUIVI » par jour, un envoi par personne avec l'étape choisie.

alter table public.veille_campaigns drop constraint if exists veille_campaigns_kind_check;
alter table public.veille_campaigns add constraint veille_campaigns_kind_check
  check (kind in ('LAUNCH', 'MONDAY', 'FRIDAY', 'DAILY', 'INVITE', 'SUIVI'));

alter table public.veille_sends add column if not exists step text;
alter table public.veille_sends add column if not exists news_key text;
create index if not exists veille_sends_step_idx on public.veille_sends (user_id, step) where step is not null;

-- Destinataires du suivi : tous les comptes actifs et confirmés (relation de compte, adresses professionnelles),
-- sauf désinscription explicite (lien en bas de chaque e-mail), choix « ne rien recevoir », rebond ou plainte.
create or replace function public.suivi_audience()
returns table (
  user_id uuid, email text, full_name text, created_at timestamptz, last_seen_at timestamptz,
  frequency text, sectors text[], regions text[], types public.opportunity_type[], keywords text[],
  company_name text, company_sectors text[], company_region text,
  has_company boolean, has_logo boolean, profile_complete boolean, has_alert boolean, veille_on boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, lower(u.email), u.full_name, u.created_at, u.last_seen_at,
         coalesce(p.frequency, 'TWICE_WEEKLY'),
         coalesce(p.sectors, '{}'), coalesce(p.regions, '{}'), coalesce(p.types, '{}'), coalesce(p.keywords, '{}'),
         c.name, coalesce(cp.sectors, '{}'), c.region,
         c.id is not null,
         c.logo_path is not null,
         (cp.description is not null and cardinality(coalesce(cp.sectors, '{}')) > 0),
         exists (select 1 from public.alerts a where a.user_id = u.id and a.is_active),
         (p.consent_at is not null or u.marketing_consent)
  from public.users u
  join auth.users au on au.id = u.id and au.email_confirmed_at is not null
  left join public.veille_preferences p on p.user_id = u.id
  left join lateral (
    select co.id, co.name, co.region, co.logo_path from public.company_members m join public.companies co on co.id = m.company_id
    where m.user_id = u.id and co.is_demo = false order by m.created_at limit 1
  ) c on true
  left join public.company_profiles cp on cp.company_id = c.id
  where u.status = 'ACTIVE'
    and u.is_demo = false
    and coalesce(p.frequency, 'TWICE_WEEKLY') <> 'NONE'
    and not exists (select 1 from public.veille_suppressions s where s.email = lower(u.email))
    and not exists (select 1 from public.outreach_suppressions s where s.kind = 'EMAIL' and s.value = lower(u.email) and s.reason in ('BOUNCE', 'COMPLAINT'));
$$;
revoke execute on function public.suivi_audience() from public, anon, authenticated;
grant execute on function public.suivi_audience() to service_role;

insert into public.platform_settings (key, value, description)
values ('suivi', '{"enabled": true}'::jsonb, 'Suivi des inscrits par e-mail (accueil, relance des absents, nouveautés)')
on conflict (key) do nothing;
