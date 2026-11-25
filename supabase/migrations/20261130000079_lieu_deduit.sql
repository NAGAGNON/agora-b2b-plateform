-- Offres sans lieu (≈ 1 080 ouvertes) : invisibles dans toute recherche par région ou département.
-- Le lieu est souvent écrit dans le nom de l'acheteur ou le titre (« Ville de Bordeaux »,
-- « Conseil départemental de l'Hérault », « Albi (81) »). On le retrouve, sans rien inventer :
--   1. numéro de département entre parenthèses « (81) » dans le titre ou le nom de l'acheteur ;
--   2. nom d'un département dans le nom de l'acheteur ;
--   3. nom d'une ville de plus de 10 000 habitants dans le nom de l'acheteur (le plus long nom trouvé) ;
--   4. nom d'une région dans le nom de l'acheteur (région seulement).
-- Ne touche jamais une offre qui a déjà un lieu. Aucune donnée supprimée.

create or replace function public.fold_text(p text)
returns text language sql immutable set search_path = '' as $$
  select ' ' || regexp_replace(
    translate(lower(coalesce(p, '')), 'àâäáãéèêëíìîïóòôöõúùûüçñœ''’-', 'aaaaaeeeeiiiiooooouuuucno   '),
    '[^a-z0-9]+', ' ', 'g') || ' ';
$$;

create or replace function public.infer_location(p_title text, p_buyer text)
returns table (department_code text, region text) language plpgsql stable security definer set search_path = '' as $$
declare v_code text; v_buyer text := public.fold_text(p_buyer);
begin
  -- 1. « (81) », « (2A) », « (978) »
  select d.code into v_code from public.departments d
   where coalesce(p_title, '') || ' ' || coalesce(p_buyer, '') ~ ('\(\s*' || d.code || '\s*\)') limit 1;
  -- 2. nom de département dans le nom de l'acheteur (le plus long d'abord : « Haute-Garonne » avant « Garonne »)
  if v_code is null and length(trim(v_buyer)) > 0 then
    select d.code into v_code from public.departments d
     where position(public.fold_text(d.name) in v_buyer) > 0
       -- « Nord-Ouest », « Nord-Est »… désignent une zone, pas le département
       and position(public.fold_text(d.name) || 'ouest ' in v_buyer) = 0
       and position(public.fold_text(d.name) || 'est ' in v_buyer) = 0
     order by length(d.name) desc limit 1;
  end if;
  -- 3. ville de plus de 10 000 habitants dans le nom de l'acheteur
  if v_code is null and length(trim(v_buyer)) > 0 then
    select p.department_code into v_code from public.places p
     where length(p.name) >= 4 and position(public.fold_text(p.name) in v_buyer) > 0
       -- nom porté par des villes de plusieurs départements (Saint-Denis 93 / 974) : trop incertain
       and not exists (select 1 from public.places q where public.fold_text(q.name) = public.fold_text(p.name) and q.department_code <> p.department_code)
     order by length(p.name) desc, p.population desc nulls last limit 1;
  end if;
  if v_code is not null then
    return query select d.code, d.region from public.departments d where d.code = v_code;
    return;
  end if;
  -- 4. région seule
  return query
    select null::text, r.region from (select distinct d.region from public.departments d where d.region is not null) r
     where position(public.fold_text(r.region) in v_buyer) > 0
        or (r.region = 'Île-de-France' and v_buyer ~ ' (idf|ile de france) ')
     order by length(r.region) desc limit 1;
end;
$$;
revoke all on function public.infer_location(text, text) from public, anon, authenticated;

-- À l'import : lieu déduit seulement quand la source n'en donne aucun
create or replace function public.opportunity_fill_location()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if new.department_code is null and new.region is null then
    select * into r from public.infer_location(new.title, new.external_buyer_name);
    if found then
      new.department_code := r.department_code;
      new.region := r.region;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists opportunity_fill_location on public.opportunities;
create trigger opportunity_fill_location before insert or update of title, external_buyer_name, department_code, region on public.opportunities
  for each row execute function public.opportunity_fill_location();

-- Rattrapage des offres ouvertes déjà importées
with found as (
  select o.id, l.department_code, l.region
    from public.opportunities o
    cross join lateral public.infer_location(o.title, o.external_buyer_name) l
   where o.department_code is null and o.region is null and o.status = 'PUBLISHED'
     and (l.department_code is not null or l.region is not null)
)
update public.opportunities o set department_code = f.department_code, region = f.region
  from found f where f.id = o.id;
