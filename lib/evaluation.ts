import { z } from "zod";

/**
 * Anonyme Evaluation der KI-AG.
 * Gespeichert werden nur AG, Bogen, ein selbst gebildeter Code, die Antworten und das Datum.
 * Keine Benutzer-ID, keine Uhrzeit: So lassen sich Antworten über das Jahr verbinden, aber keiner Person zuordnen.
 */

export const SCALE = ["stimmt gar nicht", "stimmt eher nicht", "teils, teils", "stimmt eher", "stimmt genau"] as const;

export type Competency = "Verstehen" | "Prüfen" | "Entscheiden" | "Gestalten" | "Eigenes Denken" | "Hauptziel";
export const COMPETENCIES: Competency[] = ["Verstehen", "Prüfen", "Entscheiden", "Gestalten", "Eigenes Denken", "Hauptziel"];

/** Teil A1: jedes Mal gleich. rev = umgedreht formuliert, wird vor der Auswertung umgepolt. */
export const A1: { id: string; text: string; comp: Competency; rev: boolean }[] = [
  { id: "a1", text: "Ich kann erklären, wie eine KI zu ihren Antworten oder Entscheidungen kommt.", comp: "Verstehen", rev: false },
  { id: "a2", text: "Wie KI funktioniert, ist für mich ein Rätsel.", comp: "Verstehen", rev: true },
  { id: "a3", text: "Ich merke, wenn eine KI falschliegt oder etwas erfindet.", comp: "Prüfen", rev: false },
  { id: "a4", text: "Was eine KI sagt, stimmt meistens.", comp: "Prüfen", rev: true },
  { id: "a5", text: "Ich kann begründen, wofür ich KI nutze und wofür nicht.", comp: "Entscheiden", rev: false },
  { id: "a6", text: "Ich nutze KI, ohne darüber nachzudenken, ob es gerade sinnvoll ist.", comp: "Entscheiden", rev: true },
  { id: "a7", text: "Ich traue mir zu, selbst etwas mit KI einzurichten oder zu bauen.", comp: "Gestalten", rev: false },
  { id: "a8", text: "Ich weiß, wie ich meine Daten schütze, wenn ich KI nutze.", comp: "Gestalten", rev: false },
  { id: "a9", text: "Wenn ich nachdenken muss, versuche ich es erst selbst, bevor ich eine KI frage.", comp: "Eigenes Denken", rev: false },
  { id: "a10", text: "Ich kann einschätzen, wann KI mir hilft und wann sie mir das Denken abnimmt.", comp: "Hauptziel", rev: false },
];

/** Teil C: Szenarien an den Messzeitpunkten. correct = Index der Option, die 2 Punkte ermöglicht. */
export const SCENARIOS: { id: string; text: string; opts: string[] | null; correct: number | null; comp: Competency; rubric: string }[] = [
  { id: "c1", text: "Du fragst eine KI nach Quellen für dein Referat. Sie nennt dir drei Studien mit Autor und Jahr. Was machst du?",
    opts: ["Ich übernehme sie direkt.", "Ich frage die KI, ob sie sicher ist.", "Ich suche die Studien selbst.", "Ich nehme nur die neueste."], correct: 2,
    comp: "Prüfen", rubric: "2 Punkte: c) und begründet, dass KI Quellen erfinden kann." },
  { id: "c2", text: "Du sollst eine Erörterung schreiben, um das Argumentieren zu üben. Wobei würdest du KI nutzen, und wobei nicht?",
    opts: null, correct: null, comp: "Entscheiden", rubric: "2 Punkte: eine sinnvolle Nutzung und eine bewusste Grenze, begründet mit dem Ziel der Aufgabe (selbst üben)." },
  { id: "c3", text: "Dein Feed zeigt dir seit Tagen fast nur noch Videos zu einem Thema. Erkläre in zwei Sätzen, wie es dazu kommt.",
    opts: null, correct: null, comp: "Verstehen", rubric: "2 Punkte: Der Feed lernt aus dem eigenen Verhalten (Zuschauen, Wischen) und zeigt dadurch mehr vom Gleichen." },
  { id: "c4", text: "Du baust einen KI-Lernhelfer. Welche Daten darfst du ihm geben?",
    opts: ["die Klassenliste mit Namen und Noten", "deine eigenen Mitschriften", "Fotos von Mitschülerinnen und Mitschülern", "dein Passwort"], correct: 1,
    comp: "Gestalten", rubric: "2 Punkte: b) und begründet, dass Daten anderer und Zugangsdaten tabu sind." },
];

export const OPEN: { id: string; text: string; required: boolean }[] = [
  { id: "oa", text: "Was ist der wichtigste Gedanke, den du heute mitnimmst? Schreib ihn so, dass ihn jemand versteht, der nicht dabei war.", required: true },
  { id: "ob", text: "Was hat dich heute überrascht, oder wo hast du deine Meinung geändert?", required: true },
  { id: "oc", text: "Wo wirst du das im Alltag wiedererkennen, oder was machst du ab jetzt anders?", required: false },
  { id: "od", text: "Was war unklar, und was wünschst du dir für die nächste Sitzung?", required: false },
];

export type Check = { q: string; opts: string[]; correct: number };
export type EvalDef = {
  id: string; title: string; label: string;
  /** Sitzungsbogen: Thema, Kurzchecks, Teile der Sitzung. Kompass: nur A1 und Szenarien. */
  topic?: string; checks?: Check[]; parts?: string[]; scenarios: boolean;
};

