-- Réponse à un besoin sans compte : un professionnel laisse son nom, son entreprise, son e-mail et
-- son message ; l'entreprise qui a publié le besoin le reçoit par e-mail et peut lui répondre
-- directement. Lecture réservée à l'équipe et aux membres de l'entreprise auteure du besoin ;
-- l'écriture passe uniquement par le serveur (contrôles, limitation de débit, anti-robot).
create table if not exists public.need_contacts (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  company text not null check (char_length(company) between 2 and 160),
  email text not null check (char_length(email) between 5 and 254),
  phone text check (phone is null or char_length(phone) <= 30),
  message text not null check (char_length(message) between 10 and 2000),
  -- Destinataire de l'e-mail de prospection qui a amené ce contact (mesure des campagnes)
  outreach_recipient_id uuid references public.outreach_recipients (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists need_contacts_opportunity_idx on public.need_contacts (opportunity_id, created_at desc);

alter table public.need_contacts enable row level security;
drop policy if exists need_contacts_select on public.need_contacts;
create policy need_contacts_select on public.need_contacts for select to authenticated using (
  public.is_staff()
  or exists (select 1 from public.opportunities o where o.id = need_contacts.opportunity_id and public.is_company_member(o.company_id))
);
revoke insert, update, delete on public.need_contacts from anon, authenticated;
