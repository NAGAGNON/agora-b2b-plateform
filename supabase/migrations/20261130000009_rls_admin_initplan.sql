-- Règles d'accès « administrateur » : is_admin() évaluée une seule fois par requête
-- (sous-requête « (select is_admin()) ») au lieu d'une fois par ligne. Sur les 100 000 prospects
-- de l'Outreach, chaque compteur prenait ~7 s et la page dépassait le délai de la base.
-- Mêmes droits qu'avant (même condition), uniquement plus rapide. Rejouable sans effet.
do $$
declare
  p record;
  q text;
  c text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (qual ~ '\mis_admin\(\)' or with_check ~ '\mis_admin\(\)')
  loop
    q := case when p.qual is null or p.qual ~* 'select is_admin\(\)' then null else regexp_replace(p.qual, '\mis_admin\(\)', '(select is_admin())', 'g') end;
    c := case when p.with_check is null or p.with_check ~* 'select is_admin\(\)' then null else regexp_replace(p.with_check, '\mis_admin\(\)', '(select is_admin())', 'g') end;
    if q is not null then
      execute format('alter policy %I on %I.%I using (%s)', p.policyname, p.schemaname, p.tablename, q);
    end if;
    if c is not null then
      execute format('alter policy %I on %I.%I with check (%s)', p.policyname, p.schemaname, p.tablename, c);
    end if;
  end loop;
end $$;