export const EVALS: Record<string, EvalDef> = {
  kompass: { id: "kompass", title: "Kompass: Wo stehst du gerade?", label: "Kompass (Messzeitpunkt)", scenarios: true },
  "1": {
    id: "1", title: "Evaluation Session 1", label: "Session 1: Mensch vs. Maschine", scenarios: false,
    topic: "was KI eigentlich ist und was sie von uns Menschen unterscheidet",
    checks: [
      { q: "Welches dieser Systeme ist keine KI?", opts: ["Face ID", "Wecker", "TikTok-Feed", "Autokorrektur"], correct: 1 },
      { q: "Was kann von diesen Dingen nur ein Mensch?", opts: ["in Sekunden viele Texte lesen", "Bilder erkennen", "Sprachen übersetzen", "Verantwortung für eine Entscheidung übernehmen"], correct: 3 },
    ],
    parts: ["News", "Mission", "Kern", "Brainstorming", "Outro"],
  },
  "2": {
    id: "2", title: "Evaluation Session 2", label: "Session 2: Wer entscheidet, was du siehst?", scenarios: false,
    topic: "wie ein Algorithmus arbeitet und wie ein Feed lernt",
    checks: [
      { q: "Warum ist der TikTok-Feed eine KI, der Wecker aber nicht?", opts: ["Er ist schneller.", "Er lernt aus deinem Verhalten.", "Er hat mehr Regeln.", "Er ist online."], correct: 1 },
      { q: "Warum lernen Maschinen heute oft aus Beispielen, statt dass Menschen die Regeln aufschreiben?", opts: ["Weil es billiger ist.", "Weil Maschinen klüger sind als Menschen.", "Weil manche Dinge zu schwer sind, um sie als Regel aufzuschreiben.", "Weil es so vorgeschrieben ist."], correct: 2 },
    ],
    parts: ["News", "Mission", "Kern", "Writing", "Outro"],
  },
  "3": {
    id: "3", title: "Evaluation Session 3", label: "Session 3: Wie lernt ein Sprachmodell?", scenarios: false,
    topic: "wie aus einem Textfortsetzer ein freundlicher Chatbot wird",
    checks: [
      { q: "Was macht ein Sprachmodell nach dem Vortraining im Kern?", opts: ["Es sucht im Internet.", "Es sagt das wahrscheinlichste nächste Wort vorher.", "Es versteht die Frage wie ein Mensch.", "Es schlägt in einer Datenbank nach."], correct: 1 },
      { q: "Warum beginnt ChatGPT Antworten oft mit „Gute Frage!“?", opts: ["Es freut sich wirklich über die Frage.", "Ein Programmierer hat jede Antwort einzeln geschrieben.", "Solche Antworten wurden beim Training von Menschen belohnt.", "Es hat den Satz bei Wikipedia gelesen."], correct: 2 },
    ],
    parts: ["News", "Mission", "Kern", "Writing", "Outro"],
  },
};

export const TEMPO = ["zu langsam", "genau richtig", "zu schnell"] as const;

/** Code: 2 Buchstaben, 2 Ziffern, 2 Buchstaben, z. B. SA07KI. */
export const CODE_RE = /^[A-ZÄÖÜ]{2}[0-9]{2}[A-ZÄÖÜ]{2}$/;
export const normCode = (s: string) => s.toUpperCase().replace(/[^A-ZÄÖÜ0-9]/g, "");

const scale = z.number().int().min(0).max(5); // 0 = kann ich nicht sagen
const short = (max: number) => z.string().trim().max(max);

export const answersSchema = z.object({
  a1: z.record(z.string(), scale),
  before: z.number().int().min(1).max(5).optional(),
  now: z.number().int().min(1).max(5).optional(),
  checks: z.array(z.number().int().min(-1).max(3)).max(2).optional(),
  interest: z.number().int().min(1).max(5).optional(),
  tempo: z.number().int().min(0).max(2).optional(),
  part: z.number().int().min(0).max(4).optional(),
  open: z.record(z.string(), short(1500)).optional(),
  scen: z.record(z.string(), z.object({ choice: z.number().int().min(-1).max(3), why: short(1500) })).optional(),
});
export type EvalAnswers = z.infer<typeof answersSchema>;

/** Prüft die Antworten gegen den Bogen. Gibt eine Fehlermeldung zurück oder null. */
export function validate(def: EvalDef, a: EvalAnswers): string | null {
  for (const it of A1) if (a.a1[it.id] === undefined) return "Bitte kreuze bei Teil A jede Aussage an (notfalls „kann ich nicht sagen“).";
  if (def.checks) {
    if (!a.before || !a.now) return "Bitte beantworte die Fragen zum Thema von heute.";
    if (!a.checks || a.checks.length !== def.checks.length || a.checks.some((c) => c < 0)) return "Bitte beantworte beide Kurzchecks.";
    if (!a.interest || a.tempo === undefined || a.part === undefined) return "Bitte beantworte die drei Fragen zur Sitzung.";
    for (const o of OPEN) if (o.required && !(a.open?.[o.id] ?? "").trim()) return "Bitte beantworte die beiden Pflichtfragen in Teil B.";
  }
  if (def.scenarios) {
    for (const s of SCENARIOS) {
      const r = a.scen?.[s.id];
      if (!r || (s.opts && r.choice < 0) || !r.why.trim()) return "Bitte beantworte alle vier Situationen und schreib kurz, warum.";
    }
  }
  return null;
}

/** Wert einer Aussage nach dem Umpolen (1 bis 5), null bei „kann ich nicht sagen“. */
export function scored(itemId: string, v: number | undefined): number | null {
  if (!v) return null;
  const it = A1.find((x) => x.id === itemId);
  return it?.rev ? 6 - v : v;
}
