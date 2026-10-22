-- Besoins publiés : jusqu'à 150 entreprises prospectées par jour et par besoin (demande du propriétaire),
-- quota distinct de la limite des campagnes automatiques et manuelles (50 par jour). La limite par
-- heure, l'intervalle entre deux e-mails, les exclusions et le plafond de temps de calcul restent communs.
alter table public.outreach_settings add column if not exists need_daily_send_cap int not null default 150 check (need_daily_send_cap between 0 and 2000);
-- Dernier jour où la campagne d'un besoin a été complétée par de nouvelles entreprises
alter table public.need_campaigns add column if not exists prospects_added_on date;
