-- Photos : photo de profil des inscrits et photos des prestations des entreprises.
-- Mêmes règles que les logos : lecture publique, écriture réservée au titulaire du compte
-- (photo de profil) ou aux administrateurs de l'entreprise (photos des prestations).

alter table public.users add column if not exists avatar_path text;
grant update (avatar_path) on public.users to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('user-avatars', 'user-avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp']),
  ('company-photos', 'company-photos', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "avatars lecture publique" on storage.objects;
create policy "avatars lecture publique" on storage.objects for select
  using (bucket_id = 'user-avatars');
drop policy if exists "avatars ecriture titulaire" on storage.objects;
create policy "avatars ecriture titulaire" on storage.objects for insert
  with check (bucket_id = 'user-avatars' and public.storage_parent_id(name) = (select auth.uid()));
drop policy if exists "avatars suppression titulaire" on storage.objects;
create policy "avatars suppression titulaire" on storage.objects for delete
  using (bucket_id = 'user-avatars' and public.storage_parent_id(name) = (select auth.uid()));

drop policy if exists "photos entreprise lecture publique" on storage.objects;
create policy "photos entreprise lecture publique" on storage.objects for select
  using (bucket_id = 'company-photos');
drop policy if exists "photos entreprise ecriture admin" on storage.objects;
create policy "photos entreprise ecriture admin" on storage.objects for insert
  with check (bucket_id = 'company-photos' and public.is_company_admin(public.storage_parent_id(name)));
drop policy if exists "photos entreprise suppression admin" on storage.objects;
create policy "photos entreprise suppression admin" on storage.objects for delete
  using (bucket_id = 'company-photos' and public.is_company_admin(public.storage_parent_id(name)));

create table if not exists public.company_photos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  storage_path text not null,
  caption text check (caption is null or char_length(caption) <= 120),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists company_photos_company_idx on public.company_photos (company_id, position, created_at);

alter table public.company_photos enable row level security;
drop policy if exists company_photos_read on public.company_photos;
create policy company_photos_read on public.company_photos for select using (true);
drop policy if exists company_photos_admin_insert on public.company_photos;
create policy company_photos_admin_insert on public.company_photos for insert to authenticated
  with check (public.is_company_admin(company_id));
drop policy if exists company_photos_admin_update on public.company_photos;
create policy company_photos_admin_update on public.company_photos for update to authenticated
  using (public.is_company_admin(company_id)) with check (public.is_company_admin(company_id));
drop policy if exists company_photos_admin_delete on public.company_photos;
create policy company_photos_admin_delete on public.company_photos for delete to authenticated
  using (public.is_company_admin(company_id));

-- Au plus 8 photos par entreprise (contrôle aussi côté serveur)
create or replace function public.company_photos_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.company_photos where company_id = new.company_id) >= 8 then
    raise exception 'Huit photos au maximum par entreprise' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function public.company_photos_limit() from public, anon, authenticated;
drop trigger if exists company_photos_limit on public.company_photos;
create trigger company_photos_limit before insert on public.company_photos for each row execute function public.company_photos_limit();

grant select on public.company_photos to anon, authenticated;
grant insert, update, delete on public.company_photos to authenticated;
