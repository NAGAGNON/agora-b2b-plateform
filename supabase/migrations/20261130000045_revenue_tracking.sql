-- Suivi des revenus (administration) : fin d'essai et motif de résiliation donnés par Stripe.
alter table public.subscriptions add column if not exists trial_end timestamptz;
alter table public.subscriptions add column if not exists cancel_reason text;
alter table public.subscriptions add column if not exists cancel_feedback text;
