import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { z } from "zod";
import { sql } from "./db";
import { THEMES, type ThemeKey } from "./compass";

/* ------------------------------ Karten ------------------------------ */

export { REACTIONS, type ReactionId } from "./reactions";

const themeKeys = Object.keys(THEMES) as [ThemeKey, ...ThemeKey[]];
export const cardSchema = z.object({
  headline: z.string().trim().min(3).max(110),
  tldr: z.string().trim().min(10).max(420),
  context: z.string().trim().max(420),
  relevance: z.string().trim().max(320),
  question: z.string().trim().min(5).max(220),
  check: z.string().trim().max(320),
  theme: z.enum(themeKeys),
});
export type Card = z.infer<typeof cardSchema>;

/* ------------------------------ Sicheres Abrufen ------------------------------ */

function privateAddress(ip: string) {
  if (ip === "::1" || ip.startsWith("fe80:") || ip.startsWith("fc") || ip.startsWith("fd")) return true;
  const m = ip.replace(/^::ffff:/, "").split(".").map(Number);
  if (m.length !== 4) return false;
  return m[0] === 10 || m[0] === 127 || m[0] === 0 || (m[0] === 169 && m[1] === 254) ||
    (m[0] === 172 && m[1] >= 16 && m[1] <= 31) || (m[0] === 192 && m[1] === 168) || (m[0] === 100 && m[1] >= 64 && m[1] <= 127);
}

/** Holt eine fremde URL, aber nie Adressen im internen Netz (Schutz vor Missbrauch eingereichter Links). */
export async function safeFetch(raw: string, { maxBytes = 1_500_000, timeoutMs = 9000 } = {}) {
  const url = new URL(raw);
  if (!/^https?:$/.test(url.protocol)) throw new Error("Nur http und https sind erlaubt.");
  if (process.env.ALLOW_PRIVATE_FETCH !== "1") {
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const addrs = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
    if (addrs.some(privateAddress)) throw new Error("Diese Adresse ist nicht erlaubt.");
  }
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "user-agent": "Mozilla/5.0 (compatible; PROVOID-KI-Radar/1.0; +https://ag.provoid.de)", accept: "*/*" },
  });
  if (!res.ok) throw new Error(`Die Seite antwortet mit Status ${res.status}.`);
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) { await reader.cancel(); break; }
    chunks.push(value);
  }
  return new TextDecoder("utf-8").decode(Buffer.concat(chunks));
}

