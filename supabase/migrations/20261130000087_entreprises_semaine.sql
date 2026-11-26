-- Page de création d'entreprise : « N entreprises inscrites cette semaine » et les logos de celles qui en ont un.
-- Données publiques de l'annuaire uniquement (entreprises actives, publiques, hors démo et compte interne).
create or replace function public.public_week_companies(p_limit int default 30)
returns jsonb language sql stable security definer set search_path = '' as $$
  with week as (
    select c.name, c.slug, c.logo_path, c.city, c.created_at as at
    from public.companies c join public.company_profiles p on p.company_id = c.id
    where c.status = 'ACTIVE' and not c.is_demo and not c.is_internal and p.is_public
      and c.created_at >= now() - interval '7 days'
  ), logos as (
    select * from week where logo_path is not null order by at desc limit least(greatest(p_limit, 1), 40)
  )
  select jsonb_build_object(
    'total', (select count(*) from week),
    'logos', (select coalesce(jsonb_agg(to_jsonb(logos) order by at desc), '[]'::jsonb) from logos)
  );
$$;
revoke all on function public.public_week_companies(int) from public;
grant execute on function public.public_week_companies(int) to anon, authenticated;
