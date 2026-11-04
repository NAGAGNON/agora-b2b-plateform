-- Fidélisation : jours de visite des inscrits, « depuis votre dernière visite », rappels de date limite.

-- 1) Jours de visite (un par personne et par jour) : sert au taux de retour à 7 et 30 jours.
create table if not exists public.user_visits (
  user_id uuid not null references public.users (id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);
alter table public.user_visits enable row level security;
revoke all on public.user_visits from anon, authenticated;

-- Historique connu avant cette table : le jour de la dernière activité enregistrée (rien d'autre n'est déduit)
insert into public.user_visits (user_id, day)
select id, (last_seen_at at time zone 'Europe/Paris')::date from public.users where last_seen_at is not null
on conflict do nothing;

-- 2) Début de la visite précédente (« depuis votre dernière visite »)
alter table public.users add column if not exists previous_visit_at timestamptz;

-- Marque l'activité de la personne connectée. Une nouvelle visite commence après 30 minutes sans activité :
-- la fin de la visite précédente est alors conservée dans previous_visit_at.
create or replace function public.touch_visit() returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then return; end if;
  update public.users
     set previous_visit_at = case when last_seen_at is not null and last_seen_at < now() - interval '30 minutes' then last_seen_at else previous_visit_at end,
         last_seen_at = now()
   where id = v_uid
     and (last_seen_at is null or last_seen_at < now() - interval '1 minute');
  insert into public.user_visits (user_id, day) values (v_uid, (now() at time zone 'Europe/Paris')::date) on conflict do nothing;
end;
$$;
revoke all on function public.touch_visit() from public, anon;
grant execute on function public.touch_visit() to authenticated;

-- Taux de retour : parmi les inscrits (hors démo) d'au moins N jours, part revenue entre le lendemain et le jour N.
create or replace function public.return_rates() returns jsonb
language sql stable security definer set search_path = '' as $$
  with u as (
    select id, (created_at at time zone 'Europe/Paris')::date as d0 from public.users
     where not is_demo and platform_role = 'USER' and status = 'ACTIVE'
  ),
  r as (
    select u.id, u.d0,
           exists (select 1 from public.user_visits v where v.user_id = u.id and v.day > u.d0 and v.day <= u.d0 + 7) as back7,
           exists (select 1 from public.user_visits v where v.user_id = u.id and v.day > u.d0 and v.day <= u.d0 + 30) as back30
      from u
  ),
  today as (select (now() at time zone 'Europe/Paris')::date as t)
  select jsonb_build_object(
    'eligible7', (select count(*) from r, today where r.d0 <= today.t - 7),
    'returned7', (select count(*) from r, today where r.d0 <= today.t - 7 and back7),
    'eligible30', (select count(*) from r, today where r.d0 <= today.t - 30),
    'returned30', (select count(*) from r, today where r.d0 <= today.t - 30 and back30),
    'active7', (select count(distinct v.user_id) from public.user_visits v join u on u.id = v.user_id, today where v.day > today.t - 7),
    'visits_today', (select count(*) from public.user_visits v join u on u.id = v.user_id, today where v.day = today.t)
  );
$$;
revoke all on function public.return_rates() from public, anon, authenticated;
grant execute on function public.return_rates() to service_role;

-- 3) Rappels de date limite : offre en favori ou dans le pipeline, 7 jours puis 2 jours avant (une fois chacun).
create table if not exists public.deadline_reminders (
  user_id uuid not null references public.users (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  days_before int not null check (days_before in (2, 7)),
  sent_at timestamptz not null default now(),
  primary key (user_id, opportunity_id, days_before)
);
alter table public.deadline_reminders enable row level security;
revoke all on public.deadline_reminders from anon, authenticated;

create or replace function public.notification_category(p_type text) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_type in ('need_no_response', 'need_deadline_soon') then 'need_reminders'
    when p_type in ('pipeline_due', 'deadline_soon') then 'pipeline'
    when p_type in ('need_match', 'alert_match') then 'matching'
    when p_type like 'opportunity\_%' or p_type in ('proposal_status', 'interest_status') then 'status'
    else null
  end
$$;

create or replace function public.process_deadline_reminders(p_limit int default 300)
returns int language plpgsql security definer set search_path = '' as $$
declare
  p record;
  n int := 0;
  v_days int;
  v_when text;
begin
  for p in
    with followed as (
      select f.user_id, f.opportunity_id, 'favori' as via from public.favorites f where f.opportunity_id is not null
      union
      select cm.user_id, pi.opportunity_id, 'pipeline' as via
        from public.pipeline_items pi join public.company_members cm on cm.company_id = pi.company_id
       where pi.stage not in ('WON', 'LOST')
    )
    select distinct on (x.user_id, x.opportunity_id) x.user_id, x.opportunity_id, x.via, o.title, o.response_deadline,
           case when o.response_deadline <= now() + interval '2 days' then 2 else 7 end as bucket
      from followed x
      join public.opportunities o on o.id = x.opportunity_id
      join public.users u on u.id = x.user_id and u.status = 'ACTIVE' and not u.is_demo
     where o.status = 'PUBLISHED'
       and o.response_deadline > now() and o.response_deadline <= now() + interval '7 days'
       and not exists (
         select 1 from public.deadline_reminders r
          where r.user_id = x.user_id and r.opportunity_id = x.opportunity_id
            and r.days_before = case when o.response_deadline <= now() + interval '2 days' then 2 else 7 end)
     order by x.user_id, x.opportunity_id, (x.via = 'pipeline') desc
     limit p_limit
  loop
    v_days := p.bucket;
    insert into public.deadline_reminders (user_id, opportunity_id, days_before) values (p.user_id, p.opportunity_id, v_days) on conflict do nothing;
    if not found then continue; end if;
    -- Rappel à 2 jours envoyé : celui à 7 jours n'a plus lieu d'être
    if v_days = 2 then
      insert into public.deadline_reminders (user_id, opportunity_id, days_before) values (p.user_id, p.opportunity_id, 7) on conflict do nothing;
    end if;
    v_when := to_char(p.response_deadline at time zone 'Europe/Paris', 'DD/MM/YYYY "à" HH24"h"MI');
    perform public.notify_user(p.user_id, 'deadline_soon',
      case when v_days = 2 then 'Dernier rappel : date limite dans moins de 48 h' else 'Date limite dans ' || greatest(3, ceil(extract(epoch from p.response_deadline - now()) / 86400))::int || ' jours' end || ' — ' || left(p.title, 90),
      'Vous suivez cette offre (' || case when p.via = 'pipeline' then 'pipeline' else 'favoris' end || '). Les réponses sont attendues avant le ' || v_when
        || case when v_days = 2 then '. Il est encore temps de répondre.' else '. Prenez le temps de préparer votre réponse.' end,
      '/opportunites/' || p.opportunity_id);
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.process_deadline_reminders(int) from public, anon, authenticated;
grant execute on function public.process_deadline_reminders(int) to service_role;
