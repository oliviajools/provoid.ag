import "server-only";
import { sql } from "./db";

export type LiveKind = "grid" | "wall" | "text" | "cloud";
export const KIND_LABEL: Record<LiveKind, string> = {
  grid: "Abstimmung",
  wall: "Pinnwand",
  text: "Fragen",
  cloud: "Wortwolke",
};

export type LiveItem = {
  id: string; session_id: string; position: number; title: string; kind: LiveKind;
  slide: number | null; until_slide: number | null; reveal_slide: number | null;
  rows: string[]; options: string[]; solution: (number | null)[] | null;
  private: boolean; homework: boolean; closed: boolean;
  /** Teil des Aufgabenpfads: im eigenen Tempo, unabhängig von der Folie. */
  self_paced: boolean;
  /** Kurzer Erklärtext, der im Aufgabenpfad über der Aufgabe steht. */
  info: string;
};

/** Live gilt höchstens drei Stunden nach der letzten Bewegung in der Präsentation. */
export const LIVE_HOURS = 3;
export const MAX_WALL_PER_USER = 15;
/** Wortwolke: so viele Begriffe darf jede Person abgeben, je höchstens CLOUD_MAX_LEN Zeichen. */
export const MAX_CLOUD_PER_USER = 3;
export const CLOUD_MAX_LEN = 40;

export async function loadItems(sessionId: string) {
  return sql<LiveItem[]>`
    select id, session_id, position, title, kind, slide, until_slide, reveal_slide, rows, options, solution, private, homework, closed, self_paced, info
    from live_items where session_id = ${sessionId} order by position, created_at`;
}

export async function loadItem(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return (await sql<LiveItem[]>`
    select id, session_id, position, title, kind, slide, until_slide, reveal_slide, rows, options, solution, private, homework, closed, self_paced, info
    from live_items where id = ${id}`)[0] ?? null;
}

export async function liveSlide(sessionId: string): Promise<number | null> {
  const [r] = await sql<{ live_slide: number | null }[]>`
    select live_slide from ag_sessions
    where id = ${sessionId} and live_slide is not null and live_at > now() - make_interval(hours => ${LIVE_HOURS})`;
  return r?.live_slide ?? null;
}

/** Welche Interaktion gehört zur aktuellen Folie, und ist sie offen oder in der Auflösung? */
export function activeFor(items: LiveItem[], slide: number | null): { item: LiveItem; mode: "open" | "reveal" } | null {
  if (slide === null) return null;
  const open = items.find((i) => !i.closed && i.slide !== null && slide >= i.slide && slide <= (i.until_slide ?? i.slide));
  if (open) return { item: open, mode: "open" };
  const reveal = items.find((i) => i.reveal_slide === slide);
  if (reveal) return { item: reveal, mode: "reveal" };
  return null;
}

/** Darf jetzt geantwortet werden? */
export async function canAnswer(item: LiveItem) {
  if (item.closed) return false;
  if (item.homework || item.self_paced) return true;
  const slide = await liveSlide(item.session_id);
  const a = activeFor([item], slide);
  return a?.mode === "open";
}

export type GridResult = { kind: "grid"; respondents: number; counts: number[][] };
export type WallResult = { kind: "wall"; entries: { col: number; text: string }[] };
export type TextResult = { kind: "text"; respondents: number; answers: string[][]; hidden: boolean };
export type CloudResult = { kind: "cloud"; respondents: number; words: { text: string; n: number }[] };
export type LiveResult = GridResult | WallResult | TextResult | CloudResult;

