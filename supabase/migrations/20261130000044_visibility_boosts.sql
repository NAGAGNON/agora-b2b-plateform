-- =============================================================================
-- Offre « Visibilité » : une entreprise inscrite (ou un de ses besoins) choisit d'être présentée à un
-- nombre d'entreprises chaque jour et/ou affichée « À la une » pendant quelques jours.
--  - Gratuite pendant la phase de lancement ; payante ensuite (prix décrits côté application).
--  - Chaque demande est VALIDÉE par l'équipe avant de démarrer (aucun envoi sans validation).
--  - Présentations d'une entreprise : notification dans l'espace des entreprises inscrites ciblées
--    (pas d'e-mail en v1) ; besoin : la mise en relation existante (e-mails aux entreprises du métier)
--    reçoit le quota quotidien choisi, dans les limites d'envoi globales de la plateforme.
-- =============================================================================

create table if not exists public.visibility_boosts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  target text not null check (target in ('COMPANY', 'NEED')),
  opportunity_id uuid references public.opportunities (id) on delete cascade,
  daily_presentations int not null default 10 check (daily_presentations in (0, 5, 10, 20, 40)),
  featured_days int not null default 0 check (featured_days in (0, 7, 14, 30)),
  duration_days int not null default 14 check (duration_days in (7, 14, 30)),
  price_ht numeric(10, 2) not null default 0,
  free_launch boolean not null default true,
  status text not null default 'PENDING' check (status in ('PENDING', 'ACTIVE', 'ENDED', 'REJECTED', 'CANCELLED')),
  starts_at timestamptz,
  ends_at timestamptz,
  featured_until timestamptz,
  requested_by uuid references public.users (id) on delete set null,
  reviewed_by uuid references public.users (id) on delete set null,
  reviewed_at timestamptz,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  constraint visibility_boosts_need_target check ((target = 'NEED') = (opportunity_id is not null)),
  constraint visibility_boosts_something check (daily_presentations > 0 or featured_days > 0)
);
create index if not exists visibility_boosts_company_idx on public.visibility_boosts (company_id, created_at desc);
create index if not exists visibility_boosts_status_idx on public.visibility_boosts (status, ends_at);
-- Une seule demande en attente ou en cours par cible
create unique index if not exists visibility_boosts_one_live on public.visibility_boosts (company_id, coalesce(opportunity_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status in ('PENDING', 'ACTIVE');

alter table public.visibility_boosts enable row level security;
drop policy if exists visibility_boosts_read on public.visibility_boosts;
create policy visibility_boosts_read on public.visibility_boosts for select to authenticated
  using (public.is_company_member(company_id) or public.is_admin());
revoke all on public.visibility_boosts from anon, authenticated;
grant select on public.visibility_boosts to authenticated;
grant all on public.visibility_boosts to service_role;

-- Présentations réalisées (une entreprise n'est présentée qu'une fois par demande)
create table if not exists public.boost_presentations (
  id uuid primary key default gen_random_uuid(),
  boost_id uuid not null references public.visibility_boosts (id) on delete cascade,
  presented_to uuid not null references public.companies (id) on delete cascade,
  channel text not null default 'MEMBER' check (channel in ('MEMBER', 'PROSPECT')),
  created_at timestamptz not null default now(),
  unique (boost_id, presented_to)
);
create index if not exists boost_presentations_to_idx on public.boost_presentations (presented_to, created_at desc);
alter table public.boost_presentations enable row level security;
drop policy if exists boost_presentations_read on public.boost_presentations;
create policy boost_presentations_read on public.boost_presentations for select to authenticated
  using (exists (select 1 from public.visibility_boosts b where b.id = boost_id and (public.is_company_member(b.company_id) or public.is_admin())));
revoke all on public.boost_presentations from anon, authenticated;
grant select on public.boost_presentations to authenticated;
grant all on public.boost_presentations to service_role;

-- Demande (administrateur de l'entreprise) : vérifie la cible ; le prix est calculé par l'application
-- (offre gratuite pendant la phase de lancement : 0 €).
create or replace function public.request_visibility_boost(
  p_company_id uuid, p_target text, p_opportunity_id uuid, p_daily int, p_featured_days int, p_duration_days int, p_price_ht numeric
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_free boolean := public.free_launch();
begin
  if not public.is_company_admin(p_company_id) then raise exception 'Action non autorisée' using errcode = '42501'; end if;
  if p_target = 'NEED' and not exists (
    select 1 from public.opportunities o where o.id = p_opportunity_id and o.company_id = p_company_id and o.status = 'PUBLISHED' and o.origin = 'INTERNAL'
  ) then raise exception 'Besoin introuvable ou non publié' using errcode = 'P0001'; end if;
  insert into public.visibility_boosts (company_id, target, opportunity_id, daily_presentations, featured_days, duration_days, price_ht, free_launch, requested_by)
  values (p_company_id, p_target, case when p_target = 'NEED' then p_opportunity_id end, p_daily, p_featured_days, p_duration_days,
          case when v_free then 0 else greatest(p_price_ht, 0) end, v_free, auth.uid())
  returning id into v_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'visibility.requested', 'company', p_company_id, jsonb_build_object('boost_id', v_id, 'target', p_target, 'daily', p_daily, 'featured_days', p_featured_days, 'days', p_duration_days));
  -- Équipe prévenue (validation avant tout démarrage)
  perform public.notify_user(u.id, 'visibility_pending', 'Demande de visibilité à valider', (select name from public.companies where id = p_company_id), '/admin/visibilite', false)
     from public.users u where u.platform_role in ('ADMIN', 'SUPER_ADMIN') and u.status = 'ACTIVE';
  return v_id;
exception when unique_violation then
  raise exception 'Une demande est déjà en cours pour cette cible' using errcode = 'P0001';
end;
$$;
revoke all on function public.request_visibility_boost(uuid, text, uuid, int, int, int, numeric) from public, anon;
grant execute on function public.request_visibility_boost(uuid, text, uuid, int, int, int, numeric) to authenticated;

-- Annulation d'une demande en attente (administrateur de l'entreprise)
create or replace function public.cancel_visibility_boost(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.visibility_boosts set status = 'CANCELLED'
   where id = p_id and status = 'PENDING' and public.is_company_admin(company_id);
  if not found then raise exception 'Demande introuvable' using errcode = 'P0001'; end if;
end;
$$;
revoke all on function public.cancel_visibility_boost(uuid) from public, anon;
grant execute on function public.cancel_visibility_boost(uuid) to authenticated;

-- Validation par l'équipe : démarrage immédiat (durée, mise en avant) ou refus motivé
create or replace function public.review_visibility_boost(p_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare b record;
begin
  if not public.is_admin() then raise exception 'Action non autorisée' using errcode = '42501'; end if;
  select * into b from public.visibility_boosts where id = p_id and status = 'PENDING' for update;
  if b.id is null then raise exception 'Demande introuvable ou déjà traitée' using errcode = 'P0001'; end if;
  if p_approve then
    update public.visibility_boosts
       set status = 'ACTIVE', starts_at = now(), ends_at = now() + make_interval(days => b.duration_days),
           featured_until = case when b.featured_days > 0 then now() + make_interval(days => b.featured_days) end,
           reviewed_by = auth.uid(), reviewed_at = now(), note = p_note
     where id = p_id;
  else
    update public.visibility_boosts set status = 'REJECTED', reviewed_by = auth.uid(), reviewed_at = now(), note = p_note where id = p_id;
  end if;
  perform public.notify_user(m.user_id, 'visibility_status',
    case when p_approve then 'Votre offre de visibilité a démarré' else 'Votre demande de visibilité n''a pas été retenue' end,
    case when p_approve then 'Suivez les présentations et les vues jour après jour dans « Visibilité ».' else coalesce(p_note, 'Contactez-nous pour en savoir plus.') end,
    '/dashboard/visibilite', true)
    from public.company_members m where m.company_id = b.company_id and m.role = 'COMPANY_ADMIN';
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), case when p_approve then 'visibility.approved' else 'visibility.rejected' end, 'company', b.company_id, jsonb_build_object('boost_id', p_id));
end;
$$;
revoke all on function public.review_visibility_boost(uuid, boolean, text) from public, anon;
grant execute on function public.review_visibility_boost(uuid, boolean, text) to authenticated;

-- Traitement quotidien : fin des offres échues ; présentations du jour des entreprises mises en avant.
-- Destinataires : entreprises inscrites actives, d'abord celles qui ont publié un besoin dans un métier
-- de l'entreprise, puis celles de la même région ; jamais deux fois pour la même offre, et au plus une
-- présentation tous les 3 jours pour une même entreprise destinataire (toutes offres confondues).
create or replace function public.process_visibility_boosts(p_limit int default 50)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  b record;
  r record;
  v_ended int := 0;
  v_presented int := 0;
  v_name text;
  v_city text;
  v_slug text;
  v_sectors text[];
  v_region text;
  v_done int;
begin
  with ended as (
    update public.visibility_boosts set status = 'ENDED' where status = 'ACTIVE' and ends_at <= now() returning id, company_id
  )
  select count(*) into v_ended from ended;

  for b in
    select * from public.visibility_boosts where status = 'ACTIVE' and target = 'COMPANY' and daily_presentations > 0 order by starts_at limit p_limit
  loop
    -- Déjà fait aujourd'hui (heure de Paris) : rien
    select count(*) into v_done from public.boost_presentations p
     where p.boost_id = b.id and (p.created_at at time zone 'Europe/Paris')::date = (now() at time zone 'Europe/Paris')::date;
    if v_done >= b.daily_presentations then continue; end if;
    select c.name, c.city, c.slug, c.region, coalesce(cp.sectors, '{}') into v_name, v_city, v_slug, v_region, v_sectors
      from public.companies c left join public.company_profiles cp on cp.company_id = c.id where c.id = b.company_id;
    for r in
      select c.id,
             (exists (select 1 from public.opportunities o where o.company_id = c.id and o.origin = 'INTERNAL' and o.sector_slug = any(v_sectors)))::int * 2
             + (c.region is not distinct from v_region)::int as score
        from public.companies c
       where c.status = 'ACTIVE' and not c.is_demo and c.id <> b.company_id
         and not exists (select 1 from public.boost_presentations p where p.boost_id = b.id and p.presented_to = c.id)
         and not exists (select 1 from public.boost_presentations p where p.presented_to = c.id and p.created_at > now() - interval '3 days')
       order by score desc, c.created_at desc
       limit b.daily_presentations - v_done
    loop
      insert into public.boost_presentations (boost_id, presented_to) values (b.id, r.id) on conflict do nothing;
      if not found then continue; end if;
      v_presented := v_presented + 1;
      perform public.notify_user(m.user_id, 'company_spotlight', 'Entreprise à découvrir : ' || v_name,
        'Une entreprise inscrite sur LinkProB2B' || coalesce(' à ' || v_city, '') || ' qui pourrait vous intéresser. Consultez sa fiche et contactez-la directement.',
        '/entreprises/' || v_slug, false)
        from public.company_members m where m.company_id = r.id;
    end loop;
  end loop;
  return jsonb_build_object('terminees', v_ended, 'presentations', v_presented);
end;
$$;
revoke all on function public.process_visibility_boosts(int) from public, anon, authenticated;
grant execute on function public.process_visibility_boosts(int) to service_role;

-- « À la une » : entreprises et besoins dont la mise en avant est en cours (lecture publique)
create or replace function public.public_featured(p_kind text default 'COMPANY', p_limit int default 3)
returns table (id uuid, name text, slug text, logo_path text, city text, title text, opportunity_id uuid)
language sql stable security definer set search_path = '' as $$
  select b.id, c.name, c.slug, c.logo_path, coalesce(o.city, c.city), o.title, o.id
    from public.visibility_boosts b
    join public.companies c on c.id = b.company_id and c.status = 'ACTIVE' and not c.is_demo
    left join public.opportunities o on o.id = b.opportunity_id
   where b.status = 'ACTIVE' and b.featured_until > now() and b.target = p_kind
     and (p_kind = 'COMPANY' or (o.status = 'PUBLISHED' and (o.response_deadline is null or o.response_deadline > now())))
   order by b.starts_at desc
   limit least(greatest(p_limit, 1), 6);
$$;
revoke all on function public.public_featured(text, int) from public;
grant execute on function public.public_featured(text, int) to anon, authenticated;
