"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { THEMES } from "@/lib/compass";
import type { Card } from "@/lib/news";
import { SubmitButton } from "@/components/SubmitButton";
import { regenerate, saveCard, type ActState } from "../actions";

const FIELDS: { k: keyof Card; label: string; rows: number; max: number; hint: string }[] = [
  { k: "headline", label: "Überschrift", rows: 2, max: 110, hint: "Höchstens 70 Zeichen, neugierig und korrekt." },
  { k: "tldr", label: "Worum geht es?", rows: 4, max: 420, hint: "2 bis 3 kurze Sätze." },
  { k: "context", label: "Was steckt dahinter?", rows: 3, max: 420, hint: "Einen Begriff oder Hintergrund erklären." },
  { k: "relevance", label: "Was hat das mit dir zu tun?", rows: 3, max: 320, hint: "Konkret aus dem Alltag von Jugendlichen." },
  { k: "question", label: "Frage an euch", rows: 2, max: 220, hint: "Offene Frage für die Diskussion." },
  { k: "check", label: "Quellen-Check", rows: 2, max: 320, hint: "Wer berichtet, ist es bestätigt, was bleibt offen?" },
];

export function EditCard({ id, card, source, ai, auto }: { id: string; card: Card; source: string; ai: boolean; auto: boolean }) {
  const [c, setC] = useState<Card>(card);
  const [src, setSrc] = useState(source);
  const [s, a] = useActionState(saveCard, undefined);
  const [rs, ra, rPending] = useActionState<ActState, FormData>(regenerate, undefined);
  const regenForm = useRef<HTMLFormElement>(null);
  const modeRef = useRef<HTMLInputElement>(null);
  const autoDone = useRef(false);

  useEffect(() => { setC(card); setSrc(source); }, [card, source]);
  useEffect(() => {
    if (auto && ai && !autoDone.current) { autoDone.current = true; regenForm.current?.requestSubmit(); }
  }, [auto, ai]);

  return (
    <div className="card-edit">
      <div className="stack" style={{ gap: 16 }}>
        {ai && (
          <form action={ra} ref={regenForm} className="stack" style={{ gap: 8 }}>
            <input type="hidden" name="id" value={id} />
            <SubmitButton className="btn ghost" pending="KI schreibt die Karte, das dauert ein paar Sekunden">Karte mit KI neu erstellen</SubmitButton>
            {rs?.error && <div className="alert error">{rs.error}</div>}
            {rs?.ok && !rPending && <div className="alert ok">{rs.ok}</div>}
          </form>
        )}
        <form action={a} className="card">
          <header><h3>Karte</h3></header>
          <div className="body">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="publish" defaultValue="save" ref={modeRef} />
            {s?.error && <div className="alert error" role="alert">{s.error}</div>}
            {s?.ok && <div className="alert ok" role="status">{s.ok}</div>}
            {FIELDS.map((f) => (
              <div className="field" key={f.k}>
                <label htmlFor={`c-${f.k}`}>{f.label}</label>
                <textarea id={`c-${f.k}`} name={f.k} rows={f.rows} maxLength={f.max} value={c[f.k] as string}
                  onChange={(e) => setC({ ...c, [f.k]: e.target.value })} />
                <span className="hint">{f.hint} {(c[f.k] as string).length}/{f.max}</span>
              </div>
            ))}
            <div className="grid-form" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="field">
                <label htmlFor="c-theme">Thema</label>
                <select id="c-theme" name="theme" className="select" value={c.theme} onChange={(e) => setC({ ...c, theme: e.target.value as Card["theme"] })}>
                  {Object.entries(THEMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="c-src">Quelle (Anzeigename)</label>
                <input id="c-src" name="source_name" type="text" value={src} onChange={(e) => setSrc(e.target.value)} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn" type="submit" onClick={() => { if (modeRef.current) modeRef.current.value = "publish"; }}>Speichern und veröffentlichen</button>
              <button className="btn ghost" type="submit" onClick={() => { if (modeRef.current) modeRef.current.value = "save"; }}>Nur speichern</button>
            </div>
          </div>
        </form>
      </div>
      <div className="stack" style={{ gap: 10, position: "sticky", top: 20 }}>
        <span className="faint">Vorschau, so sehen es die Kids</span>
        <div className="preview-phone">
          <section className={`slide news t-${c.theme}`}>
            <div className="slide-inner">
              <div className="news-meta"><span className="chip live">{THEMES[c.theme]}</span><span className="faint">{src}</span></div>
              <h2 className="news-headline" style={{ fontSize: 28 }}>{c.headline || "Überschrift"}</h2>
              <p className="news-tldr" style={{ fontSize: 17 }}>{c.tldr || "Worum geht es?"}</p>
              <div className="news-question"><span>Frage an euch</span>{c.question || "…"}</div>
              <div className="news-more">
                {c.context && <p><b>Was steckt dahinter?</b> {c.context}</p>}
                {c.relevance && <p><b>Was hat das mit dir zu tun?</b> {c.relevance}</p>}
                {c.check && <p><b>Quellen-Check:</b> {c.check}</p>}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
