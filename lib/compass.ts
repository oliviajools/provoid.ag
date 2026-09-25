import { z } from "zod";

/* ------------------------------------------------------------------
   Inhalte der Kompass-Befragung.
   Alle Projektkarten sind echte Projekte von Jugendlichen (recherchiert
   im September 2026). Quelle steht jeweils dabei.
------------------------------------------------------------------- */

export const THEMES = {
  sport: "Sport und Bewegung",
  musik: "Musik und Kunst",
  medien: "Medien und Wahrheit",
  umwelt: "Umwelt und Klima",
  tiere: "Tiere und Natur",
  gesundheit: "Gesundheit und Medizin",
  inklusion: "Gehirn und Inklusion",
  alltag: "Stadt, Alltag und Sicherheit",
  forschung: "Weltall und Forschung",
  lernen: "Lernen und Schule",
  kiverstehen: "KI verstehen und hinterfragen",
} as const;
export type ThemeKey = keyof typeof THEMES;

export type ProjectCard = {
  id: string;
  theme: ThemeKey;
  title: string;
  text: string;
  who: string;
  where: string;
  source: string;
};

export const CARDS: ProjectCard[] = [
  { id: "skillfit", theme: "sport", title: "Fairere Sportnoten",
    text: "Eine KI bewertet im Sportunterricht deinen persönlichen Fortschritt statt nur feste Leistungswerte.",
    who: "Fünf Jugendliche aus der Nähe von Bremen", where: "Vorgestellt bei den Olympischen Winterspielen 2026",
    source: "https://www.schwaebische.de/panorama/jugendliche-wollen-mit-ki-sportunterricht-fairer-machen-4378282" },
  { id: "choral", theme: "musik", title: "KI komponiert Choräle",
    text: "Eine KI lernt aus jahrhundertealten gregorianischen Gesängen und komponiert neue Stücke im selben Stil.",
    who: "Andreas, Lukas, Valentin und Alexander, 18 bis 19", where: "Bundeswettbewerb KI 2025, Publikumspreis",
    source: "https://idw-online.de/en/news861684" },
  { id: "synthetic-eye", theme: "medien", title: "Fake-Fotos entlarven",
    text: "Eine KI erkennt, ob ein Foto echt ist oder manipuliert wurde.",
    who: "Jakob und Noah, beide 16", where: "Bundeswettbewerb KI 2023",
    source: "https://uni-tuebingen.de/universitaet/aktuelles-und-publikationen/pressemitteilungen/newsfullview-pressemitteilungen/article/deutschlands-ki-nachwuchs-beim-bundeswettbewerb-kuenstliche-intelligenz-ausgezeichnet/" },
  { id: "telefonbetrug", theme: "alltag", title: "Schutz vor Telefonbetrug",
    text: "Eine KI hört bei Anrufen mit und warnt in Echtzeit, wenn jemand versucht zu betrügen.",
    who: "Vincent, 19, aus Bayern", where: "Jugend forscht 2026, Preis für die innovativste Arbeit",
    source: "https://www.jugend-forscht.de/presse/pressemitteilungen/archiv/jugend-forscht-bundesbildungsministerin-karin-prien-kuert-die-bundessiegerinnen-und-bundessieger-2026-in-herzogenaurach.html" },
  { id: "leichte-sprache", theme: "inklusion", title: "Texte in Leichter Sprache",
    text: "Ein Sprachmodell übersetzt schwierige Texte in Leichte Sprache. Getestet mit den Menschen, die sie brauchen.",
    who: "Magnus, 18, aus Potsdam", where: "Jugend forscht 2026, KI-Sonderpreis",
    source: "https://www.iu.de/news/ki-sonderpreis-bei-jugend-forscht-iu-internationale-hochschule-kuert-bundessieger/" },
  { id: "brainhome", theme: "inklusion", title: "Türen öffnen mit Gedanken",
    text: "Eine günstige EEG-Kappe misst Gehirnsignale, eine KI übersetzt sie: So steuern Menschen mit Behinderung Türen und Heizung.",
    who: "Jonathan, 19, aus Göttingen", where: "Bundeswettbewerb KI 2023, Hauptpreis",
    source: "https://uni-tuebingen.de/universitaet/aktuelles-und-publikationen/pressemitteilungen/newsfullview-pressemitteilungen/article/deutschlands-ki-nachwuchs-beim-bundeswettbewerb-kuenstliche-intelligenz-ausgezeichnet/" },
  { id: "igelretter", theme: "tiere", title: "Der Igelretter",
    text: "Ein Mähroboter erkennt per KI, wenn ein Igel im Gras sitzt, und hält rechtzeitig an.",
    who: "Sebastian, 20, aus der Nähe von Freiburg", where: "Bundeswettbewerb KI 2023",
    source: "https://uni-tuebingen.de/universitaet/aktuelles-und-publikationen/pressemitteilungen/newsfullview-pressemitteilungen/article/deutschlands-ki-nachwuchs-beim-bundeswettbewerb-kuenstliche-intelligenz-ausgezeichnet/" },
  { id: "bee-ai", theme: "tiere", title: "Bienen retten",
    text: "Eine KI erkennt auf Fotos Varroamilben, die ganze Bienenvölker töten können.",
    who: "Sebastian, 17, aus Pforzheim", where: "Bundeswettbewerb KI 2024",
    source: "https://www.sonntagsblatt.de/artikel/epd/bundeswettbewerb-ki-praemiert-schuelerprojekte" },
  { id: "muelleimer", theme: "umwelt", title: "Der Mülleimer, der selbst trennt",
    text: "Eine Kamera erkennt, ob etwas Plastik, Papier, Dose oder Restmüll ist, und ein kleines Fahrzeug bringt es in die richtige Tonne.",
    who: "Mario, Maxi und Julius vom Gymnasium Miesbach", where: "Jugend forscht 2024",
    source: "https://www.jugend-forscht-bayern.de/projekte/anzeigen/muelleimer-mit-kuenstlicher-intelligenz/" },
  { id: "demand-detective", theme: "umwelt", title: "Weniger Lebensmittel im Müll",
    text: "Eine KI sagt voraus, wie viel ein Supermarkt verkaufen wird, damit weniger Essen weggeworfen wird.",
    who: "Leonie, Philip, Paula und Amelie, 15 bis 17, aus Regensburg", where: "Bundeswettbewerb KI 2023",
    source: "https://uni-tuebingen.de/universitaet/aktuelles-und-publikationen/pressemitteilungen/newsfullview-pressemitteilungen/article/deutschlands-ki-nachwuchs-beim-bundeswettbewerb-kuenstliche-intelligenz-ausgezeichnet/" },
  { id: "ampel", theme: "alltag", title: "Die schlaue Ampel",
    text: "Eine KI steuert Ampeln so, dass der Verkehr besser fließt, sicherer wird und weniger CO₂ entsteht.",
    who: "Leonie, 18, aus Regensburg", where: "Bundeswettbewerb KI 2024",
    source: "https://www.sonntagsblatt.de/artikel/epd/bundeswettbewerb-ki-praemiert-schuelerprojekte" },
  { id: "glucodastra", theme: "gesundheit", title: "Blutzucker ohne Nadel",
    text: "Ein selbst gebauter Fingersensor mit KI misst den Blutzucker, ganz ohne Piks.",
    who: "Peter, 17, aus Hannover", where: "Bundeswettbewerb KI 2025",
    source: "https://idw-online.de/en/news861684" },
  { id: "schlaganfall", theme: "gesundheit", title: "Schlaganfälle schneller erkennen",
    text: "Eine KI wertet CT-Bilder schneller aus, damit Ärztinnen früher helfen können und Patienten weniger Strahlung abbekommen.",
    who: "Simon, 18, aus Hannover", where: "Bundeswettbewerb KI 2025, AI for Good Award",
    source: "https://idw-online.de/en/news861684" },
  { id: "weltall", theme: "forschung", title: "1,5 Millionen neue Himmelsobjekte",
    text: "Eine KI durchsucht 200 Milliarden Messwerte eines NASA-Teleskops und findet 1,5 Millionen bisher unbekannte Objekte.",
    who: "Matteo, 18, aus Kalifornien", where: "Regeneron Science Talent Search 2025, 1. Platz",
    source: "https://www.smithsonianmag.com/smart-news/high-school-student-discovers-1-5-million-potential-new-astronomical-objects-by-developing-an-ai-algorithm-180986429/" },
  { id: "aussprache", theme: "lernen", title: "Aussprache-Trainer",
    text: "Eine KI hört zu, wenn du eine Fremdsprache sprichst, und gibt dir Feedback zur Aussprache.",
    who: "Daniel, Luis und Emanuel", where: "Bundeswettbewerb KI 2021",
    source: "https://www.bw-ki.de/rueckblick" },
  { id: "deversai", theme: "kiverstehen", title: "Einem Sprachmodell ins Gehirn schauen",
    text: "Ein Sprachmodell liest Texte vorwärts und rückwärts. So wird sichtbar, wie es zu seinen Antworten kommt.",
    who: "Leo, 17, aus Stralsund", where: "Bundeswettbewerb KI 2025, Hauptpreis",
    source: "https://idw-online.de/en/news861684" },
  { id: "physik-schlaegt-ki", theme: "kiverstehen", title: "Wenn KI nicht die beste Lösung ist",
    text: "Zwei 14-Jährige zeigen: Bei seltenen Spiegelbild-Proteinen sagen klassische Physik-Modelle die Struktur besser voraus als KI.",
    who: "Viyona und Aarav, beide 14", where: "Jugend forscht 2026, Preis des Bundespräsidenten",
    source: "https://www.jugend-forscht.de/presse/pressemitteilungen/archiv/jugend-forscht-bundesbildungsministerin-karin-prien-kuert-die-bundessiegerinnen-und-bundessieger-2026-in-herzogenaurach.html" },
];

