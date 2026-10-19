-- Prospection ramenée à 50 e-mails par jour (demande du propriétaire : budget Vercel plafonné à
-- 20 € par mois). Moins de recherches d'adresses et de campagnes complémentaires, donc beaucoup
-- moins de temps de calcul. La montée en charge automatique ne dépasse pas cet objectif.
alter table public.outreach_settings alter column daily_send_target set default 50;

update public.outreach_settings
set daily_send_target = 50,
    total_daily_send_cap = 50,
    daily_send_cap = 50,
    send_ramp_target = 50,
    updated_at = now()
where id;
