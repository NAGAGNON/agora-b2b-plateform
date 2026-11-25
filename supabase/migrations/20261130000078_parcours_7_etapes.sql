-- Parcours de préparation en 7 étapes : réponses de l'entreprise enregistrées par dossier.
-- journey = { eligibility: {"<critère>": {s: "yes"|"no"|"check"|"na", note}}, capacities: {...},
--             submission: {status, date, platform, reference}, results: [{status, date, comment, reason, amount, at}] }
-- Les étapes cochées restent dans guide_done (0 éligibilité, 1 besoin, 2 capacités, 3 documents, 4 offre, 5 dépôt).
-- Ancienne étape 2 « Questions et visite » regroupée avec 1 « Comprendre le besoin » : son indice devient 1.
-- Aucune donnée supprimée : sauvegarde des anciens guide_done dans audit_logs.
alter table public.pipeline_items add column if not exists journey jsonb not null default '{}'::jsonb;

insert into public.audit_logs (action, entity_type, entity_id, metadata)
select 'pipeline.guide_remap_backup', 'pipeline_item', id, jsonb_build_object('guide_done', guide_done)
from public.pipeline_items where 2 = any(guide_done);

update public.pipeline_items
set guide_done = (select coalesce(array_agg(distinct case when g = 2 then 1 else g end order by case when g = 2 then 1 else g end), '{}') from unnest(guide_done) g)
where 2 = any(guide_done);

-- L'entreprise enregistre elle-même ses réponses (droits de ligne inchangés : seulement ses propres dossiers)
grant insert (journey) on public.pipeline_items to authenticated;
grant update (journey) on public.pipeline_items to authenticated;
