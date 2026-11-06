-- Offres recommandées incluses dans l'offre Gratuite (après le lancement payant aussi) : c'est ce
-- qui fait revenir les membres chaque jour. Le pipeline reste un avantage Pro. Décision du 6 novembre.
update public.plans
   set features = jsonb_set(features, '{recommendations}', 'true'::jsonb)
 where code = 'FREE';
