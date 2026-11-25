-- Mesure du référencement : pour chaque provenance (Google, IA, e-mails de veille, direct) et chaque type
-- de page d'arrivée, le nombre de visites puis d'inscriptions (inscrit dont la visite d'inscription a
-- commencé sur cette page). Réservé à l'équipe. Aucune donnée personnelle renvoyée.
create or replace function public.admin_seo_funnel(p_days integer default 30)
returns table(origin text, page_type text, visits bigint, signups bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then
    raise exception 'Action non autorisée' using errcode = '42501';
  end if;
  return query
  with first_view as (
    select distinct on (pv.session_id) pv.session_id, pv.path, lower(coalesce(pv.referrer_host, '')) as ref, lower(coalesce(pv.source, '')) as src
    from public.page_views pv
    where pv.created_at > now() - make_interval(days => greatest(1, least(p_days, 365)))
    order by pv.session_id, pv.created_at
  ),
  typed as (
    select f.session_id,
      case
        when f.ref ~ '(^|\.)google\.' and f.ref not in ('accounts.google.com') then 'Google'
        when f.ref ~ '(^|\.)(bing|duckduckgo|qwant|ecosia|lilo|yahoo)\.' then 'Autres moteurs'
        when f.ref ~ '(chatgpt|openai|perplexity|claude\.ai|gemini|copilot|mistral)' or f.src ~ '(chatgpt|perplexity|claude|gemini|copilot)' then 'ChatGPT et autres IA'
        when f.src in ('veille', 'suivi') then 'E-mails de veille'
        when f.src like 'linkprob2b%' or f.src like 'partage-%' or f.ref ~ '(android\.gm|mail\.|outlook|linkedin|facebook|whatsapp)' then 'E-mails et réseaux'
        else 'Direct et autres'
      end as origin,
      case
        when f.path = '/' then 'Accueil'
        when f.path ~ '^/acheteurs/region/' then 'Acheteurs par région'
        when f.path ~ '^/acheteurs/[^/]+$' then 'Pages acheteurs'
        when f.path ~ '^/titulaires/' then 'Entreprises gagnantes'
        when f.path ~ '^/resultats' then 'Classements des résultats'
        when f.path ~ '^/opportunites/[0-9a-f-]{36}' then 'Fiches d''offres'
        when f.path ~ '^/opportunites/.+' then 'Pages région et métier'
        when f.path ~ '^/(ressources|analyses|faq|comment-ca-marche)' then 'Guides et analyses'
        when f.path ~ '^/(entreprises|disponibilites)' then 'Annuaire et disponibilités'
        when f.path ~ '^/independants' then 'Missions freelance'
        else 'Autres pages'
      end as page_type
    from first_view f
  )
  select t.origin, t.page_type, count(*)::bigint,
         count(u.id)::bigint
  from typed t
  left join public.users u on u.signup_visit = t.session_id
  group by t.origin, t.page_type
  order by count(*) desc;
end;
$$;
revoke all on function public.admin_seo_funnel(integer) from public, anon;
grant execute on function public.admin_seo_funnel(integer) to authenticated;
