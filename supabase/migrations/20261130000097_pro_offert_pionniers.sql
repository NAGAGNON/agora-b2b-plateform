-- Promesse aux membres pionniers (e-mail « Merci ! 3 mois de LinkProB2B Pro offerts », envoyé le 12/11/2026) :
-- Pro jusqu'au 10/02/2027, attaché à la PERSONNE (et plus seulement à son entreprise : un pionnier n'en a pas).
-- L'offre payante ne peut donc jamais les faire passer en Gratuit ni les débiter avant cette date.
create table if not exists public.pro_grants (
  user_id uuid primary key references public.users (id) on delete cascade,
  until timestamptz not null,
  reason text not null,
  created_at timestamptz not null default now()
);
alter table public.pro_grants enable row level security;
drop policy if exists pro_grants_own on public.pro_grants;
create policy pro_grants_own on public.pro_grants for select using (user_id = auth.uid());
grant select on public.pro_grants to authenticated;

-- Les destinataires réels de l'e-mail pionnier, avec la date déjà promise (fin de l'essai de leur entreprise, sinon 90 jours après l'envoi)
insert into public.pro_grants (user_id, until, reason)
select o.user_id,
       coalesce((select max(c.trial_ends_at) from public.company_members m join public.companies c on c.id = m.company_id where m.user_id = o.user_id), o.created_at + interval '90 days'),
       'Membre pionnier : 3 mois de Pro offerts (e-mail du ' || to_char(o.created_at, 'DD/MM/YYYY') || ')'
from public.email_outbox o
where o.template = 'pioneer_reward' and o.status = 'SENT' and o.user_id is not null
on conflict (user_id) do update set until = greatest(public.pro_grants.until, excluded.until);

create or replace function public.user_plan(p_user_id uuid default auth.uid())
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((
    select p from (
      select case when c.plan_code in ('PRO', 'BUSINESS') then c.plan_code when c.trial_ends_at > now() then 'PRO' end as p
      from public.company_members m join public.companies c on c.id = m.company_id
      where m.user_id = p_user_id and c.status = 'ACTIVE'
      union all
      select 'PRO' from public.pro_grants g where g.user_id = p_user_id and g.until > now()
    ) x where p is not null
    order by case p when 'BUSINESS' then 2 else 1 end desc limit 1
  ), 'FREE');
$$;

-- Seulement ces destinataires : la récompense automatique reste suspendue (process_pioneer_rewards), aucun autre Pro offert.
