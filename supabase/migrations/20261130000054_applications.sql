-- Suivi des candidatures aux appels d'offres : question posée au retour sur le site après la
-- consultation de l'annonce officielle, guide de réponse étape par étape, résultat (gagné / perdu)
-- et rappels par e-mail (désactivés tant que le propriétaire n'a pas validé les textes).

-- Réponse de l'utilisateur à la question « Où en êtes-vous ? » (une seule fois par offre, sauf « plus tard »)
create table if not exists public.application_prompts (
  user_id uuid not null references public.users (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  answer text not null check (answer in ('SENT', 'PREPARING', 'NOT_FOR_ME', 'LATER')),
  reason text check (reason is null or char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, opportunity_id)
);
alter table public.application_prompts enable row level security;
create policy application_prompts_own on public.application_prompts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.application_prompts to authenticated;

-- Candidature : étapes du guide cochées, date de dépôt, résultat demandé, rappels envoyés
alter table public.pipeline_items
  add column if not exists guide_done smallint[] not null default '{}',
  add column if not exists submitted_at date,
  add column if not exists result_asked_at timestamptz,
  add column if not exists deadline_reminder_at timestamptz,
  add column if not exists result_email_at timestamptz;
alter table public.pipeline_items drop constraint if exists pipeline_guide_done_limit;
alter table public.pipeline_items add constraint pipeline_guide_done_limit check (cardinality(guide_done) <= 20);
grant insert (guide_done, submitted_at, result_asked_at) on public.pipeline_items to authenticated;
grant update (guide_done, submitted_at, result_asked_at) on public.pipeline_items to authenticated;

-- Rappels par e-mail (date limite proche, demande de résultat) : désactivés par défaut
insert into public.platform_settings (key, value, description)
values ('application_reminders', '{"enabled": false}'::jsonb, 'Rappels e-mail des candidatures (date limite J-3, demande de résultat) — à activer après validation des textes par le propriétaire')
on conflict (key) do nothing;
