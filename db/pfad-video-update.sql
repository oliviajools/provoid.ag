-- Nur nötig, falls die Vorlage „Kann eine KI fühlen?“ schon in eine Sitzung eingefügt wurde: Aufgabe 2 auf das neue Video umstellen.
update live_items set title = 'Video-Check', kind = 'text', options = '[]', solution = null,
  rows = '["So bewusst ist KI schon: Was spricht laut Video dafür?", "Eigenleben: Was machen die KI-Agenten, und warum wirkt das so menschlich?", "Die perfekte Illusion: Warum könnte das alles nur Schein sein?"]',
  info = 'Jede Frage gehört zu einem Kapitel des Videos. Ein, zwei Sätze pro Frage reichen.'
where self_paced and title in ('Was sagt Anil Seth?', 'Video-Check');
update live_items set info = replace(info, 'Anil Seth unterscheidet zwei Dinge.', 'Forschende unterscheiden zwei Dinge.')
where self_paced and title = 'Können oder erleben?';
