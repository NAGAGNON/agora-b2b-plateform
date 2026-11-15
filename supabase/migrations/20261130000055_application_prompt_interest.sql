-- Question au retour : « Cet appel d'offres vous intéresse ? » (repérage) au lieu de « avez-vous postulé ? ».
-- Nouvelle réponse INTERESTED : ajouté au pipeline, sans guide de réponse.
alter table public.application_prompts drop constraint if exists application_prompts_answer_check;
alter table public.application_prompts add constraint application_prompts_answer_check
  check (answer in ('INTERESTED', 'SENT', 'PREPARING', 'NOT_FOR_ME', 'LATER'));

-- Espace de candidature : pièces cochées et brouillon du mémoire technique (privés à l'entreprise)
alter table public.pipeline_items
  add column if not exists docs_done smallint[] not null default '{}',
  add column if not exists draft text;
alter table public.pipeline_items drop constraint if exists pipeline_docs_done_limit;
alter table public.pipeline_items add constraint pipeline_docs_done_limit check (cardinality(docs_done) <= 40);
alter table public.pipeline_items drop constraint if exists pipeline_draft_length;
alter table public.pipeline_items add constraint pipeline_draft_length check (draft is null or char_length(draft) <= 40000);
grant insert (docs_done, draft) on public.pipeline_items to authenticated;
grant update (docs_done, draft) on public.pipeline_items to authenticated;
