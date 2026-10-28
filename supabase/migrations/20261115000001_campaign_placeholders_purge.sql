-- Campagnes : les entreprises sans adresse, déjà contactées ou exclues ne servent qu'au bilan du
-- jour. Elles représentaient 99 % des lignes de campagne (base au-delà de la limite de 0,5 Go).
-- Index pour les suppressions en cascade, et purge par paquets des campagnes passées.
create index if not exists outreach_events_recipient_idx on public.outreach_events (recipient_id);

create or replace function public.purge_campaign_placeholders(p_limit int default 5000)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  with doomed as (
    select r.id from public.outreach_recipients r
    join public.outreach_campaigns c on c.id = r.campaign_id
    where r.status in ('NO_EMAIL', 'FREQUENCY', 'SUPPRESSED', 'EXCLUDED')
      and c.kind <> 'NEED'
      and c.campaign_date < (now() at time zone 'Europe/Paris')::date - 1
    limit greatest(1, least(p_limit, 20000))
  )
  delete from public.outreach_recipients where id in (select id from doomed);
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.purge_campaign_placeholders(int) from public, anon, authenticated;
grant execute on function public.purge_campaign_placeholders(int) to service_role;
