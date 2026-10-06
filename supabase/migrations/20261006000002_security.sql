-- =============================================================================
-- LinkProB2B — Sécurité : fonctions d'aide, déclencheurs, Row Level Security,
-- droits par colonne et stockage de fichiers.
--
-- Principe : chaque table a la RLS activée. Les écritures sensibles
-- (création d'entreprise, intérêt, réponse, modération...) passent par des
-- fonctions RPC « security definer » qui vérifient elles-mêmes les droits
-- (voir migration 3). Les clients ne peuvent jamais modifier un rôle,
-- un statut de modération ou un journal d'audit directement.
-- =============================================================================

-- Évaluation pour les opportunités : notes privées de l'acheteur, invisibles
-- du fournisseur (séparées de proposals pour pouvoir appliquer la RLS).
create table public.proposal_evaluations (
  proposal_id uuid primary key references public.proposals (id) on delete cascade,
  buyer_company_id uuid not null references public.companies (id) on delete cascade,
  score int check (score is null or score between 0 and 5),
  note text check (note is null or char_length(note) <= 5000),
  updated_by uuid references public.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.companies
  add constraint companies_verified_by_fk foreign key (verified_by) references public.users (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Fonctions d'aide (security definer : contournent la RLS pour éviter la
-- récursion, ne renvoient que des booléens / identifiants).
-- -----------------------------------------------------------------------------
create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.users u where u.id = auth.uid() and u.status = 'ACTIVE'
  );
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.status = 'ACTIVE'
      and u.platform_role in ('MODERATOR', 'ADMIN', 'SUPER_ADMIN')
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.status = 'ACTIVE'
      and u.platform_role in ('ADMIN', 'SUPER_ADMIN')
  );
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.status = 'ACTIVE' and u.platform_role = 'SUPER_ADMIN'
  );
$$;

create or replace function public.is_company_member(p_company_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_company_id is not null and exists (
    select 1 from public.company_members m
    join public.users u on u.id = m.user_id
    where m.company_id = p_company_id and m.user_id = auth.uid() and u.status = 'ACTIVE'
  );
$$;

create or replace function public.is_company_admin(p_company_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_company_id is not null and exists (
    select 1 from public.company_members m
    join public.users u on u.id = m.user_id
    where m.company_id = p_company_id and m.user_id = auth.uid()
      and m.role = 'COMPANY_ADMIN' and u.status = 'ACTIVE'
  );
$$;

create or replace function public.my_company_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select m.company_id from public.company_members m where m.user_id = auth.uid();
$$;

-- Une opportunité est visible si publiée/close/expirée (et selon la visibilité),
-- ou si l'utilisateur appartient à l'entreprise qui l'a publiée, ou s'il est staff.
create or replace function public.can_view_opportunity(p_opportunity_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.opportunities o
    left join public.companies c on c.id = o.company_id
    where o.id = p_opportunity_id
      and (
        (
          o.status in ('PUBLISHED', 'CLOSED', 'EXPIRED')
          and (o.visibility = 'PUBLIC' or auth.uid() is not null)
          and (o.company_id is null or c.status = 'ACTIVE')
        )
        or public.is_company_member(o.company_id)
        or public.is_staff()
      )
  );
$$;

create or replace function public.is_opportunity_owner(p_opportunity_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.opportunities o
    where o.id = p_opportunity_id and public.is_company_member(o.company_id)
  );
$$;

create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and (public.is_company_member(c.buyer_company_id) or public.is_company_member(c.supplier_company_id))
  );
$$;

create or replace function public.can_view_proposal(p_proposal_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.proposals p
    join public.opportunities o on o.id = p.opportunity_id
    where p.id = p_proposal_id
      and (public.is_company_member(p.company_id) or public.is_company_member(o.company_id))
  );
$$;

-- Indicateur de contexte : les RPC de confiance l'activent pour autoriser des
-- transitions de statut normalement interdites aux utilisateurs.
create or replace function public.in_trusted_context()
returns boolean language sql stable set search_path = '' as $$
  select coalesce(current_setting('linkpro.trusted', true), '') = 'on';
$$;

-- -----------------------------------------------------------------------------
-- Déclencheurs génériques
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'users', 'companies', 'company_profiles', 'external_sources', 'opportunities',
    'interests', 'proposals', 'pipeline_items'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_set_updated_at', t
    );
  end loop;
end $$;

