-- Limite horaire relevée à 90 e-mails (demande du 23/10), par type de campagne
update public.outreach_settings set hourly_send_cap = greatest(hourly_send_cap, 90), updated_at = now() where id;
