-- Visites internes : la 1re page d'une visite est enregistrée avant que l'on sache que c'est l'équipe
-- (personne pas encore reconnue sur cet appareil). Dès que la visite est reconnue comme interne, toutes ses
-- pages sont marquées « internal » et sortent des statistiques. Aucune ligne supprimée.
alter table public.page_views add column if not exists internal boolean not null default false;

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
);
revoke all on public.page_views_human from anon, authenticated;
grant select on public.page_views_human to service_role;
