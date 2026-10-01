"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireCoach } from "@/lib/auth";
import { aiEnabled, autoPublish, buildCardForItem, cardSchema, emptyCard, importFeeds, testFeed } from "@/lib/news";

export type ActState = { ok?: string; error?: string } | undefined;

type Item = { id: string; url: string; title: string; source_name: string; excerpt: string; kid_note: string };
const loadItem = async (id: string) =>
  (await sql<Item[]>`select id, url, title, source_name, excerpt, kid_note from news_items where id = ${id}`)[0];

function refresh() {
  revalidatePath("/coach/radar");
  revalidatePath("/radar");
}

/** Freigeben: Karte automatisch erstellen und sofort ins Radar stellen. */
export async function approve(_: ActState, form: FormData): Promise<ActState> {
  await requireCoach();
  const id = String(form.get("id"));
  // Karte schon vorhanden (z. B. automatisch vorbereitet): direkt veröffentlichen
  const ready = await sql`update news_items set status = 'published', published_at = now() where id = ${id} and card is not null and status = 'pending' returning id`;
  if (ready.length) { refresh(); return { ok: "Veröffentlicht." }; }
  if (!aiEnabled()) redirect(`/coach/radar/${id}`);
  const item = await loadItem(id);
  if (!item) return { error: "Meldung nicht gefunden." };
  try {
    const { card, title, source } = await buildCardForItem(item);
    await sql`
      update news_items set card = ${sql.json(card)}, card_by_ai = true, title = ${title}, source_name = ${source},
        status = 'published', published_at = now()
      where id = ${id}`;
  } catch (e) {
    return { error: `Die automatische Karte hat nicht geklappt (${e instanceof Error ? e.message : "unbekannter Fehler"}). Öffne „Bearbeiten“ und schreib sie selbst.` };
  }
  refresh();
  return { ok: "Veröffentlicht." };
}

export async function reject(_: ActState, form: FormData): Promise<ActState> {
  await requireCoach();
  const id = String(form.get("id"));
  const reason = String(form.get("reason") ?? "").trim().slice(0, 300);
  await sql`update news_items set status = 'rejected', reject_reason = ${reason} where id = ${id}`;
  refresh();
  return { ok: "Abgelehnt." };
}

export async function setStatus(form: FormData) {
  await requireCoach();
  const id = String(form.get("id"));
  const status = String(form.get("status"));
  if (status === "published") {
    await sql`update news_items set status = 'published', published_at = coalesce(published_at, now()) where id = ${id} and card is not null`;
  } else if (status === "hidden" || status === "pending") {
    await sql`update news_items set status = ${status} where id = ${id}`;
  }
  refresh();
}

export async function addManual(_: ActState, form: FormData): Promise<ActState> {
  await requireCoach();
  const url = String(form.get("url") ?? "").trim();
  if (!/^https?:\/\/\S+$/i.test(url)) return { error: "Bitte einen vollständigen Link mit https:// eingeben." };
  const [row] = await sql<{ id: string }[]>`
    insert into news_items (origin, url, source_name) values ('coach', ${url}, ${new URL(url).hostname.replace(/^www\./, "")}) returning id`;
  redirect(`/coach/radar/${row.id}${aiEnabled() ? "?auto=1" : ""}`);
}

const editSchema = cardSchema.extend({ publish: z.enum(["save", "publish"]) });

export async function saveCard(_: ActState, form: FormData): Promise<ActState> {
  await requireCoach();
  const id = String(form.get("id"));
  const parsed = editSchema.safeParse(Object.fromEntries(["headline", "tldr", "context", "relevance", "question", "check", "theme", "publish"].map((k) => [k, form.get(k) ?? ""])));
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    const LABEL: Record<string, string> = { headline: "Überschrift", tldr: "Worum geht es", context: "Was steckt dahinter", relevance: "Was hat das mit dir zu tun", question: "Frage an euch", check: "Quellen-Check", theme: "Thema" };
    return { error: `Bitte prüfe das Feld „${LABEL[String(i.path[0])] ?? String(i.path[0])}“ (zu kurz oder zu lang).` };
  }
  const { publish, ...card } = parsed.data;
  const sourceName = String(form.get("source_name") ?? "").trim().slice(0, 80);
  await sql`update news_items set card = ${sql.json(card)}, source_name = ${sourceName} where id = ${id}`;
  if (publish === "publish") await sql`update news_items set status = 'published', published_at = coalesce(published_at, now()) where id = ${id}`;
  refresh();
  revalidatePath(`/coach/radar/${id}`);
  return { ok: publish === "publish" ? "Gespeichert und im Radar veröffentlicht." : "Gespeichert." };
}

