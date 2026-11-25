-- Visites venues d'un e-mail de prospection (page /opportunites/selection/…) : comptées seulement si la
-- personne a vraiment visité le site (au moins 2 pages, ou au moins 5 secondes sur la page).
-- Les liens ouverts par les robots des messageries (une page, aucune lecture) ne faussent plus l'audience.
-- Aucune donnée supprimée : page_views reste intacte, seuls les calculs lisent cette vue.
create or replace view public.page_views_human with (security_invoker = true) as
select pv.*
from public.page_views pv
where not (
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
);

revoke all on public.page_views_human from anon, authenticated;
grant select on public.page_views_human to service_role;
