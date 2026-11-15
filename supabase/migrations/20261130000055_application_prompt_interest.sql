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

-- Journal de suivi d'une candidature (jour par jour) : notes de l'équipe et événements automatiques
create table if not exists public.application_journal (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  user_id uuid references public.users (id) on delete set null,
  kind text not null default 'NOTE' check (kind in ('NOTE', 'START', 'STEP', 'SENT', 'WON', 'LOST')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists application_journal_idx on public.application_journal (company_id, opportunity_id, created_at desc);
alter table public.application_journal enable row level security;
create policy application_journal_select on public.application_journal for select using (public.is_company_member(company_id));
create policy application_journal_insert on public.application_journal for insert with check (public.is_company_member(company_id) and user_id = auth.uid());
create policy application_journal_delete on public.application_journal for delete using (public.is_company_member(company_id) and user_id = auth.uid());
grant select, insert, delete on public.application_journal to authenticated;
