-- Fiche « En savoir plus » : une seule rédaction à la fois par offre. Si la fiche est déjà en cours
-- (ouverture de l'offre puis clic rapide sur « En savoir plus »), la seconde demande attend la première.
create table if not exists public.brief_generations (
  opportunity_id uuid primary key references public.opportunities (id) on delete cascade,
  started_at timestamptz not null default now()
);
alter table public.brief_generations enable row level security;
revoke all on public.brief_generations from anon, authenticated;

-- Vrai si l'appelant obtient la rédaction ; une rédaction de plus de 2 minutes est considérée comme abandonnée
create or replace function public.claim_brief_generation(p_opportunity_id uuid) returns boolean
language sql volatile security definer set search_path = '' as $$
  with c as (
    insert into public.brief_generations as g (opportunity_id) values (p_opportunity_id)
    on conflict (opportunity_id) do update set started_at = now() where g.started_at < now() - interval '2 minutes'
    returning 1
  )
  select exists (select 1 from c);
$$;
revoke execute on function public.claim_brief_generation(uuid) from public, anon, authenticated;
