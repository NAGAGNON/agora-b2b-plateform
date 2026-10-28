-- Besoins en pause : transitions autorisées au demandeur.
-- PUBLISHED → PAUSED (masqué), PAUSED → PUBLISHED (reprise, contenu inchangé), PAUSED → CLOSED / ARCHIVED.
-- Un besoin modifié pendant la pause repasse en validation (règle ajoutée au déclencheur).
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
    ('PUBLISHED', 'PAUSED'),
    ('PAUSED', 'PUBLISHED'),
    ('PAUSED', 'PENDING_REVIEW'),
    ('PAUSED', 'CLOSED'),
    ('PAUSED', 'ARCHIVED'),
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
    or new.budget_max is distinct from old.budget_max
    or new.budget_visible is distinct from old.budget_visible
    or new.services is distinct from old.services
    or new.constraints is distinct from old.constraints
    or new.criteria is distinct from old.criteria
    or new.keywords is distinct from old.keywords
    or new.skills is distinct from old.skills
    or new.contact_name is distinct from old.contact_name
    or (new.visibility is distinct from old.visibility and new.visibility = 'PUBLIC');
  if old.status = 'PUBLISHED' and new.status = 'PUBLISHED' and content_changed then
    new.status := 'PENDING_REVIEW';
  end if;
  -- Besoin en pause modifié : il repasse en validation avant toute nouvelle publication.
  if old.status = 'PAUSED' and new.status in ('PAUSED', 'PUBLISHED') and content_changed then
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

