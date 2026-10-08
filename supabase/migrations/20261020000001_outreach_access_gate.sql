-- =============================================================================
-- Outreach : accès aux offres réservé aux inscrits (parcours e-mail → compte → offre)
-- -----------------------------------------------------------------------------
-- Nouvelles étapes suivies (additif) :
--   GATE_VIEW          page d'accès affichée (« Créez votre compte pour accéder à cette offre »)
--   GATE_SIGNUP_CLICK  clic sur « Créer mon compte »
--   GATE_LOGIN_CLICK   clic sur « Se connecter »
--   LOGIN              connexion d'un compte existant depuis le parcours
--   OFFER_ACCESS       offre consultée par un utilisateur connecté venu du parcours
-- =============================================================================

alter table public.outreach_events drop constraint if exists outreach_events_type_check;
alter table public.outreach_events add constraint outreach_events_type_check check (type in (
  'PREPARED', 'SENT', 'SIMULATED', 'FAILED', 'OPEN', 'CLICK', 'LANDING_VIEW', 'OPPORTUNITY_VIEW', 'SIGNUP', 'CONVERSION', 'UNSUBSCRIBE',
  'GATE_VIEW', 'GATE_SIGNUP_CLICK', 'GATE_LOGIN_CLICK', 'LOGIN', 'OFFER_ACCESS'
));

alter table public.outreach_recipients
  add column if not exists gate_viewed_at timestamptz,
  add column if not exists signup_clicked_at timestamptz,
  add column if not exists login_clicked_at timestamptz,
  add column if not exists logged_in_at timestamptz,
  add column if not exists offer_accessed_at timestamptz;

create or replace function public.outreach_campaign_stats(p_campaign_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'recipients', count(*),
    'selected', count(*) filter (where status not in ('EXCLUDED', 'SUPPRESSED', 'FREQUENCY')),
    'prepared', count(*) filter (where status in ('PENDING', 'QUEUED', 'SENT', 'SIMULATED', 'FAILED')),
    'no_email', count(*) filter (where status = 'NO_EMAIL'),
    'excluded', count(*) filter (where status in ('EXCLUDED', 'SUPPRESSED', 'FREQUENCY')),
    'sent', count(*) filter (where status = 'SENT'),
    'simulated', count(*) filter (where status = 'SIMULATED'),
    'failed', count(*) filter (where status = 'FAILED'),
    'opened', count(opened_at),
    'clicked', count(clicked_at),
    'landing', count(landing_viewed_at),
    'opportunity_views', count(opportunity_viewed_at),
    'gate_views', count(gate_viewed_at),
    'signup_clicks', count(signup_clicked_at),
    'login_clicks', count(login_clicked_at),
    'signups', count(signed_up_at),
    'logins', count(logged_in_at),
    'offer_access', count(offer_accessed_at),
    'conversions', count(converted_at),
    'unsubscribed', count(unsubscribed_at)
  )
  from public.outreach_recipients
  where campaign_id = p_campaign_id;
$$;
grant execute on function public.outreach_campaign_stats(uuid) to authenticated;
