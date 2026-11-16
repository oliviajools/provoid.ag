-- Korrektur nach der Trennung: Jg. 11/12 hat sich am Montag 09.11. registriert und dabei die Sitzung vom 04.11. mitbenutzt.
do $$
declare
  a uuid; b uuid; s_old uuid; s_new uuid; moved int;
  names text[] := array['benni', 'hannah', 'stella', 'johanna', 'carla', 'frederik'];
begin
  select id into a from groups where short_name = 'Johanneum' and cohort = 'Jg. 9/10';
  select id into b from groups where short_name = 'Johanneum' and cohort = 'Jg. 11/12';
  if a is null or b is null then raise notice 'Abbruch: AGs nicht gefunden.'; return; end if;
  if exists (select 1 from ag_sessions where group_id = b and date = date '2026-11-09') then
    raise notice 'Schon erledigt, nichts geändert.'; return;
  end if;
  select id into s_old from ag_sessions where group_id = a and date = date '2026-11-04';

  -- 1. Personen verschieben
  update users set group_id = b where group_id = a and role = 'student' and pseudonym_lower = any(names);
  get diagnostics moved = row_count;
  update topic_wishes set group_id = b where user_id in (select id from users where group_id = b);
  delete from live_presence where user_id in (select id from users where group_id = b);

  -- 2. Eigene Sitzung 1 für 11/12 am 09.11. als Kopie der Sitzung vom 04.11.
  insert into ag_sessions (group_id, number, title, date, phase, summary, published)
  select b, 0, title, date '2026-11-09', phase, summary, published from ag_sessions where id = s_old
  returning id into s_new;
  insert into session_decks (session_id, filename, html, slides)
  select s_new, filename, html, slides from session_decks where session_id = s_old;

  -- Material kopieren (mit Dateien)
  create temp table _m on commit drop as select id as old_id, gen_random_uuid() as new_id from materials where session_id = s_old;
  insert into materials (id, session_id, kind, title, url, body, filename, mime, size, complete, position, created_at)
  select x.new_id, s_new, m.kind, m.title, m.url, m.body, m.filename, m.mime, m.size, m.complete, m.position, m.created_at
  from materials m join _m x on x.old_id = m.id;
  insert into material_chunks (material_id, idx, data)
  select x.new_id, c.idx, c.data from material_chunks c join _m x on x.old_id = c.material_id;

  -- Live-Aufgaben kopieren und die Antworten der 11/12 dorthin mitnehmen
  create temp table _i on commit drop as select id as old_id, gen_random_uuid() as new_id from live_items where session_id = s_old;
  insert into live_items (id, session_id, position, title, kind, slide, until_slide, reveal_slide, rows, options, solution, private, homework, closed, created_at)
  select x.new_id, s_new, i.position, i.title, i.kind, i.slide, i.until_slide, i.reveal_slide, i.rows, i.options, i.solution, i.private, i.homework, i.closed, i.created_at
  from live_items i join _i x on x.old_id = i.id;
  update live_responses r set item_id = x.new_id from _i x
  where r.item_id = x.old_id and r.user_id in (select id from users where group_id = b);

  -- Anwesenheit und Notizen der 11/12 gehören zur neuen Sitzung
  update attendance set session_id = s_new where session_id = s_old and user_id in (select id from users where group_id = b);
  update notes set session_id = s_new where session_id = s_old and user_id in (select id from users where group_id = b);
  insert into attendance (session_id, user_id, status, source)
  select s_new, id, 'present', 'auto' from users where group_id = b and role = 'student'
    and created_at::date = date '2026-11-09'
  on conflict (session_id, user_id) do nothing;

  -- 3. Nummern nach Datum
  update ag_sessions s set number = x.rn from (
    select id, row_number() over (partition by group_id order by date nulls last, created_at) as rn
    from ag_sessions where group_id in (a, b)) x where s.id = x.id;

  raise notice '% Personen nach Jg. 11/12 verschoben, Sitzung 1 am 09.11. angelegt.', moved;
end $$;

select g.cohort as ag, g.code, string_agg(u.pseudonym, ', ' order by u.pseudonym_lower) as personen
from groups g left join users u on u.group_id = g.id and u.role = 'student'
where g.short_name = 'Johanneum' group by g.cohort, g.code order by g.cohort;
select g.cohort as ag, s.number, to_char(s.date, 'Dy DD.MM.YYYY') as datum, s.title,
       (select count(*) from attendance x where x.session_id = s.id and x.status = 'present') as da
from ag_sessions s join groups g on g.id = s.group_id where g.short_name = 'Johanneum' order by 1, 2;
