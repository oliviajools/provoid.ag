"use client";

import { useEffect, useRef, useState } from "react";
import { LiveResults, type BoardActive, type BoardResult } from "./LiveResults";

type Active = BoardActive & { mine: { key: string; value: string }[]; result: BoardResult | null };
type State = { live: boolean; slide?: number; active?: Active | null };

async function send(sessionId: string, body: Record<string, string>) {
  const r = await fetch(`/api/live/${sessionId}/answer`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? "Das hat nicht geklappt.");
  return d as { ok: true; key?: string };
}

/** Live-Bereich auf der Sitzungsseite: zeigt die Aufgabe zur aktuellen Folie. */
export function LivePanel({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<State | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    async function load() {
      try {
        const r = await fetch(`/api/live/${sessionId}`, { cache: "no-store" });
        if (r.ok && alive) setState(await r.json());
      } catch { /* später erneut */ }
    }
    function loop() {
      load().finally(() => {
        if (!alive) return;
        const live = stateRef.current?.live;
        timer = window.setTimeout(loop, document.hidden ? 15000 : live ? 2500 : 10000);
      });
    }
    loop();
    const onVis = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; window.clearTimeout(timer); document.removeEventListener("visibilitychange", onVis); };
  }, [sessionId]);

  if (!state?.live) return null;
  const a = state.active;
  return (
    <section className="card live-card" aria-live="polite">
      <header><h3>{a ? a.title : "Live"}</h3><span className="chip live"><span className="dot" aria-hidden="true" /> live</span></header>
      <div className="body">
        {!a && <p className="muted">Die Sitzung läuft. Schau nach vorne, hier erscheint gleich die nächste Aufgabe.</p>}
        {a && a.mode === "reveal" && a.result && <LiveResults active={a} result={a.result} mine={Object.fromEntries(a.mine.map((m) => [m.key, m.value]))} />}
        {a && a.mode === "reveal" && !a.result && <p className="muted">Schau nach vorne, gleich gibt es die Auflösung.</p>}
        {a && a.mode === "open" && a.kind === "grid" && <GridAnswer key={a.id} sessionId={sessionId} a={a} />}
        {a && a.mode === "open" && a.kind === "wall" && <WallAnswer key={a.id} sessionId={sessionId} a={a} />}
        {a && a.mode === "open" && a.homework && <p className="muted">Die Hausaufgabe findest du weiter unten auf dieser Seite. Ein paar Sätze reichen, ohne KI.</p>}
        {a && a.mode === "open" && a.kind === "text" && !a.homework && <TextAnswer key={a.id} sessionId={sessionId} a={a} />}
      </div>
    </section>
  );
}

function GridAnswer({ sessionId, a }: { sessionId: string; a: Active }) {
  const [mine, setMine] = useState<Record<string, string>>(() => Object.fromEntries(a.mine.map((m) => [m.key, m.value])));
  const [err, setErr] = useState<string | null>(null);
  async function pick(row: number, opt: number) {
    const before = mine;
    setMine({ ...mine, [String(row)]: String(opt) }); setErr(null);
    try { await send(sessionId, { itemId: a.id, key: String(row), value: String(opt) }); }
    catch (e) { setMine(before); setErr((e as Error).message); }
  }
  const done = a.rows.filter((_, i) => mine[String(i)] !== undefined).length;
  return (
    <div className="stack" style={{ gap: 14 }}>
      {err && <div className="alert error" role="alert">{err}</div>}
      {a.rows.map((row, ri) => (
        <div className="lv-q" key={ri}>
          <b>{row}</b>
          <div className="lv-opts" role="radiogroup" aria-label={row}>
            {a.options.map((o, oi) => (
              <button key={oi} type="button" role="radio" aria-checked={mine[String(ri)] === String(oi)}
                className={`lv-opt${mine[String(ri)] === String(oi) ? " on" : ""}`} onClick={() => pick(ri, oi)}>{o}</button>
            ))}
          </div>
        </div>
      ))}
      <p className="faint">{done} von {a.rows.length} beantwortet. Du kannst deine Wahl bis zum Ende ändern.</p>
    </div>
  );
}