export const FEELINGS = ["neugierig", "begeistert", "skeptisch", "verunsichert", "genervt", "egal"] as const;

export const USAGE = [
  "Hausaufgaben und Lernen", "Texte schreiben", "Fragen stellen und chatten", "Bilder oder Videos",
  "Musik", "Programmieren", "Recherche", "Gar nicht",
] as const;

export const FREQUENCY = ["nie", "ab und zu", "jede Woche", "fast jeden Tag"] as const;

export const PAIRS = [
  { id: "why", left: "verstehen, wie etwas funktioniert", right: "etwas Nützliches bauen" },
  { id: "social", left: "allein tüfteln", right: "im Team arbeiten" },
  { id: "pace", left: "einfach ausprobieren", right: "erst gründlich nachdenken" },
  { id: "stage", left: "etwas zeigen und präsentieren", right: "im Hintergrund wirken" },
  { id: "medium", left: "Technik und Code", right: "Gestaltung und Geschichten" },
  { id: "novel", left: "etwas ganz Neues erfinden", right: "etwas Bestehendes verbessern" },
] as const;
export type PairId = (typeof PAIRS)[number]["id"];

export const SKILLS = [
  { id: "funktion", phase: "Durchschauen", label: "Ich kann erklären, wie ein Sprachmodell eine Antwort erzeugt." },
  { id: "fehler", phase: "Durchschauen", label: "Ich merke, wenn eine KI Unsinn erzählt." },
  { id: "quellen", phase: "Einordnen", label: "Ich kann prüfen, ob eine Quelle glaubwürdig ist." },
  { id: "folgen", phase: "Einordnen", label: "Ich weiß, was KI mit Umwelt und Gesellschaft macht." },
  { id: "prompten", phase: "Bauen", label: "Ich kann einer KI gezielt Aufgaben geben." },
  { id: "bauen", phase: "Bauen", label: "Ich habe schon etwas mit KI gebaut." },
] as const;
export const SKILL_SHORT: Record<string, string> = {
  funktion: "Funktionsweise", fehler: "Fehler erkennen", quellen: "Quellen prüfen",
  folgen: "Folgen einschätzen", prompten: "Gezielt nutzen", bauen: "Selbst bauen",
};

