-- Mise en relation des besoins : entreprises inscrites dont la description d'activité recoupe le
-- besoin (mots communs du titre, du résumé, des compétences et mots-clés), en plus du secteur et des
-- compétences déclarées. Seules les données réellement renseignées comptent.
create or replace function public.need_member_candidates(p_opportunity_id uuid, p_limit int default 50)
returns table (company_id uuid, name text, score int, reasons text[], members int)
language sql stable security definer set search_path = '' as $$
  with o as (
    select op.*, (select d.region from public.departments d where d.code = op.department_code) as dep_region,
      to_tsvector('french', concat_ws(' ', op.title, op.summary, array_to_string(op.skills, ' '), array_to_string(op.keywords, ' '))) as need_vec
    from public.opportunities op where op.id = p_opportunity_id
  ),
  scored as (
    select c.id, c.name, c.size, p.sectors, p.skills,
      (o.sector_slug is not null and o.sector_slug = any (p.sectors)) as m_sector,
      (o.department_code is not null and c.department_code = o.department_code) as m_dept,
      (coalesce(o.region, o.dep_region) is not null and (select d.region from public.departments d where d.code = c.department_code) = coalesce(o.region, o.dep_region)) as m_region,
      (c.lat is not null and o.lat is not null and public.distance_km(c.lat, c.lng, o.lat, o.lng) <= coalesce(p.intervention_radius_km, 80)) as m_zone,
      (p.intervention_zone ~* '(france|national|toute la france|hexagone)') as m_national,
      coalesce(cardinality(array(select lower(unnest(o.skills)) intersect select lower(unnest(p.skills)))), 0) as n_skills,
      exists (select 1 from unnest(p.skills) sk where length(trim(sk)) >= 3 and o.search_vector @@ plainto_tsquery('french', sk)) as m_keywords,
      (select count(*) from (
         select unnest(tsvector_to_array(o.need_vec)) w
         intersect
         select unnest(tsvector_to_array(p.search_vector))
       ) x where length(x.w) >= 4)::int as n_words,
      (o.target_company_size is not null and o.target_company_size = c.size) as m_size,
      (select count(*) from public.company_members m join public.users u on u.id = m.user_id and u.status = 'ACTIVE' where m.company_id = c.id)::int as members
    from public.companies c
    join public.company_profiles p on p.company_id = c.id
    cross join o
    where c.id <> o.company_id
      and c.is_demo = false
      and c.status = 'ACTIVE'
      and c.kind in ('SUPPLIER', 'BOTH')
      and not exists (select 1 from public.interests i where i.opportunity_id = o.id and i.company_id = c.id and i.status <> 'WITHDRAWN')
      and not exists (select 1 from public.proposals pr where pr.opportunity_id = o.id and pr.company_id = c.id)
  )
  select s.id, s.name,
    (case when s.m_sector then 35 else 0 end
     + case when s.m_zone then 25 when s.m_dept then 20 when s.m_region then 12 when s.m_national then 8 else 0 end
     + least(s.n_skills * 10, 30)
     + case when s.m_keywords and s.n_skills = 0 then 12 else 0 end
     + case when s.n_words >= 3 then least(s.n_words * 7, 35) else 0 end
     + case when s.m_size then 5 else 0 end)::int as score,
    array_remove(array[
      case when s.m_sector then 'Même secteur d''activité' end,
      case when s.m_zone then 'Dans sa zone d''intervention' when s.m_dept then 'Même département' when s.m_region then 'Même région' when s.m_national then 'Intervient dans toute la France' end,
      case when s.n_skills > 0 then s.n_skills || ' compétence(s) demandée(s) dans son profil' end,
      case when s.m_keywords and s.n_skills = 0 then 'Ses compétences apparaissent dans la description du besoin' end,
      case when s.n_words >= 3 then s.n_words || ' termes du besoin dans la présentation de son activité' end,
      case when s.m_size then 'Taille d''entreprise visée' end
    ], null) as reasons,
    s.members
  from scored s
  -- Activité d'abord : sans secteur, compétence ni vocabulaire en commun, la seule proximité ne suffit pas
  where (s.m_sector or s.n_skills > 0 or s.m_keywords or s.n_words >= 3) and s.members > 0
  order by score desc, s.name
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;
revoke execute on function public.need_member_candidates(uuid, int) from public, anon, authenticated;
grant execute on function public.need_member_candidates(uuid, int) to service_role;
