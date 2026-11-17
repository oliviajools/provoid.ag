-- Jg. 11/12, Sitzung 2 (16.11.): Live-Aufgaben passend zum Foliensatz „Kann eine KI fühlen?“ direkt anlegen.
-- Falls die alte Fassung schon lief: News-Aufgabe von Microsoft auf Nvidia umstellen.
update live_items set title = 'News: Nvidia ohne Jensen Huang', rows = '["Was bedeutet das für die KI-Welt? Eure Gedanken"]'
where title = 'News: Habt ihr den Microsoft-Ausfall bemerkt?';
-- Funktioniert auch ohne neuen Code. Läuft nur einmal (bei erneutem Ausführen passiert nichts).
do $$
declare s2 uuid;
begin
  select s.id into s2 from ag_sessions s join groups g on g.id = s.group_id
  where g.short_name = 'Johanneum' and g.cohort = 'Jg. 11/12' and s.date = date '2026-11-16';
  if s2 is null then raise notice 'Abbruch: Sitzung am 16.11. für Jg. 11/12 nicht gefunden.'; return; end if;
  if exists (select 1 from live_items where session_id = s2 and title like 'Mission: Wird eine KI%') then
    raise notice 'Schon angelegt, nichts geändert.'; return;
  end if;
  insert into live_items (session_id, position, title, kind, slide, until_slide, reveal_slide, rows, options) values
   (s2, 1, 'News: Nvidia ohne Jensen Huang', 'wall', 3, 4, null, '["Was bedeutet das für die KI-Welt? Eure Gedanken"]', '[]'),
   (s2, 2, 'Mission: Wird eine KI jemals ein Bewusstsein haben?', 'grid', 7, null, null, '["Wird eine KI jemals ein Bewusstsein haben?"]', '["Ja", "Bin unsicher", "Nein"]'),
   (s2, 3, 'Was seht ihr?', 'wall', 8, null, null, '["Was seht ihr?"]', '[]'),
   (s2, 4, 'Beobachtungsauftrag: Anil Seth', 'text', 9, 10, null, '["Was ist der Unterschied zwischen Intelligenz und Bewusstsein?", "Warum halten wir KI für bewusst?", "Welche Rolle spielt unser Körper?"]', '[]'),
   (s2, 5, 'Woran würdet ihr es erkennen?', 'wall', 12, null, null, '["Woran würdet ihr erkennen, dass eine KI wirklich etwas fühlt?"]', '[]'),
   (s2, 6, 'Writing: Eine KI sagt, sie hat Angst', 'text', 13, null, null, '["Eine KI sagt dir: „Ich habe Angst, abgeschaltet zu werden.“ Was machst du? Zwei, drei Sätze."]', '[]'),
   (s2, 7, 'Outro: Und jetzt? Bewusstsein bei KI', 'grid', 15, null, null, '["Wird eine KI jemals ein Bewusstsein haben?"]', '["Ja", "Bin unsicher", "Nein"]');
  update ag_sessions set title = 'Kann eine KI fühlen?', published = true where id = s2;
  raise notice '7 Live-Aufgaben für Sitzung 2 angelegt.';
end $$;
select position, title, slide, until_slide, reveal_slide from live_items
where session_id = (select s.id from ag_sessions s join groups g on g.id = s.group_id
                    where g.cohort = 'Jg. 11/12' and s.date = date '2026-11-16') order by position;