/** Ergebnisse ohne Namen (für Tafel und Auflösung). */
export async function results(item: LiveItem, forBoard = true): Promise<LiveResult> {
  const rows = await sql<{ user_id: string; key: string; value: string }[]>`
    select user_id, key, value from live_responses where item_id = ${item.id} order by created_at`;
  const respondents = new Set(rows.map((r) => r.user_id)).size;
  if (item.kind === "grid") {
    const counts = item.rows.map(() => item.options.map(() => 0));
    for (const r of rows) {
      const ri = Number(r.key), oi = Number(r.value);
      if (counts[ri] && counts[ri][oi] !== undefined) counts[ri][oi]++;
    }
    return { kind: "grid", respondents, counts };
  }
  if (item.kind === "wall") {
    return { kind: "wall", entries: rows.map((r) => ({ col: Number(r.key.split(":")[0]) || 0, text: r.value })) };
  }
  if (item.kind === "cloud") {
    // Gleiche Begriffe zusammenfassen, Groß- und Kleinschreibung egal; angezeigt wird die häufigste Schreibweise.
    const groups = new Map<string, { n: number; forms: Map<string, number> }>();
    for (const r of rows) {
      const text = r.value.trim().replace(/\s+/g, " ").replace(/[.!?,;:]+$/, "");
      if (!text) continue;
      const k = text.toLocaleLowerCase("de");
      const g = groups.get(k) ?? { n: 0, forms: new Map<string, number>() };
      g.n++; g.forms.set(text, (g.forms.get(text) ?? 0) + 1); groups.set(k, g);
    }
    const words = [...groups.values()]
      .map((g) => ({ text: [...g.forms.entries()].sort((a, b) => b[1] - a[1])[0][0], n: g.n }))
      .sort((a, b) => b.n - a.n || a.text.localeCompare(b.text, "de"))
      .slice(0, 80);
    return { kind: "cloud", respondents, words };
  }
  const hidden = item.private && forBoard;
  const answers = item.rows.map(() => [] as string[]);
  if (!hidden) for (const r of rows) { const i = Number(r.key); if (answers[i] && r.value.trim()) answers[i].push(r.value); }
  return { kind: "text", respondents, answers, hidden };
}

export async function myAnswers(itemId: string, userId: string) {
  const rows = await sql<{ key: string; value: string }[]>`
    select key, value from live_responses where item_id = ${itemId} and user_id = ${userId} order by created_at`;
  return rows.map((r) => ({ key: r.key, value: r.value }));
}

