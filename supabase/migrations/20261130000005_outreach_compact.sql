-- Prospection : suppression en une fois des lignes de campagne inutiles (entreprises sans adresse,
-- écartées pour fréquence ou exclues, campagnes de plus d'un jour hors besoins), soit l'immense
-- majorité des 2,9 millions de lignes qui saturaient la base (délais dépassés sur le site et les
-- campagnes). Les lignes utiles sont mises de côté, les trois tables vidées (espace rendu
-- immédiatement), puis les lignes utiles remises. Tout est annulé en cas d'échec.
-- Conservé : destinataires réellement contactés ou en attente d'envoi, campagnes du jour et de la
-- veille, campagnes dédiées aux besoins, et tous les événements de ces destinataires.
set local lock_timeout = '30s';
set local statement_timeout = 0;

create temp table keep_recipients on commit drop as
  select r.* from public.outreach_recipients r
  join public.outreach_campaigns c on c.id = r.campaign_id
  where not (
    r.status in ('NO_EMAIL', 'FREQUENCY', 'SUPPRESSED', 'EXCLUDED')
    and c.kind <> 'NEED'
    and c.campaign_date < (now() at time zone 'Europe/Paris')::date - 1
  );
create unique index on keep_recipients (id);

create temp table keep_links on commit drop as
  select l.* from public.outreach_recipient_opportunities l
  where exists (select 1 from keep_recipients k where k.id = l.recipient_id);

create temp table keep_events on commit drop as
  select e.* from public.outreach_events e
  where e.recipient_id is null or exists (select 1 from keep_recipients k where k.id = e.recipient_id);

truncate public.outreach_recipient_opportunities, public.outreach_events, public.outreach_recipients;

insert into public.outreach_recipients select * from keep_recipients;
insert into public.outreach_recipient_opportunities select * from keep_links;
insert into public.outreach_events overriding system value select * from keep_events;