-- Création automatique du profil utilisateur à l'inscription.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users (id, email, full_name, terms_accepted_at, marketing_consent)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(left(new.raw_user_meta_data ->> 'full_name', 120), ''),
    case when (new.raw_user_meta_data ->> 'terms_accepted') = 'true' then now() else null end,
    coalesce((new.raw_user_meta_data ->> 'marketing_consent') = 'true', false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.handle_auth_user_email_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update public.users set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_auth_user_email_change();

-- Géolocalisation approximative à partir du référentiel de communes.
create or replace function public.resolve_place(p_city text, p_postal_code text)
returns public.places language sql stable set search_path = '' as $$
  select p.* from public.places p
  where (p_city is not null and lower(p.name) = lower(trim(p_city)))
     or (p_postal_code is not null and p.postal_code = trim(p_postal_code))
  order by (p_city is not null and lower(p.name) = lower(trim(p_city))) desc
  limit 1;
$$;

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
  if new.department_code is not null and new.region is null then
    select d.region into new.region from public.departments d where d.code = new.department_code;
  end if;
  return new;
end;
$$;

create trigger companies_fill_location before insert or update on public.companies
  for each row execute function public.fill_location();
create trigger opportunities_fill_location before insert or update on public.opportunities
  for each row execute function public.fill_location();

-- Index plein texte des opportunités (configuration française).
create or replace function public.opportunities_search_vector()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.search_vector :=
    setweight(to_tsvector('french', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('french', array_to_string(new.skills, ' ') || ' ' || array_to_string(new.keywords, ' ')), 'B') ||
    setweight(to_tsvector('french', coalesce(new.summary, '') || ' ' || coalesce(new.external_buyer_name, '') || ' ' || coalesce(new.city, '')), 'B') ||
    setweight(to_tsvector('french', coalesce(new.description, '') || ' ' || coalesce(new.services, '')), 'C');
  return new;
end;
$$;

create trigger opportunities_search before insert or update on public.opportunities
  for each row execute function public.opportunities_search_vector();

create or replace function public.company_profiles_search_vector()
returns trigger language plpgsql set search_path = '' as $$
declare c record;
begin
  select name, city into c from public.companies where id = new.company_id;
  new.search_vector :=
    setweight(to_tsvector('french', coalesce(c.name, '')), 'A') ||
    setweight(to_tsvector('french', array_to_string(new.skills, ' ') || ' ' || coalesce(new.tagline, '')), 'B') ||
    setweight(to_tsvector('french', coalesce(new.description, '') || ' ' || array_to_string(new.certifications, ' ') || ' ' || coalesce(c.city, '')), 'C');
  return new;
end;
$$;

create trigger company_profiles_search before insert or update on public.company_profiles
  for each row execute function public.company_profiles_search_vector();

create or replace function public.companies_touch_profile()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.name is distinct from old.name or new.city is distinct from old.city then
    update public.company_profiles set updated_at = now() where company_id = new.id;
  end if;
  return new;
end;
$$;

create trigger companies_touch_profile after update on public.companies
  for each row execute function public.companies_touch_profile();

-- -----------------------------------------------------------------------------
-- Cycle de vie d'une opportunité (appliqué côté base, pas seulement dans l'UI)
--   DRAFT → PENDING_REVIEW → PUBLISHED → CLOSED / EXPIRED → ARCHIVED
--   Le passage à PUBLISHED, REJECTED, CHANGES_REQUESTED et SUSPENDED est
--   réservé à la modération (RPC de confiance).
-- -----------------------------------------------------------------------------
create or replace function public.opportunity_owner_transition_allowed(
  p_from public.opportunity_status, p_to public.opportunity_status
) returns boolean language sql immutable set search_path = '' as $$
  select p_from = p_to or (p_from, p_to) in (
    ('DRAFT'::public.opportunity_status, 'PENDING_REVIEW'::public.opportunity_status),
    ('DRAFT', 'ARCHIVED'),
    ('PENDING_REVIEW', 'DRAFT'),
    ('CHANGES_REQUESTED', 'PENDING_REVIEW'),
    ('CHANGES_REQUESTED', 'DRAFT'),
    ('CHANGES_REQUESTED', 'ARCHIVED'),
    ('REJECTED', 'DRAFT'),
    ('REJECTED', 'ARCHIVED'),
    ('PUBLISHED', 'CLOSED'),
    ('PUBLISHED', 'PENDING_REVIEW'),
    ('EXPIRED', 'CLOSED'),
    ('EXPIRED', 'ARCHIVED'),
    ('CLOSED', 'ARCHIVED')
  );
$$;

create or replace function public.enforce_opportunity_rules()
returns trigger language plpgsql set search_path = '' as $$
declare
  content_changed boolean;
begin
  -- Contexte serveur (service_role, migrations, RPC de confiance) : pas de restriction.
  if auth.uid() is null or public.in_trusted_context() then
    if new.status = 'PUBLISHED' and new.published_at is null then new.published_at := now(); end if;
    if new.status = 'CLOSED' and new.closed_at is null then new.closed_at := now(); end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.origin <> 'INTERNAL' or new.status not in ('DRAFT', 'PENDING_REVIEW') then
      raise exception 'Création non autorisée pour ce statut ou cette origine' using errcode = '42501';
    end if;
    new.published_at := null;
    new.closed_at := null;
    new.moderation_note := null;
    new.outcome := null;
    new.selected_proposal_id := null;
    new.duplicate_of := null;
    new.is_demo := false;
    new.created_by := auth.uid();
    return new;
  end if;

  -- UPDATE par un membre de l'entreprise : champs protégés.
  if new.company_id is distinct from old.company_id
     or new.origin is distinct from old.origin
     or new.created_by is distinct from old.created_by
     or new.published_at is distinct from old.published_at
     or new.moderation_note is distinct from old.moderation_note
     or new.is_demo is distinct from old.is_demo
     or new.duplicate_of is distinct from old.duplicate_of
     or new.type is distinct from old.type and old.status not in ('DRAFT', 'CHANGES_REQUESTED', 'REJECTED') then
    raise exception 'Modification d''un champ protégé non autorisée' using errcode = '42501';
  end if;

  if old.status in ('SUSPENDED', 'ARCHIVED') then
    raise exception 'Cette opportunité ne peut plus être modifiée' using errcode = '42501';
  end if;

  -- Un besoin publié dont le contenu change repasse en validation.
  content_changed := new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.summary is distinct from old.summary
    or new.budget_min is distinct from old.budget_min
    or new.budget_max is distinct from old.budget_max;
  if old.status = 'PUBLISHED' and new.status = 'PUBLISHED' and content_changed then
    new.status := 'PENDING_REVIEW';
  end if;

  if not public.opportunity_owner_transition_allowed(old.status, new.status) then
    raise exception 'Transition de statut non autorisée : % → %', old.status, new.status using errcode = '42501';
  end if;

  -- La clôture et le résultat se gèrent via close_opportunity().
  if new.outcome is distinct from old.outcome or new.selected_proposal_id is distinct from old.selected_proposal_id then
    raise exception 'Utilisez la clôture de consultation pour indiquer le résultat' using errcode = '42501';
  end if;

  if new.status = 'CLOSED' and new.closed_at is null then new.closed_at := now(); end if;
  return new;
end;
$$;

create trigger opportunities_enforce_rules before insert or update on public.opportunities
  for each row execute function public.enforce_opportunity_rules();

-- -----------------------------------------------------------------------------
-- Activation de la RLS sur toutes les tables publiques
-- -----------------------------------------------------------------------------
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- Par défaut, on retire toutes les écritures aux rôles API ; on ne rouvre que
-- ce qui est nécessaire, table par table.
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
revoke all on public.email_outbox, public.rate_limits from anon, authenticated;

-- Référentiels : lecture publique
create policy sectors_read on public.sectors for select using (true);
create policy opportunity_types_read on public.opportunity_types for select using (true);
create policy places_read on public.places for select using (true);
create policy departments_read on public.departments for select using (true);
create policy plans_read on public.plans for select using (true);

-- users
create policy users_select on public.users for select using (
  id = auth.uid()
  or public.is_staff()
  or exists (
    select 1 from public.company_members m1
    join public.company_members m2 on m1.company_id = m2.company_id
    where m1.user_id = auth.uid() and m2.user_id = users.id
  )
);
create policy users_update_self on public.users for update
  using (id = auth.uid()) with check (id = auth.uid());
grant update (full_name, job_title, phone, marketing_consent, notify_email, last_seen_at)
  on public.users to authenticated;

-- companies
create policy companies_select on public.companies for select using (
  status = 'ACTIVE' or public.is_company_member(id) or public.is_staff()
);
create policy companies_update on public.companies for update
  using (public.is_company_admin(id) and status <> 'SUSPENDED')
  with check (public.is_company_admin(id));
grant update (name, siren, kind, size, city, postal_code, department_code, website, logo_path)
  on public.companies to authenticated;

-- company_members
create policy company_members_select on public.company_members for select using (
  public.is_company_member(company_id) or public.is_staff()
);

-- company_invitations
create policy company_invitations_select on public.company_invitations for select using (
  public.is_company_admin(company_id)
);

-- company_profiles
create policy company_profiles_select on public.company_profiles for select using (
  (is_public and exists (select 1 from public.companies c where c.id = company_id and c.status = 'ACTIVE'))
  or public.is_company_member(company_id)
  or public.is_staff()
);
create policy company_profiles_update on public.company_profiles for update
  using (public.is_company_admin(company_id)) with check (public.is_company_admin(company_id));
grant update (tagline, description, sectors, skills, intervention_zone, intervention_radius_km,
  certifications, references_text, employees_range, founded_year, contact_email, contact_phone, is_public)
  on public.company_profiles to authenticated;

-- external_sources : le nom/URL/licence d'une source approuvée est public
-- (attribution obligatoire) ; les notes internes ne sont lues que via le staff.
create policy external_sources_select on public.external_sources for select using (
  status = 'APPROVED' or public.is_staff()
);

-- opportunities
create policy opportunities_select on public.opportunities for select using (
  public.can_view_opportunity(id)
);
create policy opportunities_insert on public.opportunities for insert with check (
  auth.uid() is not null
  and public.is_active_user()
  and origin = 'INTERNAL'
  and public.is_company_member(company_id)
  and exists (select 1 from public.companies c where c.id = company_id and c.status = 'ACTIVE')
);
create policy opportunities_update on public.opportunities for update
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));
create policy opportunities_delete on public.opportunities for delete using (
  public.is_company_member(company_id) and status = 'DRAFT'
);
grant insert (type, status, visibility, title, summary, description, company_id, sector_slug, city,
  postal_code, department_code, budget_min, budget_max, budget_visible, start_date, response_deadline,
  skills, services, constraints, criteria, max_suppliers, target_company_size, keywords, contact_name,
  publisher_attested_at)
  on public.opportunities to authenticated;
