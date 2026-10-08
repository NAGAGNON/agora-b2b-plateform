-- =============================================================================
-- Outreach : envoi par SMTP du domaine (sans API payante), file progressive, suivi local
-- -----------------------------------------------------------------------------
-- Notre base est la source de vérité de chaque envoi : tentatives, date, réponse du serveur
-- SMTP, erreur. Limites progressives (montée en charge) réglables dans Outreach → Paramètres.
-- Additif : aucune donnée existante modifiée hors réglages par défaut.
-- =============================================================================

alter table public.outreach_recipients drop constraint if exists outreach_recipients_status_check;
alter table public.outreach_recipients add constraint outreach_recipients_status_check check (status in (
  'PENDING', 'EXCLUDED', 'NO_EMAIL', 'SUPPRESSED', 'FREQUENCY', 'QUEUED', 'SENDING', 'SENT', 'SIMULATED', 'FAILED'
));

alter table public.outreach_recipients
  add column if not exists attempts int not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists smtp_response text,
  add column if not exists transport text;

-- Limites d'envoi, toutes campagnes confondues (automatiques et manuelles) :
-- démarrage prudent, à relever progressivement si la délivrabilité reste bonne.
alter table public.outreach_settings
  add column if not exists total_daily_send_cap int not null default 50 check (total_daily_send_cap between 0 and 10000),
  add column if not exists hourly_send_cap int not null default 20 check (hourly_send_cap between 0 and 2000),
  add column if not exists send_interval_seconds int not null default 6 check (send_interval_seconds between 0 and 300),
  add column if not exists max_send_attempts int not null default 3 check (max_send_attempts between 1 and 10);

create index if not exists outreach_recipients_sent_at_idx on public.outreach_recipients (sent_at desc) where status in ('SENT', 'SIMULATED');
create index if not exists outreach_recipients_email_idx on public.outreach_recipients (lower(email)) where email is not null;
