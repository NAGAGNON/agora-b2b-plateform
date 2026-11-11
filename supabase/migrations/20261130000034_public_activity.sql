-- Preuve sociale de l'accueil : chiffres forts et activité réelle récente.
-- Uniquement des données publiques : nombres agrégés, besoins publiés (déjà visibles sur le site)
-- et entreprises ayant choisi d'apparaître dans l'annuaire. Jamais de nom de personne.
create or replace function public.public_activity(p_limit int default 6)
returns jsonb language sql stable security definer set search_path = '' as $$
  with open as (
    select o.buyer_key from public.opportunities o
    where o.status = 'PUBLISHED' and o.visibility = 'PUBLIC' and not o.is_demo
      and (o.response_deadline is null or o.response_deadline > now())
  ), needs as (
    select o.id, o.title, coalesce(o.city, c.city) as city, c.name as company, o.published_at as at
    from public.opportunities o
    join public.companies c on c.id = o.company_id
    join public.company_profiles p on p.company_id = c.id
    where o.origin = 'INTERNAL' and o.status = 'PUBLISHED' and o.visibility = 'PUBLIC'
      and not o.is_demo and c.status = 'ACTIVE' and not c.is_demo and not c.is_internal and p.is_public
      and o.published_at is not null
    order by o.published_at desc limit least(greatest(p_limit, 1), 12)
  ), joined as (
    select c.name, c.slug, c.logo_path, c.city, c.created_at as at
    from public.companies c join public.company_profiles p on p.company_id = c.id
    where c.status = 'ACTIVE' and not c.is_demo and not c.is_internal and p.is_public
    order by c.created_at desc limit least(greatest(p_limit, 1), 12)
  )
  select jsonb_build_object(
    -- Acheteurs publics distincts ayant au moins un appel d'offres ouvert
    'buyers', (select count(distinct buyer_key) from open where buyer_key is not null),
    'needs', (select coalesce(jsonb_agg(to_jsonb(needs) order by at desc), '[]'::jsonb) from needs),
    'joined', (select coalesce(jsonb_agg(to_jsonb(joined) order by at desc), '[]'::jsonb) from joined)
  );
$$;
revoke all on function public.public_activity(int) from public;
grant execute on function public.public_activity(int) to anon, authenticated;
