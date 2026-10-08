-- =============================================================================
-- Bilan du jour envoyé par e-mail en fin de journée (une fois par jour)
-- Additif : nouvelle colonne, aucune donnée existante modifiée.
-- =============================================================================

alter table public.daily_reports add column if not exists emailed_at timestamptz;
