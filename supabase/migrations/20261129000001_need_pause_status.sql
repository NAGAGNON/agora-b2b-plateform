-- Besoins : statut « en pause » (masqué temporairement par l'entreprise, reprise sans nouvelle validation).
alter type public.opportunity_status add value if not exists 'PAUSED' after 'PUBLISHED';