export async function regenerate(_: ActState, form: FormData): Promise<ActState> {
  await requireCoach();
  const id = String(form.get("id"));
  if (!aiEnabled()) return { error: "Die automatische Aufbereitung ist nicht eingerichtet (ANTHROPIC_API_KEY fehlt)." };
  const item = await loadItem(id);
  if (!item) return { error: "Meldung nicht gefunden." };
  try {
    const { card, title, source } = await buildCardForItem(item);
    await sql`update news_items set card = ${sql.json(card)}, card_by_ai = true, title = ${title}, source_name = ${source} where id = ${id}`;
  } catch (e) {
    return { error: `Hat nicht geklappt: ${e instanceof Error ? e.message : "unbekannter Fehler"}` };
  }
  revalidatePath(`/coach/radar/${id}`);
  return { ok: "Neue Karte erstellt. Prüf sie und veröffentliche sie dann." };
}

export async function ensureDraft(id: string) {
  await requireCoach();
  const item = (await sql<{ card: unknown; title: string }[]>`select card, title from news_items where id = ${id}`)[0];
  if (item && !item.card) await sql`update news_items set card = ${sql.json(emptyCard(item.title))} where id = ${id}`;
}

/* ------------------------------ Quellen (Feeds) ------------------------------ */

export async function importNow(_: ActState): Promise<ActState> {
  await requireCoach();
  const res = await importFeeds();
  if (res.length === 0) return { error: "Keine aktive Quelle. Teste und aktiviere zuerst mindestens eine." };
  const auto = await autoPublish();
  refresh();
  const added = res.reduce((a, r) => a + r.added, 0);
  const errors = res.filter((r) => r.error).map((r) => r.name);
  const autoMsg = auto.published || auto.queued ? ` Automatisch veröffentlicht: ${auto.published}, mit fertiger Karte zur Prüfung: ${auto.queued}.` : "";
  return { ok: `${added} neue Meldungen abgerufen.${autoMsg}${errors.length ? ` Fehler bei: ${errors.join(", ")}.` : ""}` };
}

export async function testFeedAction(_: ActState, form: FormData): Promise<ActState> {
  await requireCoach();
  const id = String(form.get("id"));
  const feed = (await sql<{ url: string }[]>`select url from feeds where id = ${id}`)[0];
  if (!feed) return { error: "Quelle nicht gefunden." };
  try {
    const r = await testFeed(feed.url);
    await sql`update feeds set last_status = ${`Test OK · ${r.total} Artikel, ${r.ai} zu KI`}, last_fetched_at = now() where id = ${id}`;
    refresh();
    return { ok: `Funktioniert: ${r.total} Artikel, davon ${r.ai} zu KI. Beispiele: ${r.sample.slice(0, 3).join(" | ")}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sql`update feeds set last_status = ${"Test fehlgeschlagen: " + msg.slice(0, 160)} where id = ${id}`;
    refresh();
    return { error: `Funktioniert nicht: ${msg}` };
  }
}

export async function toggleFeed(form: FormData) {
  await requireCoach();
  const id = String(form.get("id"));
  const field = String(form.get("field"));
  if (field === "active") await sql`update feeds set active = not active where id = ${id}`;
  if (field === "filter") await sql`update feeds set keyword_filter = not keyword_filter where id = ${id}`;
  if (field === "auto") await sql`update feeds set auto_publish = not auto_publish where id = ${id}`;
  if (field === "delete") await sql`delete from feeds where id = ${id}`;
  refresh();
}

export async function addFeed(_: ActState, form: FormData): Promise<ActState> {
  await requireCoach();
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const url = String(form.get("url") ?? "").trim();
  if (!name || !/^https?:\/\/\S+$/i.test(url)) return { error: "Name und vollständige Feed-Adresse (https://…) angeben." };
  try {
    await sql`insert into feeds (name, url) values (${name}, ${url})`;
  } catch {
    return { error: "Diese Feed-Adresse gibt es schon." };
  }
  refresh();
  return { ok: `${name} hinzugefügt. Jetzt testen und dann aktivieren.` };
}

export async function discardAllFeed() {
  await requireCoach();
  await sql`update news_items set status = 'rejected' where status = 'pending' and origin = 'feed'`;
  refresh();
}
