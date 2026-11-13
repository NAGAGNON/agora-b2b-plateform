-- Offre « Visibilité » : audience élargie à la base de prospection (entreprises françaises issues de
-- sources publiques, avec une adresse e-mail professionnelle, jamais celles qui se sont désinscrites).
-- Taille SIRENE ramenée aux catégories de la plateforme.
create or replace function public.prospect_size(p_range text, p_individual boolean)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_individual then 'INDEPENDANT'
    when p_range is null then null
    when p_range in ('0 salarié', '1 à 2 salariés', '3 à 5 salariés', '6 à 9 salariés') then 'TPE'
    when p_range in ('10 à 19 salariés', '20 à 49 salariés', '50 à 99 salariés', '100 à 199 salariés', '200 à 249 salariés') then 'PME'
    when p_range in ('250 à 499 salariés', '500 à 999 salariés', '1 000 à 1 999 salariés', '2 000 à 4 999 salariés') then 'ETI'
    else 'GE' end;
$$;

-- Prospect joignable correspondant au ciblage (le type d'entreprise ne s'applique qu'aux inscrits)
create or replace function public.boost_prospect_matches(p_targeting jsonb, p_prospect_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.outreach_prospects p
     where p.id = p_prospect_id and p.status = 'ACTIVE' and coalesce(p.email, '') <> '' and p.linkprob2b_company_id is null
       and not exists (select 1 from public.outreach_suppressions s
                        where (s.kind = 'EMAIL' and s.value = lower(p.email)) or (s.kind = 'DOMAIN' and s.value = lower(split_part(p.email, '@', 2)))
                           or (s.kind = 'SIREN' and s.value = p.siren))
       and (jsonb_array_length(coalesce(p_targeting -> 'sectors', '[]')) = 0
            or p.sectors && array(select jsonb_array_elements_text(p_targeting -> 'sectors')))
       and (jsonb_array_length(coalesce(p_targeting -> 'regions', '[]')) = 0
            or p.region = any(array(select jsonb_array_elements_text(p_targeting -> 'regions'))))
       and (jsonb_array_length(coalesce(p_targeting -> 'sizes', '[]')) = 0
            or public.prospect_size(p.size_range, p.is_individual_entrepreneur) = any(array(select jsonb_array_elements_text(p_targeting -> 'sizes'))))
  );
$$;
revoke all on function public.boost_prospect_matches(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.boost_prospect_matches(jsonb, uuid) to service_role;

-- Aperçu de l'audience (membres de l'entreprise seulement) : entreprises inscrites + entreprises de la base
-- joignables par e-mail. Aucun nom ni adresse n'est renvoyé.
create or replace function public.boost_audience(p_company_id uuid, p_targeting jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_members int; v_prospects int; t jsonb := coalesce(p_targeting, '{}'::jsonb);
begin
  if not public.is_company_member(p_company_id) then return jsonb_build_object('members', 0, 'prospects', 0); end if;
  select count(*)::int into v_members from public.companies c
   where c.status = 'ACTIVE' and not c.is_demo and c.id <> p_company_id and public.boost_target_matches(t, c.id);
  select count(*)::int into v_prospects from public.outreach_prospects p
   where p.status = 'ACTIVE' and coalesce(p.email, '') <> '' and p.linkprob2b_company_id is null
     and (jsonb_array_length(coalesce(t -> 'sectors', '[]')) = 0 or p.sectors && array(select jsonb_array_elements_text(t -> 'sectors')))
     and (jsonb_array_length(coalesce(t -> 'regions', '[]')) = 0 or p.region = any(array(select jsonb_array_elements_text(t -> 'regions'))))
     and (jsonb_array_length(coalesce(t -> 'sizes', '[]')) = 0
          or public.prospect_size(p.size_range, p.is_individual_entrepreneur) = any(array(select jsonb_array_elements_text(t -> 'sizes'))))
     and not exists (select 1 from public.outreach_suppressions s where (s.kind = 'EMAIL' and s.value = lower(p.email)) or (s.kind = 'SIREN' and s.value = p.siren));
  return jsonb_build_object('members', v_members, 'prospects', v_prospects);
end;
$$;
revoke all on function public.boost_audience(uuid, jsonb) from public, anon;
grant execute on function public.boost_audience(uuid, jsonb) to authenticated;

-- Présentations par e-mail aux entreprises de la base (offre validée par l'équipe) : historique dédié
alter table public.boost_presentations add column if not exists prospect_id uuid references public.outreach_prospects (id) on delete set null;
alter table public.boost_presentations alter column presented_to drop not null;
create unique index if not exists boost_presentations_prospect_key on public.boost_presentations (boost_id, prospect_id) where prospect_id is not null;
alter table public.boost_presentations drop constraint if exists boost_presentations_target_check;
alter table public.boost_presentations add constraint boost_presentations_target_check check (num_nonnulls(presented_to, prospect_id) = 1);

-- Présentations « Visibilité » incluses chaque mois dans les abonnements (au-delà : payant)
update public.plans set features = features || '{"visibility_included_month": 0}'::jsonb where code = 'FREE';
update public.plans set features = features || '{"visibility_included_month": 100}'::jsonb where code = 'PRO';
update public.plans set features = features || '{"visibility_included_month": 400}'::jsonb where code = 'BUSINESS';
alter table public.visibility_boosts add column if not exists included_presentations int not null default 0;

-- Rééquilibrage de l'offre Gratuite (appliqué seulement après la phase de lancement gratuite)
update public.plans set features = features || '{"searches_week": 5, "favorites": 5, "buyer_history": 3, "contact_requests_month": 3, "digest_items": 2}'::jsonb where code = 'FREE';
