-- Fiche de candidature : une note dans chaque étape du parcours, et l'équipe qui suit le dossier.
-- Ajouts seulement : aucune donnée existante modifiée ni supprimée.

-- 1. Note rattachée à une étape (0 à 6 = étapes 1 à 7) ; sans étape = note générale du journal
alter table public.application_journal add column if not exists step smallint;
alter table public.application_journal drop constraint if exists application_journal_step_check;
alter table public.application_journal add constraint application_journal_step_check check (step is null or step between 0 and 6);

-- 2. Membres de l'équipe qui suivent le dossier (choisis parmi les membres de l'entreprise)
create table if not exists public.application_followers (
  company_id uuid not null references public.companies (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  added_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (company_id, opportunity_id, user_id)
);
create index if not exists application_followers_user_idx on public.application_followers (user_id);
alter table public.application_followers enable row level security;
drop policy if exists application_followers_select on public.application_followers;
create policy application_followers_select on public.application_followers for select using (public.is_company_member(company_id));
grant select on public.application_followers to authenticated;

-- Ajouter un collègue au suivi : il doit être membre de la même entreprise ; il est prévenu dans ses notifications
create or replace function public.add_application_follower(p_company_id uuid, p_opportunity_id uuid, p_user_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_active_user(); v_title text; v_added boolean;
begin
  perform public.enforce_rate_limit('application_follower', 60, 3600);
  if not public.is_company_member(p_company_id) then
    raise exception 'Action non autorisée' using errcode = '42501';
  end if;
  if not exists (select 1 from public.company_members m where m.company_id = p_company_id and m.user_id = p_user_id) then
    raise exception 'Cette personne ne fait pas partie de votre équipe' using errcode = '22023';
  end if;
  insert into public.application_followers (company_id, opportunity_id, user_id, added_by)
  values (p_company_id, p_opportunity_id, p_user_id, v_uid)
  on conflict do nothing;
  v_added := found;
  if v_added and p_user_id <> v_uid then
    select title into v_title from public.opportunities where id = p_opportunity_id;
    insert into public.notifications (user_id, type, title, body, link)
    values (p_user_id, 'application_follower', 'Vous suivez une candidature',
      coalesce((select full_name from public.users where id = v_uid), 'Un collègue') || ' vous a ajouté au suivi de : ' || coalesce(left(v_title, 160), 'une candidature'),
      '/dashboard/candidatures/' || p_opportunity_id);
  end if;
  return v_added;
end;
$$;
revoke all on function public.add_application_follower(uuid, uuid, uuid) from public, anon;
grant execute on function public.add_application_follower(uuid, uuid, uuid) to authenticated;

create or replace function public.remove_application_follower(p_company_id uuid, p_opportunity_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_active_user();
  if not public.is_company_member(p_company_id) then
    raise exception 'Action non autorisée' using errcode = '42501';
  end if;
  delete from public.application_followers where company_id = p_company_id and opportunity_id = p_opportunity_id and user_id = p_user_id;
end;
$$;
revoke all on function public.remove_application_follower(uuid, uuid, uuid) from public, anon;
grant execute on function public.remove_application_follower(uuid, uuid, uuid) to authenticated;
