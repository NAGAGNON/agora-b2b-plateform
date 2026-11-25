-- Résultats des marchés publics : avis d'attribution du BOAMP (données publiques, licence ouverte).
-- Une ligne par avis : objet, acheteur, entreprises titulaires, date, lieu, métier. Les titulaires qui
-- semblent être des personnes (entrepreneurs individuels) sont écartés à l'import. Une entreprise peut
-- demander le retrait de sa page (award_optouts) : elle disparaît alors de toutes les pages publiques.
create table if not exists public.awards (
  idweb text primary key,
  title text not null,
  buyer_name text,
  buyer_key text generated always as (public.buyer_slug(buyer_name)) stored,
  winners text[] not null,
  winner_keys text[] not null,
  published_on date not null,
  department_code text,
  region text,
  sector_slug text,
  market_type text,
  url text,
  created_at timestamptz not null default now()
);
create index if not exists awards_winner_keys_idx on public.awards using gin (winner_keys);
create index if not exists awards_buyer_key_idx on public.awards (buyer_key, published_on desc);
create index if not exists awards_published_idx on public.awards (published_on desc);
create index if not exists awards_sector_region_idx on public.awards (sector_slug, region, published_on desc);

create table if not exists public.award_optouts (
  winner_key text primary key,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.awards enable row level security;
alter table public.award_optouts enable row level security;
revoke all on public.awards from anon, authenticated;
revoke all on public.award_optouts from anon, authenticated;
grant select on public.awards to anon, authenticated;
drop policy if exists awards_select on public.awards;
create policy awards_select on public.awards for select using (true);

-- Région déduite du département (comme pour les offres)
create or replace function public.award_fill_region()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.department_code is not null and new.region is null then
    select d.region into new.region from public.departments d where d.code = new.department_code;
  end if;
  return new;
end;
$$;
drop trigger if exists award_fill_region on public.awards;
create trigger award_fill_region before insert or update of department_code on public.awards
  for each row execute function public.award_fill_region();

-- Marchés remportés par une entreprise (page /titulaires/[slug])
create or replace function public.winner_awards(p_key text, p_limit integer default 200)
returns table(idweb text, title text, buyer_name text, buyer_key text, winners text[], winner_keys text[], published_on date,
              department_code text, region text, sector_slug text, market_type text, url text)
language sql stable security definer set search_path = '' as $$
  select a.idweb, a.title, a.buyer_name, a.buyer_key, a.winners, a.winner_keys, a.published_on, a.department_code, a.region, a.sector_slug, a.market_type, a.url
  from public.awards a
  where a.winner_keys @> array[p_key]
    and not exists (select 1 from public.award_optouts x where x.winner_key = p_key)
  order by a.published_on desc
  limit greatest(1, least(coalesce(p_limit, 200), 500));
$$;

-- Classement des entreprises qui gagnent le plus (par métier et/ou région, depuis une date)
create or replace function public.top_winners(p_sector text default null, p_region text default null, p_since date default null, p_limit integer default 20)
returns table(winner_key text, winner_name text, awards bigint, last_on date)
language sql stable security definer set search_path = '' as $$
  with w as (
    select k.key, k.name, a.published_on
    from public.awards a
    cross join lateral unnest(a.winner_keys, a.winners) as k(key, name)
    where (p_sector is null or a.sector_slug = p_sector)
      and (p_region is null or a.region = p_region)
      and (p_since is null or a.published_on >= p_since)
  )
  select w.key, (array_agg(w.name order by w.published_on desc))[1], count(*), max(w.published_on)
  from w
  where not exists (select 1 from public.award_optouts x where x.winner_key = w.key)
  group by w.key
  order by count(*) desc, max(w.published_on) desc
  limit greatest(1, least(coalesce(p_limit, 20), 10000));
$$;

-- Nombre d'avis par métier et région (pages de classement indexées seulement avec assez de données)
create or replace function public.award_counts()
returns table(sector_slug text, region text, n bigint)
language sql stable security definer set search_path = '' as $$
  select a.sector_slug, a.region, count(*) from public.awards a group by a.sector_slug, a.region;
$$;

revoke all on function public.winner_awards(text, integer) from public;
revoke all on function public.top_winners(text, text, date, integer) from public;
revoke all on function public.award_counts() from public;
grant execute on function public.winner_awards(text, integer) to anon, authenticated, service_role;
grant execute on function public.top_winners(text, text, date, integer) to anon, authenticated, service_role;
grant execute on function public.award_counts() to anon, authenticated, service_role;