/* ------------------------------ Text aufbereiten ------------------------------ */

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", shy: "", ndash: "–", mdash: "—", bdquo: "„", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", hellip: "…", auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß" };
export function decode(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n] ?? m);
}
export const stripTags = (s: string) => decode(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export function htmlToText(html: string) {
  const meta = (name: string) =>
    html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)["']`, "i"))?.[1] ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${name}["']`, "i"))?.[1];
  const title = decode(meta("og:title") ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
  const site = decode(meta("og:site_name") ?? "").trim();
  const description = decode(meta("og:description") ?? meta("description") ?? "").trim();
  let body = html.replace(/<(script|style|noscript|svg|nav|header|footer|aside|form)[\s\S]*?<\/\1>/gi, " ");
  const article = body.match(/<article[\s\S]*?<\/article>/i)?.[0];
  if (article && article.length > 800) body = article;
  const paragraphs = [...body.matchAll(/<(p|h2|h3|li)[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => stripTags(m[2])).filter((t) => t.length > 40);
  const text = (paragraphs.length > 2 ? paragraphs.join("\n") : stripTags(body)).slice(0, 12000);
  return { title, site, description, text };
}

/* ------------------------------ Feeds ------------------------------ */

export type FeedEntry = { title: string; link: string; date: Date | null; description: string };

export function parseFeed(xml: string): FeedEntry[] {
  const blocks = [...xml.matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi)].map((m) => m[0]);
  const tag = (b: string, t: string) => b.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, "i"))?.[1] ?? "";
  return blocks.map((b) => {
    const link = decode(tag(b, "link")).trim() || b.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] || "";
    const dateStr = tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date");
    const d = dateStr ? new Date(decode(dateStr).trim()) : null;
    return {
      title: stripTags(tag(b, "title")),
      link: decode(link).trim(),
      date: d && !isNaN(+d) ? d : null,
      description: stripTags(tag(b, "description") || tag(b, "summary") || tag(b, "content")).slice(0, 600),
    };
  }).filter((e) => e.title && /^https?:\/\//.test(e.link));
}

const KI_WORDS = /\b(KI|K\.I\.|AI|künstlich\w* Intelligenz|artificial intelligence|ChatGPT|GPT|Claude|Gemini|Copilot|OpenAI|Anthropic|DeepMind|Mistral|LLM|Sprachmodell\w*|Chatbot\w*|Deepfake\w*|neuronal\w*|maschinell\w* Lernen|Machine Learning|Algorithm\w*|Roboter\w*|Bildgenerator\w*)\b/i;
export const isAboutAI = (e: { title: string; description: string }) => KI_WORDS.test(`${e.title} ${e.description}`);

export async function testFeed(url: string) {
  const xml = await safeFetch(url, { maxBytes: 3_000_000 });
  const entries = parseFeed(xml);
  if (entries.length === 0) throw new Error("Kein gültiger Feed gefunden.");
  const ai = entries.filter(isAboutAI);
  return { total: entries.length, ai: ai.length, sample: (ai.length ? ai : entries).slice(0, 5).map((e) => e.title) };
}

const MAX_AGE_DAYS = 10;
const MAX_PER_FEED = 15;

export async function importFeeds(onlyFeedId?: string) {
  const feeds = await sql<{ id: string; name: string; url: string; keyword_filter: boolean }[]>`
    select id, name, url, keyword_filter from feeds
    where active = true ${onlyFeedId ? sql`and id = ${onlyFeedId}` : sql``}`;
  const results: { name: string; added: number; error?: string }[] = [];
  for (const f of feeds) {
    try {
      const entries = parseFeed(await safeFetch(f.url, { maxBytes: 3_000_000 }))
        .filter((e) => !e.date || Date.now() - +e.date < MAX_AGE_DAYS * 864e5)
        .filter((e) => !f.keyword_filter || isAboutAI(e))
        .slice(0, MAX_PER_FEED);
      let added = 0;
      for (const e of entries) {
        const r = await sql`
          insert into news_items (origin, feed_id, url, title, source_name, excerpt, source_date)
          values ('feed', ${f.id}, ${e.link}, ${e.title.slice(0, 300)}, ${f.name}, ${e.description}, ${e.date})
          on conflict (url) where origin = 'feed' do nothing returning id`;
        added += r.length;
      }
      await sql`update feeds set last_fetched_at = now(), last_status = ${`OK · ${entries.length} passende, ${added} neu`} where id = ${f.id}`;
      results.push({ name: f.name, added });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await sql`update feeds set last_fetched_at = now(), last_status = ${"Fehler: " + msg.slice(0, 200)} where id = ${f.id}`;
      results.push({ name: f.name, added: 0, error: msg });
    }
  }
  // Ungeprüfte Feed-Meldungen nach drei Wochen aufräumen
  await sql`delete from news_items where origin = 'feed' and status = 'pending' and created_at < now() - interval '21 days'`;
  return results;
}

/* ------------------------------ KI-Aufbereitung ------------------------------ */

export const aiEnabled = () => !!process.env.ANTHROPIC_API_KEY;

const SYSTEM = `Du bereitest Nachrichten über Künstliche Intelligenz für eine KI-AG an einem Hamburger Gymnasium auf. Die Leserinnen und Leser sind 13 bis 18 Jahre alt. Sie scrollen am Anfang jeder AG-Stunde durch kurze Karten, ähnlich wie bei TikTok.

Regeln:
- Verwende ausschließlich Fakten aus dem mitgelieferten Material. Erfinde nichts dazu. Wenn etwas unklar oder nur behauptet ist, sag das.
- Schreib einfach und lebendig, in kurzen Sätzen, auf Augenhöhe, ohne Jugendsprache nachzuahmen. Duze die Leser.
- Erkläre Fachbegriffe in einfachen Worten, sobald sie vorkommen.
- Keine Übertreibung, keine Panikmache, keine Werbung.
- Keine Emojis. Keine Gedankenstriche als Satzzeichen, nutze stattdessen Punkt, Komma oder Doppelpunkt.
- Antworte ausschließlich mit einem JSON-Objekt, ohne Text davor oder danach.`;

function userPrompt(input: { title: string; source: string; text: string; kidNote?: string }) {
  return `Material:
Titel: ${input.title}
Quelle: ${input.source}
${input.kidNote ? `Eine Schülerin oder ein Schüler hat das eingereicht mit dem Kommentar: "${input.kidNote}"\n` : ""}
Text:
"""
${input.text.slice(0, 10000)}
"""

Erstelle daraus dieses JSON:
{
  "headline": "Überschrift, höchstens 70 Zeichen, neugierig machend und trotzdem korrekt",
  "tldr": "Worum geht es? 2 bis 3 kurze Sätze, höchstens 300 Zeichen",
  "context": "Was steckt dahinter? Erklärt den wichtigsten Begriff oder Hintergrund, 2 Sätze, höchstens 300 Zeichen",
  "relevance": "Was hat das mit dir zu tun? 1 bis 2 Sätze, konkret aus dem Alltag von Jugendlichen",
  "question": "Eine offene Frage für die Diskussion in der AG",
  "check": "Quellen-Check in einem Satz: Wer berichtet, ist es bestätigt oder nur angekündigt, was bleibt offen?",
  "theme": "genau einer dieser Werte: ${themeKeys.join(", ")}"
}`;
}

export async function generateCard(input: { title: string; source: string; text: string; kidNote?: string }): Promise<Card> {
  const base = process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com";
  const res = await fetch(`${base}/v1/messages`, {
    method: "POST",
    signal: AbortSignal.timeout(45000),
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
      max_tokens: 1200,
      system: SYSTEM,
      messages: [{ role: "user", content: userPrompt(input) }],
    }),
  });
  if (!res.ok) throw new Error(`KI-Dienst antwortet mit Status ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.filter((c) => c.type === "text").map((c) => c.text).join("") ?? "";
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return cardSchema.parse(JSON.parse(json));
}

/** Material für eine Meldung zusammentragen und daraus eine Karte machen. */
export async function buildCardForItem(item: { url: string; title: string; source_name: string; excerpt: string; kid_note: string }) {
  let text = item.excerpt;
  let title = item.title;
  let source = item.source_name;
  try {
    const page = htmlToText(await safeFetch(item.url));
    title ||= page.title;
    source ||= page.site || new URL(item.url).hostname.replace(/^www\./, "");
    text = [page.description, page.text].filter(Boolean).join("\n\n") || text;
  } catch {
    // Seite nicht abrufbar (z. B. Paywall oder Social Media): dann mit Titel, Teaser und Kommentar arbeiten
  }
  source ||= new URL(item.url).hostname.replace(/^www\./, "");
  const card = await generateCard({ title, source, text: text || title, kidNote: item.kid_note });
  return { card, title, source };
}

export function emptyCard(title: string): Card {
  return { headline: title.slice(0, 110) || "Neue Meldung", tldr: "", context: "", relevance: "", question: "", check: "", theme: "kiverstehen" };
}