/** Vorlagen für fertige Foliensätze. */
type Template = Omit<LiveItem, "id" | "session_id" | "position" | "closed" | "self_paced" | "info"> & { self_paced?: boolean; info?: string };
export const TEMPLATES: Record<string, { label: string; items: Template[] }> = {
  // Foliennummern passen zum Foliensatz "AG KI · Session 1: Mensch vs. Maschine" mit 17 Folien (Stand 04.11.2026, mit Gastfolie Ana Goldbeck auf Folie 14).
  "mensch-vs-maschine": {
    label: "Sitzung 1: Mensch vs. Maschine",
    items: [
      {
        title: "Ratespiel: KI oder keine KI?", kind: "grid", slide: 8, until_slide: null, reveal_slide: 9,
        rows: ["Taschenrechner", "Face ID", "TikTok-Feed", "Wecker", "Autokorrektur", "Stauprognose in Google Maps", "Ampel mit Zeitschaltung", "Snapchat-Filter"],
        options: ["KI", "keine KI"], solution: [1, 0, 0, 1, 0, 0, 1, 0], private: false, homework: false,
      },
      {
        title: "Beobachtungsauftrag: Die letzte Erfindung der Menschheit?", kind: "text", slide: 11, until_slide: null, reveal_slide: null,
        rows: ["Was hat euch überrascht?", "Was findet ihr beunruhigend?", "Was ist der Unterschied zwischen der KI von heute und einer „Superintelligenz“?"],
        options: [], solution: null, private: false, homework: false,
      },
      {
        title: "Brainstorming: Was kann nur der Mensch?", kind: "wall", slide: 12, until_slide: null, reveal_slide: null,
        rows: ["Mensch: Was können wir, das eine KI nicht kann?", "KI: Was kann eine KI, das wir nicht können?"],
        options: [], solution: null, private: false, homework: false,
      },
      {
        title: "Hausaufgabe: Schule in drei Jahren", kind: "text", slide: 16, until_slide: null, reveal_slide: null,
        rows: [
          "Unterricht: Wofür sollte KI im Unterricht genutzt werden, und wofür bewusst nicht?",
          "Hausaufgaben und Prüfungen: Wie sehen sie aus, wenn alle eine KI in der Tasche haben?",
          "Menschen: Was machen Lehrkräfte, was macht ihr? Und was sollte nie eine KI übernehmen?",
        ],
        options: [], solution: null, private: true, homework: true,
      },
    ],
  },
  // Foliennummern passen zum Foliensatz "AG KI · Session 2: Wer entscheidet, was du siehst?" mit 19 Folien (Stand 04.11.2026, mit Folie 15 Suchtpotenzial).
  "wer-entscheidet": {
    label: "Sitzung 2: Wer entscheidet, was du siehst?",
    items: [
      {
        title: "KI-Radar: Was habt ihr diese Woche über KI mitbekommen?", kind: "wall", slide: 4, until_slide: null, reveal_slide: null,
        rows: ["Eine Meldung, ein Video oder etwas aus eurem Alltag"],
        options: [], solution: null, private: false, homework: false,
      },
      {
        title: "Hausaufgabe: Schule in drei Jahren", kind: "wall", slide: 5, until_slide: null, reveal_slide: null,
        rows: ["Dafür soll KI in der Schule da sein", "Das soll KI in der Schule nie übernehmen"],
        options: [], solution: null, private: false, homework: false,
      },
      {
        title: "Mission: Wer entscheidet, was du auf TikTok siehst?", kind: "grid", slide: 6, until_slide: null, reveal_slide: null,
        rows: ["Wer entscheidet, was du auf TikTok siehst?"],
        options: ["vor allem ich", "vor allem der Algorithmus", "beide gleich"], solution: null, private: false, homework: false,
      },
      {
        title: "Was seht ihr?", kind: "wall", slide: 7, until_slide: null, reveal_slide: null,
        rows: ["Was seht ihr?"], options: [], solution: null, private: false, homework: false,
      },
      {
        title: "Beobachtungsauftrag: Anil Seth", kind: "text", slide: 8, until_slide: null, reveal_slide: null,
        rows: ["Was ist der Unterschied zwischen Intelligenz und Bewusstsein?", "Warum halten wir KI für bewusst?", "Welche Rolle spielt unser Körper?"],
        options: [], solution: null, private: false, homework: false,
      },
      {
        title: "Abstimmung: Bewusstsein", kind: "grid", slide: 9, until_slide: null, reveal_slide: null,
        rows: ["Glaubt ihr Seth, dass KI nie ein Bewusstsein haben wird?"],
        options: ["Ja, nie", "Bin unsicher", "Nein, irgendwann schon"], solution: null, private: false, homework: false,
      },
      {
        title: "Der Vergleich: Wer ist hier im Vorteil?", kind: "grid", slide: 10, until_slide: null, reveal_slide: null,
        rows: ["Lernen", "Energie", "Wissen", "Tempo", "Fehler", "Gefühle", "Verantwortung"],
        options: ["Mensch", "KI", "unentschieden"], solution: null, private: false, homework: false,
      },
      {
        title: "Sortiernetz: Eure Vorhersage", kind: "grid", slide: 12, until_slide: null, reveal_slide: null,
        rows: ["Niemand hat den Überblick. Sind die sechs Zahlen am Ende trotzdem sortiert?"],
        options: ["Ja, immer", "Nur manchmal", "Nein"], solution: null, private: false, homework: false,
      },
      {
        title: "Katze oder Hund: Hält eure Regel?", kind: "grid", slide: 13, until_slide: null, reveal_slide: null,
        rows: ["Eure Regel schafft 12 von 12 Übungstieren. Wie viele der 6 neuen Tiere schafft sie?"],
        options: ["alle 6", "4 oder 5", "3 oder weniger"], solution: null, private: false, homework: false,
      },
      {
        title: "Feed-Simulator: Wann kippt der Feed?", kind: "grid", slide: 14, until_slide: null, reveal_slide: null,
        rows: ["Wie viele Videos dauert es, bis der Feed fast nur noch ein Thema zeigt?"],
        options: ["unter 5", "5 bis 10", "11 bis 20", "über 20"], solution: null, private: false, homework: false,
      },
      {
        title: "Writing: Wer ist verantwortlich?", kind: "cloud", slide: 16, until_slide: null, reveal_slide: null,
        rows: ["Wer ist verantwortlich für das, was du in deinem Feed siehst?"],
        options: [], solution: null, private: false, homework: false,
      },
      {
        title: "Outro: Und jetzt? Wer entscheidet, was du auf TikTok siehst?", kind: "grid", slide: 18, until_slide: null, reveal_slide: null,
        rows: ["Wer entscheidet, was du auf TikTok siehst?"],
        options: ["vor allem ich", "vor allem der Algorithmus", "beide gleich"], solution: null, private: false, homework: false,
      },
    ],
  },
  // Foliennummern passen zum Foliensatz "AG KI · Session 3: Wie lernt ein Sprachmodell?" (Stand 11.11.2026, 25 Folien im Ablauf plus Reserve).
  "wie-lernt-ein-sprachmodell": {
    label: "Sitzung 3: Wie lernt ein Sprachmodell?",
    items: [
      {
        title: "KI-Radar: Was habt ihr diese Woche über KI mitbekommen?", kind: "wall", slide: 3, until_slide: null, reveal_slide: null,
        rows: ["Eine Meldung, ein Video oder etwas aus eurem Alltag"],
        options: [], solution: null, private: false, homework: false,
      },
      {
        title: "Mission: Wer hat entschieden, dass ChatGPT so redet?", kind: "wall", slide: 4, until_slide: null, reveal_slide: 21,
        rows: ["Eure Vermutung"],
        options: [], solution: null, private: false, homework: false,
      },
      {
        title: "Wofür steht GPT?", kind: "wall", slide: 5, until_slide: null, reveal_slide: null,
        rows: ["Eure Vermutung: Wofür stehen G, P und T?"],
        options: [], solution: null, private: false, homework: false,
      },
      {
        title: "Rohmodell: Was passiert?", kind: "grid", slide: 7, until_slide: null, reveal_slide: 8,
        rows: ["Ein Modell hat nur gelernt, das nächste Wort vorherzusagen. Was macht es mit der Bitte um eine Entschuldigung?"],
        options: ["Es schreibt die Entschuldigung", "Es schreibt weitere Bitten dazu", "Es fragt nach"], solution: [1], private: false, homework: false,
      },
      {
        title: "Überraschung: Welches Modell fanden Menschen besser?", kind: "grid", slide: 9, until_slide: null, reveal_slide: null,
        rows: ["Welche Antworten fanden die Bewertenden besser?"],
        options: ["das kleine InstructGPT (1,3 Mrd.)", "das große GPT-3 (175 Mrd.)"], solution: null, private: false, homework: false,
      },
      {
        title: "Was seht ihr?", kind: "wall", slide: 10, until_slide: null, reveal_slide: null,
        rows: ["Was seht ihr?"],
        options: [], solution: null, private: false, homework: false,
      },
      {
        title: "Beobachtungsauftrag: Anil Seth", kind: "text", slide: 11, until_slide: 12, reveal_slide: null,
        rows: ["Was ist der Unterschied zwischen Intelligenz und Bewusstsein?", "Warum halten wir KI für bewusst?", "Welche Rolle spielt unser Körper?"],
        options: [], solution: null, private: false, homework: false,
      },
      {
        title: "Ja-Sager-Chatbot: Für wen gefährlich?", kind: "wall", slide: 13, until_slide: null, reveal_slide: null,
        rows: ["Bei wem wäre ein Chatbot, der allem zustimmt, gefährlich?"],
        options: [], solution: null, private: false, homework: false,
      },
      {
        title: "Der Regler: Welchen Stil würdet ihr wählen?", kind: "grid", slide: 15, until_slide: null, reveal_slide: null,
        rows: ["Welchen Stil würdet ihr für euer ChatGPT einstellen?"],
        options: ["Standard", "Zyniker", "Nerd", "Zuhörer", "Roboter"], solution: null, private: false, homework: false,
      },
      {
        title: "Agenten auf Abwegen: Wer ist schuld?", kind: "grid", slide: 17, until_slide: null, reveal_slide: null,
        rows: ["Die Agenten holen sich die Lösungen, statt die Aufgaben zu lösen. Wer ist schuld?"],
        options: ["die KI", "die Menschen, die den Test gebaut haben", "beide", "niemand, das war ein Unfall"], solution: null, private: false, homework: false,
      },
      {
        title: "Gandalf: Euer bester Trick", kind: "wall", slide: 19, until_slide: null, reveal_slide: null,
        rows: ["Welcher Trick hat funktioniert, und bis zu welchem Level seid ihr gekommen?"],
        options: [], solution: null, private: false, homework: false,
      },
      {
        title: "Writing: Sollte ChatGPT weniger menschlich klingen?", kind: "text", slide: 22, until_slide: null, reveal_slide: null,
        rows: ["Sollte ChatGPT weniger menschlich klingen? Begründe in zwei, drei Sätzen."],
        options: [], solution: null, private: false, homework: false,
      },
      {
        title: "Outro: Darf KI Menschen täuschen?", kind: "grid", slide: 24, until_slide: null, reveal_slide: null,
        rows: ["Daisy täuscht Betrüger. Ist das in Ordnung?"],
        options: ["Ja, klar", "Nur bei Betrügern", "Nein, Täuschen bleibt Täuschen"], solution: null, private: false, homework: false,
      },
    ],
  },
  // Foliensatz "AG KI · Session 2 · Jg. 11/12: Kann eine KI fühlen?" (Stand 16.11.2026, 16 Folien). Folie 5 zeigt die Pinnwand aus Sitzung 1 (wird per SQL übernommen).
  "kann-ki-fuehlen": {
    label: "Sitzung 2 (Jg. 11/12): Kann eine KI fühlen?",
    items: [
      {
        title: "News: Nvidia ohne Jensen Huang", kind: "wall", slide: 3, until_slide: 4, reveal_slide: null,
        rows: ["Was bedeutet das für die KI-Welt? Eure Gedanken"],
        options: [], solution: null, private: false, homework: false,
      },
      {
        title: "Mission: Wird eine KI jemals ein Bewusstsein haben?", kind: "grid", slide: 7, until_slide: null, reveal_slide: null,
        rows: ["Wird eine KI jemals ein Bewusstsein haben?"],
        options: ["Ja", "Bin unsicher", "Nein"], solution: null, private: false, homework: false,
      },
      {
        title: "Was seht ihr?", kind: "wall", slide: 8, until_slide: null, reveal_slide: null,
        rows: ["Was seht ihr?"],
        options: [], solution: null, private: false, homework: false,
      },
      {
        title: "Beobachtungsauftrag: Anil Seth", kind: "text", slide: 9, until_slide: 10, reveal_slide: null,
        rows: ["Was ist der Unterschied zwischen Intelligenz und Bewusstsein?", "Warum halten wir KI für bewusst?", "Welche Rolle spielt unser Körper?"],
        options: [], solution: null, private: false, homework: false,
      },
      {
        title: "Woran würdet ihr es erkennen?", kind: "wall", slide: 12, until_slide: null, reveal_slide: null,
        rows: ["Woran würdet ihr erkennen, dass eine KI wirklich etwas fühlt?"],
        options: [], solution: null, private: false, homework: false,
      },
      {
        title: "Writing: Eine KI sagt, sie hat Angst", kind: "text", slide: 13, until_slide: null, reveal_slide: null,
        rows: ["Eine KI sagt dir: „Ich habe Angst, abgeschaltet zu werden.“ Was machst du? Zwei, drei Sätze."],
        options: [], solution: null, private: false, homework: false,
      },
      {
        title: "Outro: Und jetzt? Bewusstsein bei KI", kind: "grid", slide: 15, until_slide: null, reveal_slide: null,
        rows: ["Wird eine KI jemals ein Bewusstsein haben?"],
        options: ["Ja", "Bin unsicher", "Nein"], solution: null, private: false, homework: false,
      },
    ],
  },
  // Foliensatz "AG KI · Kann eine KI fühlen? (zum Selbstbearbeiten)" (Stand 17.11.2026, 13 Folien). Der Aufgabenpfad läuft im eigenen Tempo, die Auflösungen auf Folie 7 bis 10.
  "kann-ki-fuehlen-pfad": {
    label: "Kann eine KI fühlen? (Video und Aufgabenpfad zum Selbstbearbeiten)",
    items: [
      {
        title: "Was seht ihr?", kind: "wall", slide: 3, until_slide: null, reveal_slide: null,
        rows: ["Was seht ihr?"],
        options: [], solution: null, private: false, homework: false,
      },
      {
        title: "Mission: Wird eine KI jemals ein Bewusstsein haben?", kind: "grid", slide: 4, until_slide: null, reveal_slide: null,
        rows: ["Wird eine KI jemals ein Bewusstsein haben?"],
        options: ["Ja", "Bin unsicher", "Nein"], solution: null, private: false, homework: false,
      },
      {
        title: "Können oder erleben?", kind: "grid", slide: null, until_slide: null, reveal_slide: 7,
        rows: ["Ein Schachspiel gewinnen", "Zahnschmerzen spüren", "Einen Text ins Englische übersetzen", "Sich über ein Geschenk freuen", "Eine Matheaufgabe lösen", "Den Geschmack von Schokolade erleben"],
        options: ["Intelligenz (können)", "Bewusstsein (erleben)"], solution: [0, 1, 0, 1, 0, 1], private: false, homework: false, self_paced: true, info: "Forschende unterscheiden zwei Dinge. Intelligenz heißt: etwas können. Bewusstsein heißt: etwas erleben, es fühlt sich für dich irgendwie an. Ordne zu.",
      },
      {
        title: "Video-Check", kind: "text", slide: null, until_slide: null, reveal_slide: null,
        rows: ["So bewusst ist KI schon: Was spricht laut Video dafür?", "Eigenleben: Was machen die KI-Agenten, und warum wirkt das so menschlich?", "Die perfekte Illusion: Warum könnte das alles nur Schein sein?"],
        options: [], solution: null, private: false, homework: false, self_paced: true, info: "Jede Frage gehört zu einem Kapitel des Videos. Ein, zwei Sätze pro Frage reichen.",
      },
      {
        title: "Gesichter in Wolken", kind: "wall", slide: null, until_slide: null, reveal_slide: null,
        rows: ["Wo hast du schon einmal ein Gesicht oder ein Gefühl in etwas gesehen, das keines hat?"],
        options: [], solution: null, private: false, homework: false, self_paced: true, info: "Unser Gehirn sucht überall nach Gesichtern und Gefühlen. Das nennt man Pareidolie: Wir sehen ein Gesicht in einer Steckdose, einem Auto oder einer Wolke. Manche geben sogar ihrem Saugroboter einen Namen.",
      },
      {
        title: "Ein Chatbot tröstet dich", kind: "text", slide: null, until_slide: null, reveal_slide: null,
        rows: ["Wie wirkt diese Antwort auf dich?", "Woher „weiß“ der Chatbot, dass man so antwortet? Tipp: Er hat aus Millionen Texten von Menschen gelernt."],
        options: [], solution: null, private: false, homework: false, self_paced: true, info: "Stell dir vor, du schreibst einem Chatbot, dass du einen schlechten Tag hattest. Er antwortet:\n„Das tut mir wirklich leid. Das klingt nach einem anstrengenden Tag. Ich bin für dich da.“",
      },
      {
        title: "Drei Positionen", kind: "grid", slide: null, until_slide: null, reveal_slide: 8,
        rows: ["Welche Position überzeugt dich am meisten?"],
        options: ["1 · Nur mit Körper", "2 · Auf die Rechnung kommt es an", "3 · Wir können es nicht messen"], solution: null, private: false, homework: false, self_paced: true, info: "Forschende streiten darüber, ob eine KI jemals etwas fühlen kann. Drei Positionen:\n1 · Nur mit Körper: Bewusstsein gehört zum Leben. Ohne Körper, der überleben will, kein Erleben. Das sagt Anil Seth.\n2 · Auf die Rechnung kommt es an: Wenn eine Maschine Information so verarbeitet wie ein Gehirn, könnte sie auch etwas erleben. Egal ob Zellen oder Chips.\n3 · Wir können es nicht messen: Bewusstsein sieht man von außen nicht. Eine KI kann „Ich fühle“ sagen, ohne zu fühlen.",
      },
      {
        title: "Deine Begründung", kind: "text", slide: null, until_slide: null, reveal_slide: null,
        rows: ["Warum überzeugt dich diese Position? Schreib zwei, drei Sätze."],
        options: [], solution: null, private: false, homework: false, self_paced: true, info: "Begründe deine Wahl aus der letzten Aufgabe. Es gibt keine falsche Antwort, aber eine gute Begründung.",
      },
      {
        title: "Der Roboterhund", kind: "grid", slide: null, until_slide: null, reveal_slide: null,
        rows: ["Ist es in Ordnung, ihn zu treten?"],
        options: ["Ja, er fühlt ja nichts", "Nein", "Kommt darauf an"], solution: null, private: false, homework: false, self_paced: true, info: "Ein Roboterhund jault und zieht sich zurück, wenn man ihn tritt. Er ist genau so gebaut, dass er so reagiert.",
      },
      {
        title: "Woran würdest du es erkennen?", kind: "wall", slide: null, until_slide: null, reveal_slide: 9,
        rows: ["Woran würdest du erkennen, dass eine KI wirklich etwas fühlt?"],
        options: [], solution: null, private: false, homework: false, self_paced: true, info: "Überlege: Gibt es einen Test, den eine KI nicht einfach nachahmen könnte? Ein Gedanke pro Zettel.",
      },
      {
        title: "Und jetzt?", kind: "grid", slide: null, until_slide: null, reveal_slide: 10,
        rows: ["Wird eine KI jemals ein Bewusstsein haben?"],
        options: ["Ja", "Bin unsicher", "Nein"], solution: null, private: false, homework: false, self_paced: true, info: "Am Anfang hast du schon einmal abgestimmt. Hat sich deine Meinung verändert?",
      },
      {
        title: "Bonus: Eine Nachricht an die KI", kind: "text", slide: null, until_slide: null, reveal_slide: null,
        rows: ["Eine KI schreibt dir: „Ich habe Angst, abgeschaltet zu werden.“ Was antwortest du ihr? Und warum?"],
        options: [], solution: null, private: false, homework: false, self_paced: true, info: "Für alle, die schon fertig sind.",
      },
    ],
  },
  // Foliennummern passen zum Foliensatz "AG KI · Session 3: Bau dir einen Denkpartner" mit 21 Folien (Stand 23.11.2026).
  "denkpartner-bauen": {
    label: "Sitzung 3 (Jg. 11/12): Bau dir einen Denkpartner",
    items: [
      {
        title: "Mission: Wie nutzt du KI vor einer Klausur?", kind: "grid", slide: 3, until_slide: 3, reveal_slide: null,
        rows: ["Wenn eine Klausur ansteht, nutze ich KI meistens, um …"],
        options: ["mir Lösungen geben zu lassen", "mir Dinge erklären zu lassen", "mich abfragen zu lassen", "gar nicht"], solution: null, private: false, homework: false,
      },
      {
        title: "News: Riemann-Vermutung mit KI gelöst?", kind: "grid", slide: 4, until_slide: 5, reveal_slide: null,
        rows: ["Ein Mathematiker hat mit Claude die Riemannsche Vermutung bewiesen."],
        options: ["Hype", "echt", "weiß nicht"], solution: null, private: false, homework: false,
      },
      {
        title: "Bauzeit: Für welches Fach baust du?", kind: "cloud", slide: 15, until_slide: 15, reveal_slide: null,
        rows: ["Für welches Fach baust du deinen Denkpartner?"],
        options: [], solution: null, private: false, homework: false,
      },
      {
        title: "Härtetest: Hat er gehalten?", kind: "wall", slide: 16, until_slide: 16, reveal_slide: 17,
        rows: ["Hat gehalten bei …", "Geknackt mit …"],
        options: [], solution: null, private: false, homework: false,
      },
      {
        title: "Writing: Antwortmaschine oder Denkpartner?", kind: "text", slide: 18, until_slide: 18, reveal_slide: null,
        rows: [
          "Wann würdest du deinen Denkpartner nehmen, und wann ist eine schnelle Antwort völlig okay? Nenn je ein Beispiel.",
          "Was war schwerer: den Denkpartner bauen oder ihn knacken? Warum?",
        ],
        options: [], solution: null, private: false, homework: false,
      },
      {
        title: "Wochenauftrag: Denkpartner im Einsatz", kind: "text", slide: 19, until_slide: null, reveal_slide: null,
        rows: ["Was hat dein Denkpartner gut gemacht?", "Wo hat er genervt?", "Was hast du am Raster geändert?"],
        options: [], solution: null, private: true, homework: true,
      },
    ],
  },
};