grant update (type, status, visibility, title, summary, description, sector_slug, city, postal_code,
  department_code, budget_min, budget_max, budget_visible, start_date, response_deadline, skills,
  services, constraints, criteria, max_suppliers, target_company_size, keywords, contact_name,
  publisher_attested_at)
  on public.opportunities to authenticated;
grant delete on public.opportunities to authenticated;

-- opportunity_documents : réservés aux membres connectés
create policy opportunity_documents_select on public.opportunity_documents for select using (
  auth.uid() is not null and public.can_view_opportunity(opportunity_id)
);
create policy opportunity_documents_insert on public.opportunity_documents for insert with check (
  public.is_opportunity_owner(opportunity_id) and uploaded_by = auth.uid()
);
create policy opportunity_documents_delete on public.opportunity_documents for delete using (
  public.is_opportunity_owner(opportunity_id)
);
grant insert (opportunity_id, storage_path, file_name, mime_type, size_bytes, uploaded_by)
  on public.opportunity_documents to authenticated;
grant delete on public.opportunity_documents to authenticated;

-- opportunity_sources
create policy opportunity_sources_select on public.opportunity_sources for select using (
  public.can_view_opportunity(opportunity_id)
);

-- interests
create policy interests_select on public.interests for select using (
  public.is_company_member(company_id)
  or public.is_opportunity_owner(opportunity_id)
  or public.is_staff()
);

