-- LinkProB2B Outreach : expéditeur « LinkProB2B » (même adresse que les e-mails d'inscription).
-- Migration additive : ne touche pas un nom déjà personnalisé depuis le tableau de bord.
alter table public.outreach_settings alter column sender_name set default 'LinkProB2B';
update public.outreach_settings
set sender_name = 'LinkProB2B', updated_at = now()
where id and sender_name = 'LinkProB2B — Veille opportunités';
