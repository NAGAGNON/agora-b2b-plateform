-- Audience : les robots des messageries (antivirus qui ouvrent chaque lien d'un e-mail juste après l'envoi de la veille)
-- arrivent en rafales : plusieurs visites d'une seule page, sur ordinateur, dans la même minute. On les écarte des statistiques.
-- Rien n'est supprimé : les lignes restent dans page_views, seule la vue « humaine » les ignore.
create index if not exists page_views_session_idx on public.page_views (session_id);

create or replace view public.page_views_human with (security_invoker = true) as
select pv.*
from public.page_views pv
where not pv.internal
and not (
  coalesce(pv.duration_ms, 0) = 0
  and pv.device = 'desktop'
  and pv.created_at < now() - interval '30 minutes'
  and not exists (select 1 from public.page_views o where o.session_id = pv.session_id and o.id <> pv.id)
)
and not (
  pv.path like '/opportunites/selection/%'
  and coalesce(pv.duration_ms, 0) < 5000
  and pv.created_at < now() - interval '30 minutes'
  and not exists (select 1 from public.page_views o where o.session_id = pv.session_id and o.id <> pv.id)
)
-- Rafale : cette visite d'une seule page sur ordinateur tombe dans une minute où au moins 3 visites du même genre arrivent
and not (
  pv.device = 'desktop'
  and pv.created_at < now() - interval '30 minutes'
  and not exists (select 1 from public.page_views o where o.session_id = pv.session_id and o.id <> pv.id)
  and (
    select count(*) from public.page_views b
    where b.device = 'desktop'
      and b.created_at >= date_trunc('minute', pv.created_at)
      and b.created_at < date_trunc('minute', pv.created_at) + interval '1 minute'
      and not exists (select 1 from public.page_views o2 where o2.session_id = b.session_id and o2.id <> b.id)
  ) >= 3
);
revoke all on public.page_views_human from anon, authenticated;
grant select on public.page_views_human to service_role;
