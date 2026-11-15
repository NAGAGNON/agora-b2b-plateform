-- Question au retour : « Cet appel d'offres vous intéresse ? » (repérage) au lieu de « avez-vous postulé ? ».
-- Nouvelle réponse INTERESTED : ajouté au pipeline, sans guide de réponse.
alter table public.application_prompts drop constraint if exists application_prompts_answer_check;
alter table public.application_prompts add constraint application_prompts_answer_check
  check (answer in ('INTERESTED', 'SENT', 'PREPARING', 'NOT_FOR_ME', 'LATER'));
