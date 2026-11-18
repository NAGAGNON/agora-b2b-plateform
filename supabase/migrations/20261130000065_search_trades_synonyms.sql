-- Recherche d'offres : les noms de métiers trouvent les offres de leur domaine (« plombier » → plomberie,
-- « électricien » → électricité…). Avant, ces recherches ne donnaient aucun résultat : les annonces parlent
-- de « travaux de plomberie », pas de « plombier ». « consultant » ne se confond plus avec « consultation »
-- (présent dans presque toutes les annonces). Utilisé aussi par les alertes (même fonction).

create table if not exists public.search_synonyms (
  term text primary key,          -- mot ou expression saisi, en minuscules sans accents
  expansion text not null,        -- requête to_tsquery (sans accents) ajoutée au mot saisi
  replace_term boolean not null default false  -- vrai : le mot saisi est remplacé (mot trompeur)
);
alter table public.search_synonyms enable row level security;
-- Vocabulaire public (lu par la recherche de chaque visiteur) ; modifiable seulement par les migrations
drop policy if exists search_synonyms_read on public.search_synonyms;
create policy search_synonyms_read on public.search_synonyms for select using (true);
revoke all on public.search_synonyms from anon, authenticated;
grant select on public.search_synonyms to anon, authenticated;

insert into public.search_synonyms (term, expansion, replace_term) values
  ('plombier', 'plomberie | sanitaire | robinetterie', false),
  ('electricien', 'electricite | electrique | eclairage', false),
  ('peintre', 'peinture | peintures', false),
  ('menuisier', 'menuiserie | menuiseries', false),
  ('couvreur', 'couverture | toiture | zinguerie', false),
  ('carreleur', 'carrelage | faience', false),
  ('serrurier', 'serrurerie | metallerie', false),
  ('macon', 'maconnerie | (gros & oeuvre)', false),
  ('plaquiste', 'platrerie | cloison | cloisons | doublage', false),
  ('platrier', 'platrerie | cloison | cloisons | enduit', false),
  ('chauffagiste', 'chauffage | chaudiere | (genie & climatique)', false),
  ('climaticien', 'climatisation | (genie & climatique)', false),
  ('frigoriste', 'froid | climatisation | frigorifique', false),
  ('jardinier', '(espaces & verts) | jardin | paysager', false),
  ('paysagiste', '(espaces & verts) | paysager | paysagere', false),
  ('elagueur', 'elagage | abattage', false),
  ('vitrier', 'vitrerie | miroiterie | vitrage', false),
  ('imprimeur', 'impression | imprimerie | reprographie', false),
  ('developpeur', 'logiciel | (application & (web | mobile)) | (developpement & (logiciel | informatique | web))', false),
  ('informaticien', 'informatique', false),
  ('webmaster', '(site & internet) | web', false),
  ('graphiste', 'graphisme | graphique | (conception & graphique)', false),
  ('photographe', 'photographie | photographique | reportage', false),
  ('transporteur', 'transport', false),
  ('chauffeur', 'transport | conduite', false),
  ('demenageur', 'demenagement', false),
  ('nettoyeur', 'nettoyage | proprete', false),
  ('agent de securite', 'gardiennage | surveillance | (securite & privee) | (agents & securite)', false),
  ('agent d entretien', 'nettoyage | proprete | entretien', false),
  ('femme de menage', 'nettoyage | menage | proprete', false),
  ('vigile', 'gardiennage | surveillance', false),
  ('formateur', 'formation', false),
  ('traducteur', 'traduction | interpretariat', false),
  ('interprete', 'interpretariat | traduction', false),
  ('comptable', 'comptabilite | (expertise & comptable)', false),
  ('avocat', 'juridique | avocat | (conseil & juridique)', false),
  ('ascensoriste', 'ascenseur | ascenseurs', false),
  ('ramoneur', 'ramonage', false),
  ('deratiseur', 'deratisation | desinsectisation', false),
  ('soudeur', 'soudure | chaudronnerie', false),
  ('mecanicien', 'mecanique | (entretien & vehicules)', false),
  ('garagiste', '(entretien & vehicules) | garage', false),
  ('traiteur', 'traiteur | restauration | repas', false),
  ('btp', 'btp | travaux', false),
  ('panneaux solaires', 'photovoltaique | solaire', false),
  ('solaire', 'photovoltaique | solaire', false),
  ('consultant', 'conseil | expertise | accompagnement | (prestations & intellectuelles) | amo', true),
  ('consulting', 'conseil | expertise | accompagnement', true)
on conflict (term) do update set expansion = excluded.expansion, replace_term = excluded.replace_term;

create or replace function public.search_tsquery(p text)
returns tsquery language plpgsql stable set search_path = '' as $$
declare
  raw text := coalesce(p, '');
  u text := lower(btrim(public.unaccent_simple(raw)));
  words text[];
  w text;
  lw text;
  n int;
  i int;
  wq tsquery;
  acc tsquery;
  syn record;
  phrase tsquery;
  -- Syntaxe avancée conservée (exclusion « -mot », guillemets) : accents retirés lettre par lettre seulement
  q_full tsquery := websearch_to_tsquery('french', translate(raw, 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝ', 'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY'));
begin
  if raw ~ '["]' or raw ~* '(^|\s)(-|or\s)' then
    return q_full;
  end if;
  u := btrim(regexp_replace(regexp_replace(u, '[^[:alnum:]\s]', ' ', 'g'), '\s+', ' ', 'g'));
  if u = '' then
    return q_full;
  end if;
  -- Expression entière connue (« agent de sécurité ») : ses synonymes s'ajoutent à la recherche
  select s.expansion, s.replace_term into syn from public.search_synonyms s
   where s.term in (u, regexp_replace(u, 's$', '')) limit 1;
  if found then
    phrase := to_tsquery('french', syn.expansion);
  end if;
  words := regexp_split_to_array(u, ' ');
  n := array_length(words, 1);
  for i in 1 .. n loop
    w := words[i];
    lw := w;
    -- Dernier mot assez long : début de mot accepté (« plomb » trouve plomberie)
    if i = n and length(w) >= 3 then
      wq := to_tsquery('french', w || ':*');
    else
      wq := plainto_tsquery('french', w);
    end if;
    if numnode(wq) = 0 then
      continue; -- mot vide (« de », « la »…)
    end if;
    select s.expansion, s.replace_term into syn from public.search_synonyms s
     where s.term in (lw, regexp_replace(lw, 's$', ''), regexp_replace(lw, 'x$', '')) limit 1;
    if found then
      wq := case when syn.replace_term then to_tsquery('french', syn.expansion) else wq || to_tsquery('french', syn.expansion) end;
    end if;
    acc := case when acc is null then wq else acc && wq end;
  end loop;
  if acc is null then
    return coalesce(phrase, q_full);
  end if;
  return case when phrase is null then acc else acc || phrase end;
end;
$$;
