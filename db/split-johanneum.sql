-- Einmalig: die gemeinsame Johanneum-AG in Jg. 9/10 (Mittwoch) und Jg. 11/12 (Montag) trennen.
-- Läuft nur, wenn es genau eine Johanneum-AG gibt. Kann gefahrlos noch einmal ausgeführt werden.
-- Zuordnung der Personen, in dieser Reihenfolge:
--   1. Wer nur in Montags-Sitzungen live geantwortet hat oder dort anwesend war: 11/12. Nur mittwochs: 9/10.
--   2. Sonst: Vorname passt eindeutig zu genau einer Anmeldung (ag.provoid.de/anmeldung/johanneum).
--   3. Sonst bleibt die Person in 9/10 und steht in der Liste am Ende zum Prüfen.
do $$
declare
  old_id uuid; new_id uuid; n int; rec record; old_code text; new_code text := 'JOH1112';
begin
  select count(*) into n from groups where school ilike '%johann%' or name ilike '%johann%' or code ilike 'JOH%';
  if n <> 1 then
    raise notice 'Abbruch: % Johanneum-AGs gefunden (erwartet genau 1). Nichts geändert.', n;
    return;
  end if;
  select id, code into old_id, old_code from groups where school ilike '%johann%' or name ilike '%johann%' or code ilike 'JOH%';
  if exists (select 1 from groups where code = new_code) then new_code := 'JOH1112' || substr(md5(random()::text), 1, 2); end if;

  update groups set name = 'KI-AG Johanneum Jg. 9/10', short_name = 'Johanneum', cohort = 'Jg. 9/10',
         schedule = 'Mi, ungerade KW', starts_on = date '2026-11-04' where id = old_id;
  insert into groups (name, school, code, alt_code, starts_on, short_name, cohort, schedule, registration_open)
  select 'KI-AG Johanneum Jg. 11/12', school, new_code, old_code, date '2026-11-09', 'Johanneum', 'Jg. 11/12', 'Mo 12:10', registration_open
  from groups where id = old_id returning id into new_id;

  -- Sitzungen am Montag gehören zu 11/12, mit allem, was daran hängt (Material, Live-Aufgaben, Antworten, Anwesenheit)
  update ag_sessions set group_id = new_id where group_id = old_id and extract(isodow from date) = 1;
  update guests set group_id = new_id where group_id = old_id
    and (session_id in (select id from ag_sessions where group_id = new_id) or extract(isodow from date) = 1);

  -- Personen zuordnen
  create temp table _who on commit drop as
  select u.id, u.pseudonym,
         exists (select 1 from ag_sessions s where s.group_id = new_id and (
                   exists (select 1 from live_responses r join live_items i on i.id = r.item_id where i.session_id = s.id and r.user_id = u.id)
                   or exists (select 1 from attendance a where a.session_id = s.id and a.user_id = u.id and a.status = 'present'))) as mon,
         exists (select 1 from ag_sessions s where s.group_id = old_id and (
                   exists (select 1 from live_responses r join live_items i on i.id = r.item_id where i.session_id = s.id and r.user_id = u.id)
                   or exists (select 1 from attendance a where a.session_id = s.id and a.user_id = u.id and a.status = 'present'))) as wed,
         (select array_agg(distinct x.option_id) from signups x join signup_forms f on f.id = x.form_id and f.slug = 'johanneum'
            where lower(trim(x.child_first)) = lower(split_part(trim(u.pseudonym), ' ', 1))) as opts
  from users u where u.group_id = old_id and u.role = 'student';

  update users set group_id = new_id where id in (
    select id from _who where (mon and not wed) or (not mon and not wed and opts = array['11-12']));
  update topic_wishes set group_id = new_id where group_id = old_id and user_id in (select id from users where group_id = new_id);
  delete from live_presence where user_id in (select id from users where group_id = new_id);

  -- Sitzungen in beiden AGs neu durchnummerieren (nach Datum)
  update ag_sessions s set number = x.rn from (
    select id, row_number() over (partition by group_id order by date nulls last, number) as rn
    from ag_sessions where group_id in (old_id, new_id)) x where s.id = x.id;

  for rec in select w.pseudonym, (u.group_id = new_id) as to_new,
                  case when w.mon and w.wed then 'PRÜFEN: an beiden Tagen aktiv, bleibt in 9/10'
                       when w.mon or w.wed then 'nach Teilnahme'
                       when w.opts = array['11-12'] or w.opts = array['9-10'] then 'nach Anmeldung'
                       else 'PRÜFEN: keine eindeutige Anmeldung, bleibt in 9/10' end as why
           from _who w join users u on u.id = w.id order by 2, 1 loop
    raise notice '%  →  %  (%)', rec.pseudonym, case when rec.to_new then 'Jg. 11/12' else 'Jg. 9/10' end, rec.why;
  end loop;
  raise notice 'Getrennt. Neuer AG-Code für Jg. 11/12: % (der alte Code % funktioniert für alle weiter zum Einloggen).', new_code, old_code;
end $$;

-- Ergebnis zum Prüfen
select g.cohort as ag, g.code, string_agg(u.pseudonym, ', ' order by u.pseudonym_lower) as personen
from groups g left join users u on u.group_id = g.id and u.role = 'student'
where g.short_name = 'Johanneum' group by g.cohort, g.code order by g.cohort;