export const GOAL_DIRECTIONS = [
  { id: "verstehen", label: "Etwas verstehen", prefix: "Bis März will ich verstehen, " },
  { id: "einordnen", label: "Etwas einschätzen können", prefix: "Bis März will ich einschätzen können, " },
  { id: "bauen", label: "Etwas bauen", prefix: "Bis März will ich gebaut haben: " },
] as const;

export const IFTHEN_SUGGESTIONS = [
  "denke ich erst fünf Minuten selbst nach",
  "frage ich jemanden aus der AG",
  "frage ich meine Coach",
  "zerlege ich das Problem in kleinere Schritte",
] as const;

/* ------------------------------ Validierung ------------------------------ */

const skillScore = z.number().int().min(1).max(5);
export const answersSchema = z.object({
  feelings: z.array(z.enum(FEELINGS)).max(FEELINGS.length),
  usage: z.array(z.enum(USAGE)).max(USAGE.length),
  frequency: z.enum(FREQUENCY),
  cards: z.record(z.string(), z.enum(["yes", "no"])),
  pairs: z.record(z.string(), z.enum(["left", "both", "right"])),
  skills: z.record(z.string(), skillScore),
  dream: z.string().trim().min(3, "Erzähl uns kurz von deinem Traumprojekt.").max(800),
  problem: z.string().trim().max(600),
  goalDirection: z.enum(["verstehen", "einordnen", "bauen"]),
  goal: z.string().trim().min(3, "Ergänze deinen Satz zum Ziel.").max(300),
  ifthen: z.string().trim().min(3, "Ergänze deinen Wenn-dann-Plan.").max(300),
  share: z.enum(["name", "anon", "no"]),
});
export type Answers = z.infer<typeof answersSchema>;

