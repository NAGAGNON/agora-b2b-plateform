-- Présentation des annonces de campagne : 800 caractères au lieu de 400 (textes coupés au milieu d'un mot)
alter table public.visibility_boosts drop constraint if exists visibility_boosts_ad_text_check;
alter table public.visibility_boosts add constraint visibility_boosts_ad_text_check check (ad_text is null or char_length(ad_text) <= 800);