-- proposals
create policy proposals_select on public.proposals for select using (
  public.is_company_member(company_id)
  or public.is_opportunity_owner(opportunity_id)
);

create policy proposal_evaluations_all on public.proposal_evaluations for select using (
  public.is_company_member(buyer_company_id)
);

create policy proposal_documents_select on public.proposal_documents for select using (
  public.can_view_proposal(proposal_id)
);

-- pipeline : strictement privé à l'entreprise (y compris vis-à-vis du staff)
create policy pipeline_select on public.pipeline_items for select using (public.is_company_member(company_id));
create policy pipeline_insert on public.pipeline_items for insert with check (
  public.is_company_member(company_id) and public.can_view_opportunity(opportunity_id)
);
create policy pipeline_update on public.pipeline_items for update
  using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy pipeline_delete on public.pipeline_items for delete using (public.is_company_member(company_id));
grant insert (company_id, opportunity_id, stage, notes, estimated_value, next_action, next_action_at, updated_by)
  on public.pipeline_items to authenticated;
grant update (stage, notes, estimated_value, next_action, next_action_at, updated_by)
  on public.pipeline_items to authenticated;
grant delete on public.pipeline_items to authenticated;

-- favoris, recherches, alertes, notifications : propriétaire uniquement
create policy favorites_own on public.favorites for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant insert (user_id, opportunity_id, company_id), delete on public.favorites to authenticated;

