-- Jg. 11/12, Sitzung 2 (16.11.): Titel setzen und die Pinnwand „Was kann nur der Mensch?“ aus Sitzung 1 übernehmen.
-- In Sitzung 2 erscheint sie auf Folie 5 nur zum Anschauen (Taste E), nicht zum Neu-Ausfüllen.
do $$
declare b uuid; s1 uuid; s2 uuid; src uuid; dst uuid; n int;
begin
  select id into b from groups where short_name = 'Johanneum' and cohort = 'Jg. 11/12';
  select id into s1 from ag_sessions where group_id = b and number = 1;
  select id into s2 from ag_sessions where group_id = b and date = date '2026-11-16';
  if b is null or s1 is null or s2 is null then raise notice 'Abbruch: AG oder Sitzungen nicht gefunden.'; return; end if;
  update ag_sessions set title = 'Kann eine KI fühlen?' where id = s2;
  select id into src from live_items where session_id = s1 and kind = 'wall'
    and (title ilike '%nur der mensch%' or title ilike '%brainstorm%') order by position, created_at limit 1;
  if src is null then
    raise notice 'Keine Brainstorming-Pinnwand in Sitzung 1 gefunden. Vorhandene Aufgaben: %',
      (select string_agg(title, ' | ') from live_items where session_id = s1);
    return;
  end if;
  if exists (select 1 from live_items where session_id = s2 and title like 'Rückblick:%') then
    raise notice 'Schon übernommen, nichts geändert.'; return;
  end if;
  insert into live_items (session_id, position, title, kind, slide, until_slide, reveal_slide, rows, options, solution, private, homework, closed)
  select s2, -1, 'Rückblick: ' || title, kind, null, null, 5, rows, options, solution, false, false, true
  from live_items where id = src returning id into dst;
  insert into live_responses (item_id, user_id, key, value, created_at)
  select dst, user_id, key, value, created_at from live_responses where item_id = src;
  get diagnostics n = row_count;
  raise notice 'Pinnwand mit % Einträgen übernommen. Sie erscheint in Sitzung 2 auf Folie 5.', n;
end $$;