function WallAnswer({ sessionId, a }: { sessionId: string; a: Active }) {
  const cols = a.rows.length ? a.rows : ["Eure Ideen"];
  const [notes, setNotes] = useState(a.mine);
  const [draft, setDraft] = useState<string[]>(cols.map(() => ""));
  const [err, setErr] = useState<string | null>(null);
  async function add(ci: number) {
    const text = draft[ci].trim();
    if (!text) return;
    setErr(null);
    setDraft((dr) => dr.map((v, i) => (i === ci ? "" : v)));
    try {
      const d = await send(sessionId, { itemId: a.id, key: String(ci), value: text });
      setNotes((n) => [...n, { key: d.key ?? `${ci}:x`, value: text }]);
    } catch (e) {
      setErr((e as Error).message);
      setDraft((dr) => dr.map((v, i) => (i === ci && !v ? text : v)));
    }
  }
  async function remove(key: string) {
    try { await send(sessionId, { itemId: a.id, remove: key }); setNotes((n) => n.filter((x) => x.key !== key)); }
    catch (e) { setErr((e as Error).message); }
  }
  return (
    <div className="stack" style={{ gap: 18 }}>
      {err && <div className="alert error" role="alert">{err}</div>}
      <div className="lv-wall">
        {cols.map((c, ci) => (
          <div className="stack" style={{ gap: 10 }} key={ci}>
            {cols.length > 1 && <b>{c}</b>}
            <form className="lv-add" onSubmit={(e) => { e.preventDefault(); add(ci); }}>
              <input type="text" maxLength={200} value={draft[ci]} placeholder="Ein Gedanke pro Zettel"
                onChange={(e) => setDraft((dr) => dr.map((v, i) => (i === ci ? e.target.value : v)))} aria-label={c} />
              <button className="btn small" type="submit">Anheften</button>
            </form>
            <div className="lr-notes">
              {notes.filter((n) => Number(n.key.split(":")[0]) === ci).map((n) => (
                <div className="lr-note mine" key={n.key}>{n.value}
                  <button type="button" className="lv-x" onClick={() => remove(n.key)} aria-label="Zettel entfernen">×</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="faint">Alle Zettel erscheinen ohne Namen an der Tafel.</p>
    </div>
  );
}

function TextAnswer({ sessionId, a }: { sessionId: string; a: Active }) {
  return <TextQuestions sessionId={sessionId} itemId={a.id} rows={a.rows} initial={a.mine} isPrivate={a.private} />;
}

export function TextQuestions({ sessionId, itemId, rows, initial, isPrivate }: {
  sessionId: string; itemId: string; rows: string[]; initial: { key: string; value: string }[]; isPrivate: boolean;
}) {
  const [vals, setVals] = useState<string[]>(() => rows.map((_, i) => initial.find((m) => m.key === String(i))?.value ?? ""));
  const [saved, setSaved] = useState<string[]>(vals);
  const [status, setStatus] = useState<string | null>(null);
  async function save(i: number) {
    if (vals[i] === saved[i]) return;
    setStatus("Speichert …");
    try {
      await send(sessionId, { itemId, key: String(i), value: vals[i] });
      setSaved((s) => s.map((v, k) => (k === i ? vals[i] : v)));
      setStatus("Gespeichert.");
    } catch (e) { setStatus((e as Error).message); }
  }
  return (
    <div className="stack" style={{ gap: 16 }}>
      {rows.map((q, i) => (
        <div className="field" key={i}>
          <label htmlFor={`q-${itemId}-${i}`} style={{ textTransform: "none", letterSpacing: 0, fontSize: 15, color: "var(--text)" }}>{q}</label>
          <textarea id={`q-${itemId}-${i}`} rows={3} maxLength={2000} value={vals[i]}
            onChange={(e) => setVals((v) => v.map((x, k) => (k === i ? e.target.value : x)))} onBlur={() => save(i)} />
        </div>
      ))}
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="btn small" onClick={() => rows.forEach((_, i) => save(i))}>Speichern</button>
        <span className="faint" role="status">{status ?? (isPrivate ? "Nur dein Coach sieht deine Antworten." : "Die Antworten erscheinen ohne Namen an der Tafel.")}</span>
      </div>
    </div>
  );
}
