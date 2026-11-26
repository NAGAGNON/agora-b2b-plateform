-- application_followers : clé primaire propre (id) au lieu de la clé composée de clés étrangères.
-- La clé composée faisait de la table une « table de liaison » entre offres et entreprises pour l'API,
-- ce qui rendait ambigu le lien direct opportunities → companies (company:companies(...)).
-- Table créée le jour même ; aucune donnée supprimée.
alter table public.application_followers add column if not exists id uuid not null default gen_random_uuid();
alter table public.application_followers drop constraint if exists application_followers_pkey;
alter table public.application_followers add constraint application_followers_pkey primary key (id);
alter table public.application_followers drop constraint if exists application_followers_uniq;
alter table public.application_followers add constraint application_followers_uniq unique (company_id, opportunity_id, user_id);
notify pgrst, 'reload schema';
