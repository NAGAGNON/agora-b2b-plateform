-- Recherche des entreprises d'un besoin (métier + zone, triées par marchés publics remportés) :
-- l'index complet sur public_awards_count poussait le planificateur à parcourir toute la table dans
-- l'ordre du tri (6 s, au-delà du délai autorisé pour le besoin BTP de Nîmes). Sans lui, la recherche
-- passe par les index du métier (sectors, naf_code) puis trie le résultat : environ 0,1 s.
-- Index remplacé par un index partiel (entreprises ayant remporté au moins un marché) : aucune donnée touchée.
drop index if exists public.outreach_prospects_awards_idx;
create index if not exists outreach_prospects_awards_pos_idx
  on public.outreach_prospects (public_awards_count desc)
  where public_awards_count > 0;