create policy saved_searches_own on public.saved_searches for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant insert (user_id, name, scope, query), update (name, query), delete on public.saved_searches to authenticated;

create policy alerts_own on public.alerts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant insert (user_id, name, sector_slug, department_code, type, keywords, frequency, is_active),
  update (name, sector_slug, department_code, type, keywords, frequency, is_active),
  delete on public.alerts to authenticated;

create policy notifications_own_select on public.notifications for select using (user_id = auth.uid());
create policy notifications_own_update on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_own_delete on public.notifications for delete using (user_id = auth.uid());
grant update (read_at), delete on public.notifications to authenticated;

-- messagerie : participants uniquement (les écritures passent par RPC)
create policy conversations_select on public.conversations for select using (
  public.is_company_member(buyer_company_id) or public.is_company_member(supplier_company_id)
);
create policy messages_select on public.messages for select using (
  public.is_conversation_participant(conversation_id)
);

-- signalements
create policy reports_insert on public.reports for insert with check (
  auth.uid() is not null and reporter_user_id = auth.uid()
);
create policy reports_select on public.reports for select using (
  reporter_user_id = auth.uid() or public.is_staff()
);
grant insert (reporter_user_id, target_type, target_id, reason, details) on public.reports to authenticated;

-- modération & audit : lecture staff / admin
create policy moderation_actions_select on public.moderation_actions for select using (public.is_staff());
create policy audit_logs_select on public.audit_logs for select using (public.is_admin());
create policy analytics_select on public.analytics_events for select using (public.is_admin());

-- paramètres plateforme : lecture publique hors clés privées
create policy platform_settings_select on public.platform_settings for select using (
  key not like 'private.%' or public.is_admin()
);

create policy contact_messages_select on public.contact_messages for select using (public.is_staff());

-- Les fonctions d'aide internes ne doivent pas être appelables par l'API
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.handle_auth_user_email_change() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Stockage de fichiers (Supabase Storage)
-- Chemins : <id parent>/<uuid>-<nom-de-fichier>
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('company-logos', 'company-logos', true, 2097152,
    array['image/png', 'image/jpeg', 'image/webp']),
  ('opportunity-documents', 'opportunity-documents', false, 10485760,
    array['application/pdf', 'image/png', 'image/jpeg',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.spreadsheet']),
  ('proposal-documents', 'proposal-documents', false, 10485760,
    array['application/pdf', 'image/png', 'image/jpeg',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.spreadsheet']),
  ('message-attachments', 'message-attachments', false, 10485760,
    array['application/pdf', 'image/png', 'image/jpeg',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;

create or replace function public.storage_parent_id(p_name text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

create policy "logos lecture publique" on storage.objects for select
  using (bucket_id = 'company-logos');
create policy "logos ecriture admin entreprise" on storage.objects for insert
  with check (bucket_id = 'company-logos' and public.is_company_admin(public.storage_parent_id(name)));
create policy "logos suppression admin entreprise" on storage.objects for delete
  using (bucket_id = 'company-logos' and public.is_company_admin(public.storage_parent_id(name)));

create policy "documents opportunite lecture" on storage.objects for select
  using (bucket_id = 'opportunity-documents' and auth.uid() is not null
         and public.can_view_opportunity(public.storage_parent_id(name)));
create policy "documents opportunite ecriture" on storage.objects for insert
  with check (bucket_id = 'opportunity-documents' and public.is_opportunity_owner(public.storage_parent_id(name)));
create policy "documents opportunite suppression" on storage.objects for delete
  using (bucket_id = 'opportunity-documents' and public.is_opportunity_owner(public.storage_parent_id(name)));

create policy "documents reponse lecture" on storage.objects for select
  using (bucket_id = 'proposal-documents' and public.can_view_proposal(public.storage_parent_id(name)));
create policy "documents reponse ecriture" on storage.objects for insert
  with check (bucket_id = 'proposal-documents' and exists (
    select 1 from public.proposals p
    where p.id = public.storage_parent_id(name) and public.is_company_member(p.company_id)
  ));

create policy "pieces jointes lecture" on storage.objects for select
  using (bucket_id = 'message-attachments' and public.is_conversation_participant(public.storage_parent_id(name)));
create policy "pieces jointes ecriture" on storage.objects for insert
  with check (bucket_id = 'message-attachments' and public.is_conversation_participant(public.storage_parent_id(name)));
