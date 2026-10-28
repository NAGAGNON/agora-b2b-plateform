-- Pipeline : rappel le jour de la relance prévue (« prochaine action »), une seule fois par date
-- de relance, aux membres de l'entreprise (préférence e-mail respectée).
create table if not exists public.pipeline_reminders (
  pipeline_item_id uuid not null references public.pipeline_items (id) on delete cascade,
  due_on date not null,
  sent_at timestamptz not null default now(),
  primary key (pipeline_item_id, due_on)
);
alter table public.pipeline_reminders enable row level security;
revoke all on public.pipeline_reminders from anon, authenticated;

create or replace function public.process_pipeline_reminders(p_limit int default 200)
returns int language plpgsql security definer set search_path = '' as $$
declare
  p record;
  n int := 0;
  v_today date := (now() at time zone 'Europe/Paris')::date;
begin
  for p in
    select pi.id, pi.company_id, pi.next_action, pi.next_action_at, o.title
      from public.pipeline_items pi
      join public.opportunities o on o.id = pi.opportunity_id
     where pi.next_action_at is not null
       and pi.next_action_at <= v_today and pi.next_action_at >= v_today - 7
       and pi.stage not in ('WON', 'LOST')
       and not exists (select 1 from public.pipeline_reminders r where r.pipeline_item_id = pi.id and r.due_on = pi.next_action_at)
     order by pi.next_action_at
     limit p_limit
  loop
    insert into public.pipeline_reminders (pipeline_item_id, due_on) values (p.id, p.next_action_at) on conflict do nothing;
    if found then
      perform public.notify_company(p.company_id, 'pipeline_due',
        case when p.next_action_at < v_today then 'Relance en retard : ' else 'Relance prévue aujourd''hui : ' end || coalesce(nullif(p.next_action, ''), 'prochaine action'),
        'Opportunité suivie dans votre pipeline : « ' || p.title || ' ». Mettez à jour l''étape ou la date de la prochaine action une fois la relance faite.',
        '/dashboard/pipeline');
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;
revoke execute on function public.process_pipeline_reminders(int) from public, anon, authenticated;
grant execute on function public.process_pipeline_reminders(int) to service_role;
