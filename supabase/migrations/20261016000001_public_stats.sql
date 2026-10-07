-- Indicateurs publics de fraîcheur des données (accueil, page Opportunités).
-- Uniquement des agrégats sur des données publiées : aucune donnée personnelle.
create or replace function public.public_platform_stats()
returns jsonb language sql stable security definer set search_path = '' as $$
  with open as (
    select o.id, o.region, o.department_code, o.published_at, o.created_at
    from public.opportunities o
    where o.status = 'PUBLISHED' and o.visibility = 'PUBLIC' and not o.is_demo
      and (o.response_deadline is null or o.response_deadline > now())
  )
  select jsonb_build_object(
    'active', (select count(*) from open),
    -- Ajoutées sur LinkProB2B (collecte ou publication) au cours des dernières 24 h / 7 jours
    'new_24h', (select count(*) from open where created_at > now() - interval '24 hours'),
    'new_7d', (select count(*) from open where created_at > now() - interval '7 days'),
    'regions', (select count(distinct region) from open where region is not null),
    'departments', (select count(distinct department_code) from open where department_code is not null),
    'last_sync_at', (select max(last_success_at) from public.external_sources where status = 'APPROVED' and is_active),
    'sources', (select coalesce(jsonb_agg(name order by name), '[]'::jsonb) from public.external_sources
                where status = 'APPROVED' and is_active and connector <> 'manual'),
    'companies', (select count(*) from public.companies c join public.company_profiles p on p.company_id = c.id
                  where c.status = 'ACTIVE' and not c.is_demo and p.is_public)
  );
$$;
revoke all on function public.public_platform_stats() from public;
grant execute on function public.public_platform_stats() to anon, authenticated;
