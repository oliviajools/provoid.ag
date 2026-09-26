"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { THEMES } from "@/lib/compass";
import { REACTIONS, type ReactionId } from "@/lib/reactions";
import type { Card } from "@/lib/news";
import { react, type Counts } from "./actions";

export type FeedItem = {
  id: string; url: string; source: string; card: Card; finder: string | null; kidNote: string;
  date: string; week: string; weekLabel: string; myReaction: ReactionId | null; counts: Counts; mineTheme: boolean;
};

export function RadarFeed({ items, canSubmit }: { items: FeedItem[]; canSubmit: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(0);
  const total = items.length;

  const slides = useCallback(() => Array.from(ref.current?.querySelectorAll<HTMLElement>("[data-slide]") ?? []), []);
  const goto = useCallback((dir: 1 | -1) => {
    const el = ref.current; if (!el) return;
    const all = slides();
    const cur = all.findIndex((s) => Math.abs(s.offsetTop - el.scrollTop) < 10);
    const next = all[Math.max(0, Math.min(all.length - 1, (cur === -1 ? 0 : cur) + dir))];
    next?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [slides]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, button")) return;
      if (["ArrowDown", "PageDown", " ", "j"].includes(e.key)) { e.preventDefault(); goto(1); }
      if (["ArrowUp", "PageUp", "k"].includes(e.key)) { e.preventDefault(); goto(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goto]);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setPos(Number((e.target as HTMLElement).dataset.index ?? 0));
    }, { root: el, threshold: 0.6 });
    el.querySelectorAll("[data-index]").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [items]);

  if (total === 0) {
    return (
      <div className="radar-feed">
        <section className="slide intro" data-slide>
          <div className="slide-inner">
            <span className="tag outline">KI-Radar</span>
            <h1>Noch ist das Radar leer.</h1>
            <p className="lead">Sobald deine Coach die ersten Meldungen freigegeben hat, erscheinen sie hier.</p>
            {canSubmit && <Link className="btn" href="/radar/einreichen">Selbst eine Quelle einreichen</Link>}
          </div>
        </section>
      </div>
    );
  }

  let lastWeek = "";
  return (
    <div className="radar-feed" ref={ref} tabIndex={-1}>
      {items.map((it, i) => {
        const header = it.week !== lastWeek;
        lastWeek = it.week;
        const count = items.filter((x) => x.week === it.week).length;
        return (
          <Fragment key={it.id}>
            {header && (
              <section className="slide intro" data-slide>
                <div className="slide-inner">
                  <div className="tags"><span className="tag outline">KI-Radar</span><span className="tag">Woche ab {it.weekLabel}</span></div>
                  <h1>{i === 0 ? "Was diese Woche in der KI passiert ist." : "Die Woche davor."}</h1>
                  <p className="lead">{count} {count === 1 ? "Meldung" : "Meldungen"}. Wisch nach oben oder drück die Pfeiltaste.</p>
                  <button type="button" className="scroll-hint" onClick={() => goto(1)} aria-label="Zur ersten Meldung">↓</button>
                </div>
              </section>
            )}
            <NewsSlide item={it} index={i} />
          </Fragment>
        );
      })}
      <section className="slide intro" data-slide>
        <div className="slide-inner">
          <span className="tag outline">Das war's</span>
          <h1>Du bist auf dem neuesten Stand.</h1>
          <p className="lead">Du findest unter der Woche selbst etwas Spannendes über KI? Reich es ein. Die besten Funde landen hier, mit deinem Namen.</p>
          {canSubmit && <Link className="btn" href="/radar/einreichen">Quelle einreichen</Link>}
        </div>
      </section>
      <div className="radar-pos" aria-live="polite">{Math.min(pos + 1, total)} / {total}</div>
    </div>
  );
}

function NewsSlide({ item, index }: { item: FeedItem; index: number }) {
  const c = item.card;
  const [mine, setMine] = useState<ReactionId | null>(item.myReaction);
  const [counts, setCounts] = useState<Counts>(item.counts);
  const [more, setMore] = useState(false);
  const [pending, start] = useTransition();
  const sum = Object.values(counts).reduce((a, b) => a + b, 0);

  const choose = (r: ReactionId) => {
    const prev = mine;
    setMine(r);
    setCounts((old) => ({ ...old, [r]: old[r] + 1, ...(prev ? { [prev]: Math.max(0, old[prev] - (prev === r ? 0 : 1)) } : {}) }));
    start(async () => { try { setCounts(await react(item.id, r)); } catch { setMine(prev); } });
  };

  return (
    <section className={`slide news t-${c.theme}`} data-slide data-index={index} aria-label={c.headline}>
      <div className="slide-inner">
        <div className="news-meta">
          <span className="chip live">{THEMES[c.theme]}</span>
          {item.mineTheme && <span className="chip mine">Dein Thema</span>}
          <span className="faint">{item.source} · {item.date}</span>
        </div>
        <h2 className="news-headline">{c.headline}</h2>
        <p className="news-tldr">{c.tldr}</p>

        {item.finder && (
          <p className="finder">
            <b>Gefunden von {item.finder}</b>{item.kidNote && <>: „{item.kidNote}“</>}
          </p>
        )}

        <div className="news-question"><span>Frage an euch</span>{c.question}</div>

        <button type="button" className="linkish more-toggle" aria-expanded={more} onClick={() => setMore((m) => !m)}>
          {more ? "Weniger anzeigen" : "Hintergrund und Quellen-Check"}
        </button>
        {more && (
          <div className="news-more">
            {c.context && <p><b>Was steckt dahinter?</b> {c.context}</p>}
            {c.relevance && <p><b>Was hat das mit dir zu tun?</b> {c.relevance}</p>}
            {c.check && <p><b>Quellen-Check:</b> {c.check}</p>}
            <a href={item.url} target="_blank" rel="noreferrer">Original lesen bei {item.source}</a>
          </div>
        )}

        <div className="reactions" role="group" aria-label="Wie findest du das?">
          {REACTIONS.map((r) => (
            <button key={r.id} type="button" className={`react${mine === r.id ? " on" : ""}`} aria-pressed={mine === r.id}
              onClick={() => choose(r.id)} disabled={pending && mine === r.id}>
              <span className="label">{r.label}</span>
              {mine && <span className="bar" style={{ width: `${sum ? (counts[r.id] / sum) * 100 : 0}%` }} />}
              {mine && <span className="n">{counts[r.id]}</span>}
            </button>
          ))}
        </div>
        {!mine && <p className="faint react-hint">Stimm ab, dann siehst du, was die anderen denken.</p>}
      </div>
    </section>
  );
}
