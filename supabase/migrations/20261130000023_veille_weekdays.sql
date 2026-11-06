-- Veille du matin, du lundi au vendredi : nouvelle fréquence WEEKDAYS, appliquée par défaut aux
-- membres qui n'ont jamais choisi de fréquence (le choix explicite d'une personne est conservé).
-- L'accord pour recevoir des e-mails reste exigé, comme avant. Aucune donnée existante n'est modifiée.

alter table public.veille_preferences drop constraint if exists veille_preferences_frequency_check;
alter table public.veille_preferences
  add constraint veille_preferences_frequency_check check (frequency in ('WEEKDAYS', 'TWICE_WEEKLY', 'DAILY', 'NONE'));

create or replace function public.veille_audience()
returns table (
  user_id uuid, email text, full_name text, frequency text, sectors text[], regions text[], types public.opportunity_type[], keywords text[],
  company_name text, company_sectors text[], company_region text, consent text
)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, lower(u.email), u.full_name,
         coalesce(p.frequency, 'WEEKDAYS'),
         coalesce(p.sectors, '{}'), coalesce(p.regions, '{}'), coalesce(p.types, '{}'), coalesce(p.keywords, '{}'),
         c.name, coalesce(cp.sectors, '{}'), c.region,
         case when p.consent_at is not null then 'veille' else 'actualites' end
  from public.users u
  join auth.users au on au.id = u.id and au.email_confirmed_at is not null
  left join public.veille_preferences p on p.user_id = u.id
  left join lateral (
    select co.id, co.name, co.region from public.company_members m join public.companies co on co.id = m.company_id
    where m.user_id = u.id and co.is_demo = false order by m.created_at limit 1
  ) c on true
  left join public.company_profiles cp on cp.company_id = c.id
  where u.status = 'ACTIVE'
    and u.is_demo = false
    and coalesce(p.frequency, 'WEEKDAYS') <> 'NONE'
    and (p.consent_at is not null or (p.user_id is null and u.marketing_consent) or (p.user_id is not null and p.consent_at is null and u.marketing_consent))
    and not exists (select 1 from public.veille_suppressions s where s.email = lower(u.email))
    and not exists (select 1 from public.outreach_suppressions s where s.kind = 'EMAIL' and s.value = lower(u.email) and s.reason in ('BOUNCE', 'COMPLAINT'));
$$;
revoke execute on function public.veille_audience() from public, anon, authenticated;
grant execute on function public.veille_audience() to service_role;
