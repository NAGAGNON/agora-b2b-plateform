-- =============================================================================
-- LinkProB2B — Pipeline des sources externes, secteurs étendus, alertes et
-- recommandations enrichies, temps réel, séparation démo / réel.
--
-- Chaîne : Source → Collecte → Normalisation → Déduplication → Publication
--          → Mise à jour → Expiration (voir src/lib/collect et docs/SOURCES-EXTERNES.md)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Secteurs supplémentaires (gérables ensuite depuis l'administration)
-- -----------------------------------------------------------------------------
alter table public.sectors add column if not exists is_active boolean not null default true;

insert into public.sectors (slug, label, description, is_pilot_priority, sort_order) values
  ('electricite-automatisme', 'Électricité industrielle et automatisme', 'Électricité industrielle, automatismes, instrumentation, supervision.', true, 8),
  ('energie', 'Énergie', 'Production, distribution, efficacité énergétique, maintenance des installations énergétiques.', false, 9),
  ('batiment-technique', 'Bâtiment technique', 'CVC, plomberie, électricité du bâtiment, maintenance multitechnique des bâtiments.', false, 10),
  ('ingenierie-etudes', 'Ingénierie et bureaux d''études', 'Études techniques, maîtrise d''œuvre, contrôle, assistance technique.', false, 11),
  ('telecoms', 'Télécoms et réseaux', 'Réseaux, téléphonie, fibre, radiocommunications.', false, 12),
  ('nettoyage-proprete', 'Nettoyage et propreté', 'Nettoyage industriel et tertiaire, hygiène, gestion des déchets.', false, 13),
  ('securite-surete', 'Sécurité et sûreté', 'Gardiennage, sécurité incendie, contrôle d''accès, vidéoprotection.', false, 14),
  ('formation', 'Formation professionnelle', 'Formation technique, sécurité, habilitations, management.', false, 15),
  ('conseil', 'Conseil aux entreprises', 'Conseil, audit, accompagnement, assistance à maîtrise d''ouvrage.', false, 16)
on conflict (slug) do nothing;

create policy sectors_admin_write on public.sectors for all using (public.is_admin()) with check (public.is_admin());
grant insert (slug, label, description, is_pilot_priority, sort_order, is_active),
  update (label, description, is_pilot_priority, sort_order, is_active) on public.sectors to authenticated;

-- Correspondance NUTS (TED) → département
alter table public.departments add column if not exists nuts3 text;
update public.departments set nuts3 = case code
  when '22' then 'FRH01' when '29' then 'FRH02' when '35' then 'FRH03' when '56' then 'FRH04' end
where code in ('22', '29', '35', '56');

-- -----------------------------------------------------------------------------
-- Sources : configuration de collecte et suivi
-- -----------------------------------------------------------------------------
alter table public.external_sources
  add column if not exists code text unique,
  add column if not exists connector text not null default 'manual'
    check (connector in ('manual', 'boamp', 'ted', 'ods-generic')),
  add column if not exists config jsonb not null default '{}'::jsonb,
  add column if not exists is_active boolean not null default false,
  add column if not exists sync_frequency text not null default 'daily' check (sync_frequency in ('hourly', 'daily', 'weekly')),
  add column if not exists last_sync_at timestamptz,
  add column if not exists last_success_at timestamptz,
  add column if not exists next_sync_at timestamptz,
  add column if not exists last_error text,
  add column if not exists attribution text;

create table public.source_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.external_sources (id) on delete cascade,
  trigger text not null default 'cron' check (trigger in ('cron', 'manual', 'test')),
  triggered_by uuid references public.users (id) on delete set null,
  status text not null default 'RUNNING' check (status in ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  fetched int not null default 0,
  created int not null default 0,
  updated int not null default 0,
  unchanged int not null default 0,
  duplicates int not null default 0,
  skipped int not null default 0,
  expired int not null default 0,
  errors jsonb not null default '[]'::jsonb,
  sample jsonb
);
create index source_sync_runs_source_idx on public.source_sync_runs (source_id, started_at desc);
alter table public.source_sync_runs enable row level security;
revoke insert, update, delete, truncate on public.source_sync_runs from anon, authenticated;
create policy source_sync_runs_select on public.source_sync_runs for select using (public.is_staff());

-- Une opportunité peut être publiée par plusieurs sources (déduplication).
alter table public.opportunity_sources drop constraint opportunity_sources_pkey;
alter table public.opportunity_sources
  add column if not exists is_primary boolean not null default true,
  add column if not exists content_hash text,
  add column if not exists source_updated_at timestamptz;
alter table public.opportunity_sources add primary key (opportunity_id, source_id);
create index opportunity_sources_source_idx on public.opportunity_sources (source_id);

alter table public.opportunities
  add column if not exists dedup_key text,
  add column if not exists external_reference text,
  add column if not exists cpv_codes text[] not null default '{}';
create index opportunities_dedup_idx on public.opportunities (dedup_key) where dedup_key is not null;

-- Sources officielles (licences vérifiées, voir docs/SOURCES-EXTERNES.md)
update public.external_sources set
  code = 'boamp',
  connector = 'boamp',
  status = 'APPROVED',
  is_active = true,
  legal_validated_at = now(),
  license = 'Licence Ouverte / Open Licence 2.0 (Etalab) — réutilisation libre, y compris commerciale, avec mention de la source',
  terms_url = 'https://www.data.gouv.fr/dataservices/api-bulletin-officiel-des-annonces-des-marches-publics-boamp',
  attribution = 'Source : BOAMP — Direction de l''information légale et administrative (DILA)',
  config = '{"departments": ["22", "29", "35", "56"], "lookbackDays": 21, "maxRecords": 1000}'::jsonb,
  notes = 'Licence Ouverte 2.0 indiquée sur data.gouv.fr. API Opendatasoft de la DILA, sans clé. Validation juridique formelle recommandée avant lancement public.'
where name = 'BOAMP';

update public.external_sources set
  code = 'ted',
  connector = 'ted',
  status = 'APPROVED',
  is_active = true,
  legal_validated_at = now(),
  license = 'Avis du Supplément au JOUE librement réutilisables, y compris commercialement (mentions légales TED) ; contenus éditoriaux CC BY 4.0',
  terms_url = 'https://ted.europa.eu/en/legal-notice',
  attribution = 'Source : TED — Office des publications de l''Union européenne',
  config = '{"country": "FRA", "nuts": ["FRH01", "FRH02", "FRH03", "FRH04"], "lookbackDays": 21, "maxRecords": 500, "fields": ["publication-number", "notice-title", "buyer-name", "publication-date", "deadline-receipt-tender-date-lot", "place-of-performance", "classification-cpv", "contract-nature"]}'::jsonb,
  notes = 'API de recherche v3 anonyme. Validation juridique formelle recommandée avant lancement public.'
where name = 'TED';

insert into public.external_sources (code, name, base_url, description, license, terms_url, status, import_method, connector, is_active, attribution, config, notes) values
  ('approch', 'APProch — projets d''achats publics', 'https://projets-achats.marches-publics.gouv.fr',
   'Projets d''achats publics à venir publiés par les acheteurs des trois fonctions publiques (Direction des Achats de l''État).',
   'Licence ouverte (jeu de données « Projets d''achats publics » sur data.gouv.fr / data.economie.gouv.fr) — à confirmer',
   'https://www.data.gouv.fr/datasets/projets-dachats-publics', 'LEGAL_REVIEW', 'API', 'ods-generic', false,
   'Source : APProch — Direction des Achats de l''État',
   '{"baseUrl": "https://data.economie.gouv.fr", "dataset": "projets-dachats-publics", "type": "EXTERNAL_OPPORTUNITY", "fieldMap": {"id": "id", "title": "objet", "buyer": "acheteur", "published": "date_publication", "deadline": "date_previsionnelle_lancement", "department": "departement", "cpv": "code_s_cpv", "url": "url"}}'::jsonb,
   'Correspondance des champs à vérifier par une collecte de test avant activation (projets d''achats prévisionnels, non engageants).')
on conflict (name) do nothing;

-- -----------------------------------------------------------------------------
-- Recherche : source principale unique (pas de doublons de lignes) et
-- exclusion possible des données de démonstration
-- -----------------------------------------------------------------------------
drop function if exists public.search_opportunities(text, text, text, text, int, public.opportunity_type[], text, public.opportunity_origin, date, date, public.company_size, text[], text, int, int);

create or replace function public.search_opportunities(
  p_q text default null,
  p_sector text default null,
  p_department text default null,
  p_place text default null,
  p_radius_km int default null,
  p_types public.opportunity_type[] default null,
  p_status text default 'OPEN',
  p_origin public.opportunity_origin default null,
  p_published_since date default null,
  p_deadline_before date default null,
  p_company_size public.company_size default null,
  p_skills text[] default null,
  p_sort text default 'recent',
  p_limit int default 12,
  p_offset int default 0,
  p_include_demo boolean default true
) returns table (
  id uuid, title text, summary text, type public.opportunity_type, origin public.opportunity_origin,
  status public.opportunity_status, effective_status text, visibility public.opportunity_visibility,
  sector_slug text, city text, department_code text, budget_min numeric, budget_max numeric,
  budget_visible boolean, response_deadline timestamptz, published_at timestamptz, skills text[],
  company_id uuid, company_name text, company_slug text, company_verified boolean,
  external_buyer_name text, source_name text, is_demo boolean, distance_km double precision,
  rank real, total_count bigint
) language sql stable security invoker set search_path = '' as $$
  with center as (
    select p.lat, p.lng from public.places p where p.slug = p_place limit 1
  ),
  q as (
    select case when coalesce(trim(p_q), '') = '' then null
                else websearch_to_tsquery('french', p_q) end as tsq
  ),
  base as (
    select o.*,
      case
        when o.status = 'PUBLISHED' and o.response_deadline is not null and o.response_deadline < now() then 'EXPIRED'
        else o.status::text
      end as eff_status,
      case when (select lat from center) is not null and o.lat is not null then
        6371 * 2 * asin(sqrt(
          power(sin(radians(o.lat - (select lat from center)) / 2), 2) +
          cos(radians((select lat from center))) * cos(radians(o.lat)) *
          power(sin(radians(o.lng - (select lng from center)) / 2), 2)
        ))
      end as dist
    from public.opportunities o
    where o.status in ('PUBLISHED', 'CLOSED', 'EXPIRED')
      and (p_include_demo or not o.is_demo)
  ),
  filtered as (
    select b.*, c.name as c_name, c.slug as c_slug, (c.verified_at is not null) as c_verified, c.size as c_size,
      src.name as s_name,
      case when (select tsq from q) is null then 0 else ts_rank(b.search_vector, (select tsq from q)) end as rnk
    from base b
    left join public.companies c on c.id = b.company_id
    left join lateral (
      select es.name from public.opportunity_sources os
      join public.external_sources es on es.id = os.source_id
      where os.opportunity_id = b.id
      order by os.is_primary desc, os.imported_at
      limit 1
    ) src on true
    where (b.company_id is null or c.id is not null)
      and ((select tsq from q) is null or b.search_vector @@ (select tsq from q))
      and (p_sector is null or b.sector_slug = p_sector)
      and (p_department is null or b.department_code = p_department)
      and (p_types is null or cardinality(p_types) = 0 or b.type = any (p_types))
      and (p_origin is null or b.origin = p_origin)
      and (p_published_since is null or b.published_at >= p_published_since)
      and (p_deadline_before is null or b.response_deadline <= (p_deadline_before + 1))
      and (p_company_size is null or b.target_company_size = p_company_size or c.size = p_company_size)
      and (p_skills is null or cardinality(p_skills) = 0 or b.skills && p_skills)
      and (
        p_status is null or p_status = 'ALL'
        or (p_status = 'OPEN' and b.eff_status = 'PUBLISHED')
        or (p_status = 'CLOSED' and b.eff_status in ('CLOSED', 'EXPIRED'))
      )
      and (p_radius_km is null or (select lat from center) is null or (b.dist is not null and b.dist <= p_radius_km))
  )
  select f.id, f.title, f.summary, f.type, f.origin, f.status, f.eff_status, f.visibility, f.sector_slug, f.city,
    f.department_code,
    case when f.budget_visible then f.budget_min end, case when f.budget_visible then f.budget_max end,
    f.budget_visible, f.response_deadline, f.published_at, f.skills, f.company_id, f.c_name, f.c_slug,
    coalesce(f.c_verified, false), f.external_buyer_name, f.s_name, f.is_demo, f.dist, f.rnk,
    count(*) over () as total_count
  from filtered f
  order by
    case when p_sort = 'relevance' then f.rnk end desc nulls last,
    case when p_sort = 'deadline' then f.response_deadline end asc nulls last,
    case when p_sort = 'distance' then f.dist end asc nulls last,
    f.published_at desc nulls last,
    f.id
  limit least(greatest(coalesce(p_limit, 12), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- -----------------------------------------------------------------------------
-- Alertes enrichies : rayon autour d'une ville, compétences, taille
-- -----------------------------------------------------------------------------
alter table public.alerts
  add column if not exists place_slug text references public.places (slug) on delete set null,
  add column if not exists radius_km int check (radius_km is null or radius_km between 1 and 500),
  add column if not exists skills text[] not null default '{}',
  add column if not exists company_size public.company_size,
  add column if not exists include_external boolean not null default true;
grant insert (place_slug, radius_km, skills, company_size, include_external),
  update (place_slug, radius_km, skills, company_size, include_external) on public.alerts to authenticated;

create or replace function public.distance_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable set search_path = '' as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

create or replace function public.opportunity_matches_alert(p_opportunity_id uuid, p_alert_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.opportunities o
    cross join public.alerts a
    left join public.places pl on pl.slug = a.place_slug
    where o.id = p_opportunity_id and a.id = p_alert_id
      and o.status = 'PUBLISHED'
      and not o.is_demo
      and (a.include_external or o.origin = 'INTERNAL')
      and (a.sector_slug is null or a.sector_slug = o.sector_slug)
      and (a.department_code is null or a.department_code = o.department_code)
      and (a.type is null or a.type = o.type)
      and (a.company_size is null or o.target_company_size is null or o.target_company_size = a.company_size)
      and (cardinality(a.skills) = 0 or o.skills && a.skills
           or exists (select 1 from unnest(a.skills) sk where o.search_vector @@ plainto_tsquery('french', sk)))
      and (pl.id is null or a.radius_km is null
           or (o.lat is not null and public.distance_km(pl.lat, pl.lng, o.lat, o.lng) <= a.radius_km))
      and (a.keywords is null or trim(a.keywords) = '' or o.search_vector @@ websearch_to_tsquery('french', a.keywords))
  );
$$;

-- Les alertes immédiates ignorent désormais les données de démonstration
-- (opportunity_matches_alert filtre is_demo).

-- -----------------------------------------------------------------------------
-- Recommandations expliquées (score par critère)
-- -----------------------------------------------------------------------------
drop function if exists public.recommended_opportunities(uuid, int);

create or replace function public.recommended_opportunities(p_company_id uuid, p_limit int default 6, p_include_demo boolean default true)
returns table (id uuid, title text, type public.opportunity_type, origin public.opportunity_origin,
  sector_slug text, city text, response_deadline timestamptz, published_at timestamptz, is_demo boolean,
  score int, reasons text[])
language sql stable security invoker set search_path = '' as $$
  with me as (
    select c.department_code, c.lat, c.lng, c.size, p.sectors, p.skills,
      coalesce(p.intervention_radius_km, 80) as radius
    from public.companies c join public.company_profiles p on p.company_id = c.id
    where c.id = p_company_id and public.is_company_member(p_company_id)
  ),
  history as (
    -- Secteurs des opportunités mises en favori ou ayant suscité un intérêt
    select array_agg(distinct o.sector_slug) filter (where o.sector_slug is not null) as sectors
    from public.opportunities o
    where o.id in (
      select f.opportunity_id from public.favorites f where f.user_id = auth.uid() and f.opportunity_id is not null
      union select i.opportunity_id from public.interests i where i.company_id = p_company_id
      union select pi.opportunity_id from public.pipeline_items pi where pi.company_id = p_company_id
    )
  ),
  scored as (
    select o.*,
      (o.sector_slug = any (me.sectors)) as m_sector,
      (o.department_code = me.department_code) as m_dept,
      (me.lat is not null and o.lat is not null and public.distance_km(me.lat, me.lng, o.lat, o.lng) <= me.radius) as m_zone,
      coalesce(cardinality(array(select unnest(o.skills) intersect select unnest(me.skills))), 0) as n_skills,
      exists (select 1 from unnest(me.skills) sk where o.search_vector @@ plainto_tsquery('french', sk)) as m_keywords,
      (o.sector_slug = any (coalesce((select sectors from history), '{}'))) as m_history,
      (o.target_company_size is not null and o.target_company_size = me.size) as m_size
    from public.opportunities o, me
    where o.status = 'PUBLISHED'
      and (p_include_demo or not o.is_demo)
      and (o.response_deadline is null or o.response_deadline > now())
      and (o.company_id is null or o.company_id <> p_company_id)
      and not exists (select 1 from public.interests i where i.opportunity_id = o.id and i.company_id = p_company_id)
  )
  select s.id, s.title, s.type, s.origin, s.sector_slug, s.city, s.response_deadline, s.published_at, s.is_demo,
    (case when s.m_sector then 30 else 0 end
     + case when s.m_zone then 25 when s.m_dept then 15 else 0 end
     + least(s.n_skills * 10, 30)
     + case when s.m_keywords and s.n_skills = 0 then 10 else 0 end
     + case when s.m_history then 10 else 0 end
     + case when s.m_size then 5 else 0 end)::int as score,
    array_remove(array[
      case when s.m_sector then 'Votre secteur' end,
      case when s.m_zone then 'Dans votre zone d''intervention' when s.m_dept then 'Votre département' end,
      case when s.n_skills > 0 then s.n_skills || ' compétence(s) commune(s)' end,
      case when s.m_keywords and s.n_skills = 0 then 'Mots-clés de vos compétences' end,
      case when s.m_history then 'Proche de vos favoris et intérêts' end,
      case when s.m_size then 'Taille d''entreprise visée' end
    ], null) as reasons
  from scored s
  where s.m_sector or s.m_dept or s.m_zone or s.n_skills > 0 or s.m_keywords
  order by score desc, s.published_at desc
  limit least(greatest(coalesce(p_limit, 6), 1), 30);
$$;

-- -----------------------------------------------------------------------------
-- Statistiques d'administration : ajout du suivi des sources
-- -----------------------------------------------------------------------------
create or replace function public.admin_source_stats()
returns table (source_id uuid, published bigint, expired bigint, total bigint)
language sql stable security definer set search_path = '' as $$
  select os.source_id,
    count(*) filter (where o.status = 'PUBLISHED' and (o.response_deadline is null or o.response_deadline >= now())),
    count(*) filter (where o.status = 'EXPIRED' or (o.status = 'PUBLISHED' and o.response_deadline < now())),
    count(*)
  from public.opportunity_sources os join public.opportunities o on o.id = os.opportunity_id
  where public.is_staff()
  group by os.source_id;
$$;

-- Expiration étendue : opportunités externes sans date limite non revues depuis 60 jours
create or replace function public.expire_opportunities()
returns int language plpgsql security definer set search_path = '' as $$
declare v_count int; v_stale int;
begin
  perform public.trusted();
  update public.opportunities set status = 'EXPIRED'
  where status = 'PUBLISHED' and response_deadline is not null and response_deadline < now();
  get diagnostics v_count = row_count;
  update public.opportunities o set status = 'EXPIRED'
  where o.status = 'PUBLISHED' and o.origin = 'EXTERNAL' and o.response_deadline is null
    and not exists (
      select 1 from public.opportunity_sources s
      where s.opportunity_id = o.id and coalesce(s.last_verified_at, s.imported_at) > now() - interval '60 days'
    );
  get diagnostics v_stale = row_count;
  return v_count + v_stale;
end;
$$;
revoke execute on function public.expire_opportunities() from public, anon, authenticated;
grant execute on function public.expire_opportunities() to service_role;

-- -----------------------------------------------------------------------------
-- Temps réel : messages et notifications (la RLS s'applique aux abonnements)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.notifications;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Démarrage : promotion du premier super administrateur (INITIAL_ADMIN_EMAIL)
-- Appelée par le serveur avec la clé service, uniquement s'il n'existe
-- encore aucun super administrateur.
-- -----------------------------------------------------------------------------
create or replace function public.bootstrap_super_admin(p_email text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if exists (select 1 from public.users where platform_role = 'SUPER_ADMIN' and status = 'ACTIVE' and not is_demo) then
    return false;
  end if;
  select id into v_id from public.users where lower(email) = lower(trim(p_email)) and status = 'ACTIVE';
  if v_id is null then return false; end if;
  update public.users set platform_role = 'SUPER_ADMIN' where id = v_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (v_id, 'admin.bootstrap', 'user', v_id::text, '{}'::jsonb);
  return true;
end;
$$;
revoke execute on function public.bootstrap_super_admin(text) from public, anon, authenticated;
grant execute on function public.bootstrap_super_admin(text) to service_role;

-- -----------------------------------------------------------------------------
-- Géolocalisation approximative au chef-lieu de référence du département
-- lorsque seule la localisation départementale est connue (ex. annonces BOAMP),
-- afin que la recherche par rayon inclue ces opportunités.
-- -----------------------------------------------------------------------------
create or replace function public.fill_location()
returns trigger language plpgsql set search_path = '' as $$
declare pl public.places;
begin
  if new.city is not null or new.postal_code is not null then
    if tg_op = 'INSERT'
       or new.city is distinct from old.city
       or new.postal_code is distinct from old.postal_code
       or new.lat is null then
      pl := public.resolve_place(new.city, new.postal_code);
      if pl.id is not null then
        new.lat := pl.lat;
        new.lng := pl.lng;
        new.department_code := coalesce(new.department_code, pl.department_code);
        new.region := coalesce(new.region, pl.region);
        if new.postal_code is null then new.postal_code := pl.postal_code; end if;
      end if;
    end if;
  end if;
  if new.lat is null and new.department_code is not null then
    select p.* into pl from public.places p where p.department_code = new.department_code order by p.id limit 1;
    if pl.id is not null then
      new.lat := pl.lat;
      new.lng := pl.lng;
    end if;
  end if;
  if new.department_code is not null and new.region is null then
    select d.region into new.region from public.departments d where d.code = new.department_code;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Réglages de collecte d'une source (administrateurs)
-- -----------------------------------------------------------------------------
create or replace function public.admin_update_source_settings(
  p_id uuid, p_is_active boolean, p_sync_frequency text, p_config jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_admin(); s record;
begin
  select * into s from public.external_sources where id = p_id;
  if s.id is null then raise exception 'Source introuvable' using errcode = 'P0002'; end if;
  if p_is_active and s.status <> 'APPROVED' then
    raise exception 'Seule une source approuvée (validation juridique) peut être activée' using errcode = '22023';
  end if;
  if p_sync_frequency not in ('hourly', 'daily', 'weekly') then
    raise exception 'Fréquence invalide' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_config, '{}'::jsonb)) <> 'object' then
    raise exception 'La configuration doit être un objet JSON' using errcode = '22023';
  end if;
  update public.external_sources set is_active = p_is_active, sync_frequency = p_sync_frequency,
    config = coalesce(p_config, '{}'::jsonb), next_sync_at = case when p_is_active then coalesce(next_sync_at, now()) else null end
  where id = p_id;
  perform public.log_audit('admin.source_settings', 'external_source', p_id::text,
    jsonb_build_object('is_active', p_is_active, 'sync_frequency', p_sync_frequency));
end;
$$;
