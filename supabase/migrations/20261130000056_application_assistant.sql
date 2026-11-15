-- Questions posées à l'assistant d'une candidature (historique privé à l'entreprise, écrit par le serveur)
create table if not exists public.application_questions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  user_id uuid references public.users (id) on delete set null,
  question text not null check (char_length(question) between 1 and 1000),
  answer text not null check (char_length(answer) between 1 and 12000),
  created_at timestamptz not null default now()
);
create index if not exists application_questions_idx on public.application_questions (company_id, opportunity_id, created_at desc);
create index if not exists application_questions_created_idx on public.application_questions (created_at desc);
alter table public.application_questions enable row level security;
drop policy if exists application_questions_select on public.application_questions;
create policy application_questions_select on public.application_questions for select using (public.is_company_member(company_id));
revoke all on public.application_questions from anon;
grant select on public.application_questions to authenticated;

-- Rappels de date limite : texte adapté à l'avancement de la candidature et lien direct vers « Ma candidature ».
-- Plus de rappel une fois la réponse déposée.
create or replace function public.process_deadline_reminders(p_limit int default 300)
returns int language plpgsql security definer set search_path = '' as $$
declare
  p record;
  n int := 0;
  v_days int;
  v_when text;
  v_body text;
begin
  for p in
    with followed as (
      select f.user_id, f.opportunity_id, 'favori' as via, null::text as stage from public.favorites f where f.opportunity_id is not null
      union
      select cm.user_id, pi.opportunity_id, 'pipeline' as via, pi.stage::text
        from public.pipeline_items pi join public.company_members cm on cm.company_id = pi.company_id
       where pi.stage not in ('WON', 'LOST')
    )
    select distinct on (x.user_id, x.opportunity_id) x.user_id, x.opportunity_id, x.via, x.stage, o.title, o.response_deadline,
           case when o.response_deadline <= now() + interval '2 days' then 2 else 7 end as bucket
      from followed x
      join public.opportunities o on o.id = x.opportunity_id
      join public.users u on u.id = x.user_id and u.status = 'ACTIVE' and not u.is_demo
     where o.status = 'PUBLISHED'
       and o.response_deadline > now() and o.response_deadline <= now() + interval '7 days'
       -- Réponse déjà déposée : aucun rappel (même si l'offre est aussi en favori)
       and not exists (
         select 1 from public.pipeline_items d join public.company_members m on m.company_id = d.company_id
          where m.user_id = x.user_id and d.opportunity_id = x.opportunity_id
            and d.stage in ('RESPONSE_SENT', 'DISCUSSION', 'NEGOTIATION', 'WON', 'LOST'))
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
    if v_days = 2 then
      insert into public.deadline_reminders (user_id, opportunity_id, days_before) values (p.user_id, p.opportunity_id, 7) on conflict do nothing;
    end if;
    v_when := to_char(p.response_deadline at time zone 'Europe/Paris', 'DD/MM/YYYY "à" HH24"h"MI');
    v_body := case
      when p.stage = 'INTERESTED' then 'Vous avez gardé cette offre pour plus tard. Les réponses sont attendues avant le ' || v_when
        || '. C''est le moment de vous décider : conditions, pièces à fournir et planning sont prêts dans votre fiche de candidature.'
      when p.stage = 'RESPONSE_PREPARING' then 'Votre candidature est en préparation. Les réponses sont attendues avant le ' || v_when
        || '. Ouvrez votre fiche de candidature pour voir les étapes qu''il vous reste.'
      when p.via = 'pipeline' then 'Vous étudiez cette offre. Les réponses sont attendues avant le ' || v_when
        || '. Votre fiche de candidature résume les conditions et les pièces pour décider vite.'
      else 'Vous suivez cette offre (favoris). Les réponses sont attendues avant le ' || v_when
        || case when v_days = 2 then '. Il est encore temps de répondre.' else '. Prenez le temps de préparer votre réponse.' end
    end;
    perform public.notify_user(p.user_id, 'deadline_soon',
      case when v_days = 2 then 'Dernier rappel : date limite dans moins de 48 h' else 'Date limite dans ' || greatest(3, ceil(extract(epoch from p.response_deadline - now()) / 86400))::int || ' jours' end || ' — ' || left(p.title, 90),
      v_body,
      case when p.via = 'pipeline' then '/dashboard/candidatures/' || p.opportunity_id else '/opportunites/' || p.opportunity_id end);
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.process_deadline_reminders(int) from public, anon, authenticated;
grant execute on function public.process_deadline_reminders(int) to service_role;

-- E-mail « Avez-vous eu le résultat ? » : activé par le propriétaire (15/11/2026)
update public.platform_settings
   set value = '{"enabled": true}'::jsonb,
       description = 'Rappels e-mail des candidatures : demande de résultat 3 semaines après la date limite (activé par le propriétaire)'
 where key = 'application_reminders';
