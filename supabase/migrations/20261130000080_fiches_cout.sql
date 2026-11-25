-- Fiches synthèse : consommation réelle du service de rédaction enregistrée pour chaque fiche
-- (mesure du coût sur une semaine, décision du fondateur du 25/11). Aucune donnée supprimée.
alter table public.tender_briefs add column if not exists input_tokens int;
alter table public.tender_briefs add column if not exists output_tokens int;
alter table public.tender_briefs add column if not exists generated_at timestamptz;

insert into public.platform_settings (key, value, description)
values ('briefs.prepare', '{"per_pass": 50, "concurrency": 5}'::jsonb, 'Fiches synthèse préparées à l''avance à chaque passage (toutes les 2 heures)')
on conflict (key) do nothing;
