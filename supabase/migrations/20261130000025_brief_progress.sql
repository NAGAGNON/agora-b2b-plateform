-- Fiche synthèse interactive : étapes du « à faire » cochées par l'entreprise, conservées sur sa
-- ligne de pipeline (privée à l'entreprise, mêmes règles d'accès). Aucune donnée existante modifiée.
alter table public.pipeline_items
  add column if not exists brief_done smallint[] not null default '{}'
  constraint pipeline_brief_done_limit check (cardinality(brief_done) <= 20);

grant insert (brief_done) on public.pipeline_items to authenticated;
grant update (brief_done) on public.pipeline_items to authenticated;
