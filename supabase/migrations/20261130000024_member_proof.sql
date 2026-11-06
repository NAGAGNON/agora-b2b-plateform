-- Preuve sociale (chiffres réels) : professionnels inscrits, entreprises inscrites, nouveaux de la
-- semaine, et entreprises affichées dans l'annuaire public (case « Afficher mon entreprise dans
-- l'annuaire public » laissée cochée). Aucune donnée existante n'est modifiée.

create or replace function public.public_platform_stats()
returns jsonb language sql stable security definer set search_path = '' as $$
  with open as (
    select o.id, o.region, o.department_code, o.published_at, o.created_at
    from public.opportunities o
    where o.status = 'PUBLISHED' and o.visibility = 'PUBLIC' and not o.is_demo
      and (o.response_deadline is null or o.response_deadline > now())
  ), members as (
    select u.created_at from public.users u
    join auth.users au on au.id = u.id and au.email_confirmed_at is not null
    where u.status = 'ACTIVE' and not u.is_demo
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
                  where c.status = 'ACTIVE' and not c.is_demo and p.is_public),
    -- Inscrits (adresse confirmée, compte actif) et entreprises inscrites : des nombres, jamais de noms
    'members', (select count(*) from members),
    'members_7d', (select count(*) from members where created_at > now() - interval '7 days'),
    'members_30d', (select count(*) from members where created_at > now() - interval '30 days'),
    'registered_companies', (select count(*) from public.companies c where c.status = 'ACTIVE' and not c.is_demo)
  );
$$;
revoke all on function public.public_platform_stats() from public;
grant execute on function public.public_platform_stats() to anon, authenticated;

-- Entreprises de l'annuaire public (les plus grandes d'abord) : uniquement celles affichées dans l'annuaire
create or replace function public.public_member_companies(p_limit int default 12)
returns table (name text, slug text, logo_path text, city text, region text, size public.company_size)
language sql stable security definer set search_path = '' as $$
  select c.name, c.slug, c.logo_path, c.city, c.region, c.size
  from public.companies c join public.company_profiles p on p.company_id = c.id
  where c.status = 'ACTIVE' and not c.is_demo and p.is_public
  order by array_position(array['GE', 'ETI', 'PME', 'TPE', 'INDEPENDANT']::public.company_size[], c.size) nulls last, c.created_at
  limit least(greatest(p_limit, 1), 24);
$$;
revoke all on function public.public_member_companies(int) from public;
grant execute on function public.public_member_companies(int) to anon, authenticated;
