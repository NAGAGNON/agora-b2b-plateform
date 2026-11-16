-- Fiches synthèse réécrites en langage simple (style 2) : file des fiches à réécrire peu à peu.
-- Offres encore ouvertes seulement ; celles que des membres suivent d'abord, puis les dates limites
-- les plus proches. Une fiche dont la réécriture a échoué (avis introuvable…) est retentée le lendemain.
-- Lecture seule ; réservé aux tâches automatiques (clé de service).
create or replace function public.briefs_to_rewrite(p_style int, p_limit int default 60)
returns table (opportunity_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select b.opportunity_id
  from public.tender_briefs b
  join public.opportunities o on o.id = b.opportunity_id
  where o.status = 'PUBLISHED'
    and (o.response_deadline is null or o.response_deadline > now())
    and coalesce(case when b.content->>'style' ~ '^\d+$' then (b.content->>'style')::int end, 1) < p_style
    and (b.content->>'rewrite_failed_at' is null or (b.content->>'rewrite_failed_at')::timestamptz < now() - interval '1 day')
  order by exists (select 1 from public.pipeline_items p where p.opportunity_id = b.opportunity_id) desc,
           o.response_deadline asc nulls last
  limit greatest(1, least(coalesce(p_limit, 60), 500));
$$;

revoke all on function public.briefs_to_rewrite(int, int) from public, anon, authenticated;
grant execute on function public.briefs_to_rewrite(int, int) to service_role;
