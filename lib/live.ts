import "server-only";
import { sql } from "./db";

export type LiveKind = "grid" | "wall" | "text";
export const KIND_LABEL: Record<LiveKind, string> = {
  grid: "Abstimmung",
  wall: "Pinnwand",
  text: "Fragen",
};

export type LiveItem = {
  id: string; session_id: string; position: number; title: string; kind: LiveKind;
  slide: number | null; until_slide: number | null; reveal_slide: number | null;
  rows: string[]; options: string[]; solution: (number | null)[] | null;
  private: boolean; homework: boolean; closed: boolean;
};

/** Live gilt höchstens drei Stunden nach der letzten Bewegung in der Präsentation. */
export const LIVE_HOURS = 3;
export const MAX_WALL_PER_USER = 15;

export async function loadItems(sessionId: string) {
  return sql<LiveItem[]>`
    select id, session_id, position, title, kind, slide, until_slide, reveal_slide, rows, options, solution, private, homework, closed
    from live_items where session_id = ${sessionId} order by position, created_at`;
}

export async function loadItem(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return (await sql<LiveItem[]>`
    select id, session_id, position, title, kind, slide, until_slide, reveal_slide, rows, options, solution, private, homework, closed
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
  if (item.homework) return true;
  const slide = await liveSlide(item.session_id);
  const a = activeFor([item], slide);
  return a?.mode === "open";
}

export type GridResult = { kind: "grid"; respondents: number; counts: number[][] };
export type WallResult = { kind: "wall"; entries: { col: number; text: string }[] };
export type TextResult = { kind: "text"; respondents: number; answers: string[][]; hidden: boolean };
export type LiveResult = GridResult | WallResult | TextResult;

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
type Template = Omit<LiveItem, "id" | "session_id" | "position" | "closed">;
export const TEMPLATES: Record<string, { label: string; items: Template[] }> = {
  "mensch-vs-maschine": {
    label: "Sitzung 1: Mensch vs. Maschine",
    items: [
      {
        title: "Ratespiel: KI oder keine KI?", kind: "grid", slide: 7, until_slide: null, reveal_slide: 8,
        rows: ["Taschenrechner", "Face ID", "TikTok-Feed", "Wecker", "Autokorrektur", "Stauprognose in Google Maps", "Ampel mit Zeitschaltung", "Snapchat-Filter"],
        options: ["KI", "keine KI"], solution: [1, 0, 0, 1, 0, 0, 1, 0], private: false, homework: false,
      },
      {
        title: "Beobachtungsauftrag: Die letzte Erfindung der Menschheit?", kind: "text", slide: 11, until_slide: 12, reveal_slide: null,
        rows: ["Was hat euch überrascht?", "Was findet ihr beunruhigend?", "Was ist der Unterschied zwischen der KI von heute und einer „Superintelligenz“?"],
        options: [], solution: null, private: false, homework: false,
      },
      {
        title: "Brainstorming: Was kann nur der Mensch?", kind: "wall", slide: 13, until_slide: null, reveal_slide: null,
        rows: ["Mensch: Was können wir, das eine KI nicht kann?", "KI: Was kann eine KI, das wir nicht können?"],
        options: [], solution: null, private: false, homework: false,
      },
      {
        title: "Was seht ihr?", kind: "wall", slide: 14, until_slide: null, reveal_slide: null,
        rows: ["Was seht ihr?"], options: [], solution: null, private: false, homework: false,
      },
      {
        title: "Beobachtungsauftrag: Anil Seth", kind: "text", slide: 15, until_slide: null, reveal_slide: null,
        rows: ["Was ist der Unterschied zwischen Intelligenz und Bewusstsein?", "Warum halten wir KI für bewusst?", "Welche Rolle spielt unser Körper?"],
        options: [], solution: null, private: false, homework: false,
      },
      {
        title: "Abstimmung: Bewusstsein", kind: "grid", slide: 16, until_slide: null, reveal_slide: null,
        rows: ["Glaubt ihr Seth, dass KI nie ein Bewusstsein haben wird?"],
        options: ["Ja", "Nein", "Weiß nicht"], solution: null, private: false, homework: false,
      },
      {
        title: "Job-Ampel: Wie stark verändert KI diesen Beruf?", kind: "grid", slide: 18, until_slide: null, reveal_slide: null,
        rows: ["Übersetzer:in", "Pflegekraft", "Programmierer:in", "Influencer:in", "Elektriker:in", "Steuerberater:in", "Lehrer:in", "Grafikdesigner:in"],
        options: ["grün: kaum", "gelb: teilweise", "rot: stark"], solution: null, private: false, homework: false,
      },
      {
        title: "Hausaufgabe: Schule in drei Jahren", kind: "text", slide: 20, until_slide: null, reveal_slide: null,
        rows: [
          "Unterricht: Wofür sollte KI im Unterricht genutzt werden, und wofür bewusst nicht?",
          "Hausaufgaben und Prüfungen: Wie sehen sie aus, wenn alle eine KI in der Tasche haben?",
          "Menschen: Was machen Lehrkräfte, was macht ihr? Und was sollte nie eine KI übernehmen?",
        ],
        options: [], solution: null, private: true, homework: true,
      },
    ],
  },
};
