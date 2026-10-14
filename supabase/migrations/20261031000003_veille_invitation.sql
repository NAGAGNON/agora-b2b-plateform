-- Invitation unique à activer la veille, pour les inscrits qui n'ont pas (encore) donné leur accord.
-- Envoyée une seule fois par compte ; aucune veille n'est envoyée ensuite sans accord explicite.
alter table public.veille_campaigns drop constraint if exists veille_campaigns_kind_check;
alter table public.veille_campaigns add constraint veille_campaigns_kind_check check (kind in ('LAUNCH', 'MONDAY', 'FRIDAY', 'DAILY', 'INVITE'));

create or replace function public.veille_invitation_candidates()
returns table (user_id uuid, email text, full_name text, company_sectors text[], company_region text)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, lower(u.email), u.full_name, coalesce(cp.sectors, '{}'), c.region
  from public.users u
  join auth.users au on au.id = u.id and au.email_confirmed_at is not null
  left join public.veille_preferences p on p.user_id = u.id
  left join lateral (
    select co.id, co.region from public.company_members m join public.companies co on co.id = m.company_id
    where m.user_id = u.id and co.is_demo = false order by m.created_at limit 1
  ) c on true
  left join public.company_profiles cp on cp.company_id = c.id
  where u.status = 'ACTIVE'
    and u.is_demo = false
    and u.created_at < now() - interval '1 day'
    -- Pas d'accord donné (sinon la personne reçoit déjà la veille) et pas de refus explicite
    and not u.marketing_consent
    and p.consent_at is null
    and coalesce(p.frequency, 'TWICE_WEEKLY') <> 'NONE'
    and not exists (select 1 from public.veille_suppressions s where s.email = lower(u.email))
    and not exists (select 1 from public.outreach_suppressions s where s.kind = 'EMAIL' and s.value = lower(u.email) and s.reason in ('BOUNCE', 'COMPLAINT'))
    -- Une seule invitation par compte, quel qu'en soit le résultat
    and not exists (select 1 from public.veille_sends vs join public.veille_campaigns vc on vc.id = vs.campaign_id where vs.user_id = u.id and vc.kind = 'INVITE');
$$;
revoke execute on function public.veille_invitation_candidates() from public, anon, authenticated;
grant execute on function public.veille_invitation_candidates() to service_role;
