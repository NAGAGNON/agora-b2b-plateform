-- Objectif quotidien d'envois Outreach : au moins 100 e-mails pertinents par jour. Les plafonds
-- d'envoi sont relevés à cet objectif (jamais abaissés) ; la baisse automatique en cas de rebonds
-- trop nombreux reste active pour protéger la réputation de l'adresse d'envoi.
alter table public.outreach_settings
  add column if not exists daily_send_target int not null default 100 check (daily_send_target between 0 and 10000);

update public.outreach_settings
set total_daily_send_cap = greatest(total_daily_send_cap, 100),
    daily_send_cap = greatest(daily_send_cap, 100),
    hourly_send_cap = greatest(hourly_send_cap, 40),
    send_ramp_target = greatest(send_ramp_target, 100),
    updated_at = now()
where id;
