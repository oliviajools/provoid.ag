import type { Metadata } from "next";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Topbar } from "@/components/Topbar";
import { topThemes, type Answers } from "@/lib/compass";
import type { Card } from "@/lib/news";
import { RadarFeed, type FeedItem } from "./RadarFeed";

export const metadata: Metadata = { title: "KI-Radar" };
export const dynamic = "force-dynamic";

type Row = {
  id: string; url: string; source_name: string; card: Card; kid_note: string; origin: string;
  finder: string | null; published: Date; week: string; week_label: string;
};

export default async function Radar() {
  const user = await requireUser();
  const isCoach = user.role === "coach";
  const rows = await sql<Row[]>`
    select n.id, n.url, n.source_name, n.card, n.kid_note, n.origin, u.pseudonym as finder,
           n.published_at as published,
           to_char(n.published_at at time zone 'Europe/Berlin', 'IYYY-IW') as week,
           to_char(date_trunc('week', n.published_at at time zone 'Europe/Berlin'), 'DD.MM.') as week_label
    from news_items n left join users u on u.id = n.submitted_by
    where n.status = 'published' and n.card is not null
      ${isCoach ? sql`` : sql`and (n.group_id is null or n.group_id = ${user.group_id})`}
    order by n.published_at desc
    limit 60`;
  const ids = rows.map((r) => r.id);
  const mine = ids.length
    ? await sql<{ item_id: string; reaction: string }[]>`select item_id, reaction from news_reactions where user_id = ${user.id} and item_id in ${sql(ids)}`
    : [];
  const counts = ids.length
    ? await sql<{ item_id: string; reaction: string; n: number }[]>`
        select item_id, reaction, count(*)::int as n from news_reactions where item_id in ${sql(ids)} group by item_id, reaction`
    : [];
  const compass = !isCoach
    ? (await sql<{ answers: Answers }[]>`select answers from compass where user_id = ${user.id} and round = 1`)[0]
    : undefined;
  const myThemes = compass ? topThemes(compass.answers.cards) : [];

  const items: FeedItem[] = rows.map((r) => {
    const c = { krass: 0, sorge: 0, hype: 0, testen: 0 };
    for (const x of counts) if (x.item_id === r.id) c[x.reaction as keyof typeof c] = x.n;
    return {
      id: r.id, url: r.url, source: r.source_name, card: r.card,
      finder: r.origin === "kid" ? r.finder : null, kidNote: r.origin === "kid" ? r.kid_note : "",
      date: new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" }).format(r.published),
      week: r.week, weekLabel: r.week_label,
      myReaction: (mine.find((m) => m.item_id === r.id)?.reaction as FeedItem["myReaction"]) ?? null,
      counts: c, mineTheme: myThemes.includes(r.card.theme),
    };
  });

  return (
    <>
      <Topbar pseudonym={user.pseudonym} home={isCoach ? "/coach" : "/start"} />
      <main className="radar-main">
        <RadarFeed items={items} canSubmit={!isCoach} />
      </main>
    </>
  );
}
