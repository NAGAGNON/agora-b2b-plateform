-- Objectif quotidien d'envois Outreach relevé à 200 e-mails pertinents (demande du propriétaire).
-- Plafonds relevés à cet objectif (jamais abaissés). La baisse automatique d'un palier en cas de
-- rebonds trop nombreux reste active pour protéger la réputation de l'adresse d'envoi.
alter table public.outreach_settings alter column daily_send_target set default 200;

update public.outreach_settings
set daily_send_target = greatest(daily_send_target, 200),
    total_daily_send_cap = greatest(total_daily_send_cap, 200),
    daily_send_cap = greatest(daily_send_cap, 200),
    hourly_send_cap = greatest(hourly_send_cap, 50),
    send_ramp_target = greatest(send_ramp_target, 200),
    updated_at = now()
where id;
