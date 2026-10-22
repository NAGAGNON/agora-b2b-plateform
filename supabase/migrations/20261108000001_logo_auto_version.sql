-- Logos automatiques : version de la méthode de repérage. Les logos trouvés par la première version
-- (qui pouvait retenir un visuel de campagne) sont recherchés à nouveau automatiquement.
alter table public.companies add column if not exists logo_auto_version smallint not null default 1;