/* ------------------------------ Auswertung ------------------------------ */

export function topThemes(cards: Answers["cards"], n = 3): ThemeKey[] {
  const score = new Map<ThemeKey, number>();
  for (const c of CARDS) if (cards[c.id] === "yes") score.set(c.theme, (score.get(c.theme) ?? 0) + 1);
  const order = Object.keys(THEMES) as ThemeKey[];
  return [...score.entries()]
    .sort((a, b) => b[1] - a[1] || order.indexOf(a[0]) - order.indexOf(b[0]))
    .slice(0, n)
    .map(([k]) => k);
}

export function workStyle(pairs: Answers["pairs"]): string[] {
  const out: string[] = [];
  for (const p of PAIRS) {
    const v = pairs[p.id];
    if (v === "left") out.push(`lieber ${p.left}`);
    else if (v === "right") out.push(`lieber ${p.right}`);
    else if (v === "both") out.push(`${p.left} und ${p.right}, beides gern`);
  }
  return out;
}

const MISSION_TOPIC: Record<ThemeKey, string> = {
  sport: "KI im Sport", musik: "KI in Musik oder Kunst", medien: "KI und Fake News",
  umwelt: "KI und Klima", tiere: "KI und Tiere", gesundheit: "KI in der Medizin",
  inklusion: "KI und Barrierefreiheit", alltag: "KI im Alltag oder im Verkehr",
  forschung: "KI in der Forschung", lernen: "KI in der Schule", kiverstehen: "wie KI funktioniert oder wo sie versagt",
};

export function firstMission(themes: ThemeKey[]) {
  const t = themes[0] ?? "kiverstehen";
  const card = CARDS.find((c) => c.theme === t)!;
  return {
    task: `Finde bis zur nächsten Session eine aktuelle Nachricht zum Thema „${MISSION_TOPIC[t]}“ und bring sie mit. Frag dich dabei: Wer hat das geschrieben, und woher wissen die das?`,
    card,
  };
}
