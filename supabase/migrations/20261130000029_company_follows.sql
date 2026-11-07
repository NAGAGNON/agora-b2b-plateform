-- Une entreprise peut en suivre une autre : notification à l'entreprise suivie, puis aux entreprises
-- abonnées à chaque nouveau besoin publié par l'entreprise suivie.
create table public.company_follows (
  follower_company_id uuid not null references public.companies (id) on delete cascade,
  followed_company_id uuid not null references public.companies (id) on delete cascade,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (follower_company_id, followed_company_id),
  constraint company_follows_not_self check (follower_company_id <> followed_company_id)
);
create index company_follows_followed_idx on public.company_follows (followed_company_id);

alter table public.company_follows enable row level security;

-- Les membres voient qui leur entreprise suit et qui la suit
create policy company_follows_select on public.company_follows for select to authenticated
  using (public.is_company_member(follower_company_id) or public.is_company_member(followed_company_id));

-- Suivre : au nom de sa propre entreprise, une entreprise active de l'annuaire public
create policy company_follows_insert on public.company_follows for insert to authenticated
  with check (
    public.is_company_member(follower_company_id)
    and created_by = auth.uid()
    and exists (
      select 1 from public.companies c join public.company_profiles p on p.company_id = c.id
      where c.id = followed_company_id and c.status = 'ACTIVE' and p.is_public
    )
  );

create policy company_follows_delete on public.company_follows for delete to authenticated
  using (public.is_company_member(follower_company_id));

grant select, insert, delete on public.company_follows to authenticated;

-- Nombre d'entreprises qui suivent une entreprise de l'annuaire public (aucun nom exposé)
create or replace function public.company_followers_count(p_company_id uuid)
returns bigint language sql stable security definer set search_path = '' as $$
  select count(*) from public.company_follows f
  join public.companies c on c.id = f.follower_company_id and c.status = 'ACTIVE'
  where f.followed_company_id = p_company_id
    and exists (select 1 from public.company_profiles p where p.company_id = p_company_id and p.is_public);
$$;
grant execute on function public.company_followers_count(uuid) to anon, authenticated;

-- Notification aux membres de l'entreprise suivie
create or replace function public.notify_company_followed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
  v_slug text;
begin
  select name, slug into v_name, v_slug from public.companies where id = new.follower_company_id;
  insert into public.notifications (user_id, type, title, body, link)
  select m.user_id, 'company_followed', v_name || ' suit désormais votre entreprise',
    'Elle sera prévenue de vos prochains besoins publiés.', '/entreprises/' || v_slug
  from public.company_members m join public.users u on u.id = m.user_id
  where m.company_id = new.followed_company_id and u.status = 'ACTIVE';
  return new;
end;
$$;
create trigger company_follows_notify after insert on public.company_follows
  for each row execute function public.notify_company_followed();

-- Nouveau besoin publié par une entreprise suivie : notification aux membres des entreprises abonnées
create or replace function public.notify_followers_new_need()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
begin
  if new.company_id is null or new.is_demo or new.status <> 'PUBLISHED'
     or (tg_op = 'UPDATE' and old.status = 'PUBLISHED') then
    return new;
  end if;
  select name into v_name from public.companies where id = new.company_id;
  insert into public.notifications (user_id, type, title, body, link)
  select distinct m.user_id, 'followed_company_need', v_name || ' a publié un nouveau besoin',
    left(new.title, 200), '/opportunites/' || new.id
  from public.company_follows f
  join public.company_members m on m.company_id = f.follower_company_id
  join public.users u on u.id = m.user_id and u.status = 'ACTIVE'
  where f.followed_company_id = new.company_id;
  return new;
end;
$$;
create trigger opportunities_notify_followers after insert or update of status on public.opportunities
  for each row execute function public.notify_followers_new_need();

revoke execute on function public.notify_company_followed() from public, anon, authenticated;
revoke execute on function public.notify_followers_new_need() from public, anon, authenticated;
