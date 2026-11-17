"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CloudAnswer, GridAnswer, TextAnswer, WallAnswer, type Active } from "@/components/LivePanel";

export type Step = Active & { info: string; closed: boolean };

/** Schritt für Schritt durch die Aufgaben. Alle Schritte bleiben geladen, damit nichts verloren geht. */
export function Pfad({ sessionId, title, steps, canSave }: { sessionId: string; title: string; steps: Step[]; canSave: boolean }) {
  const key = `pfad:${sessionId}`;
  const [at, setAt] = useState(0);
  const [seen, setSeen] = useState<Set<number>>(() => new Set(steps.map((s, i) => (s.mine.length ? i : -1)).filter((i) => i >= 0)));
  useEffect(() => {
    try { const v = Number(sessionStorage.getItem(key)); if (Number.isInteger(v) && v >= 0 && v <= steps.length) setAt(v); } catch { /* egal */ }
  }, [key, steps.length]);
  function go(i: number) {
    setSeen((s) => new Set(s).add(at));
    setAt(i);
    try { sessionStorage.setItem(key, String(i)); } catch { /* egal */ }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const done = at >= steps.length;
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="stack" style={{ gap: 10 }}>
        <span className="faint">{title}</span>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 40px)" }}>{done ? "Geschafft!" : `Aufgabe ${at + 1} von ${steps.length}`}</h1>
        <nav className="pfad-progress" aria-label="Aufgaben">
          {steps.map((s, i) => (
            <button key={s.id} type="button" onClick={() => go(i)} aria-current={i === at ? "step" : undefined}
              className={i === at ? "here" : seen.has(i) ? "done" : ""} aria-label={`Aufgabe ${i + 1}: ${s.title}`}>{i + 1}</button>
          ))}
        </nav>
      </div>

      {steps.map((s, i) => (
        <section className="card" key={s.id} hidden={i !== at}>
          <header><h3>{s.title}</h3></header>
          <div className="body" style={{ gap: 18 }}>
            {s.info && <p className="pfad-info">{s.info}</p>}
            {s.closed ? <p className="muted">Diese Aufgabe ist gerade geschlossen.</p> : !canSave ? <Preview s={s} /> : (
              <>
                {s.kind === "grid" && <GridAnswer sessionId={sessionId} a={s} feedback />}
                {s.kind === "wall" && <WallAnswer sessionId={sessionId} a={s} />}
                {s.kind === "text" && <TextAnswer sessionId={sessionId} a={s} />}
                {s.kind === "cloud" && <CloudAnswer sessionId={sessionId} a={s} />}
              </>
            )}
          </div>
        </section>
      ))}

      {done && (
        <section className="card">
          <div className="body" style={{ gap: 14 }}>
            <p style={{ fontSize: 18 }}>Du hast alle Aufgaben durchgeklickt. Schau gern noch einmal über deine Antworten, du kannst sie bis zur Besprechung ändern.</p>
            <p className="muted">Wenn noch Zeit ist: Lies dir die Fragen noch einmal durch und überlege, was du in der Besprechung sagen möchtest.</p>
            <div><Link className="btn ghost" href={`/sitzungen/${sessionId}`}>Zur Sitzung</Link></div>
          </div>
        </section>
      )}

      <div className="pfad-nav">
        <button type="button" className="btn ghost" onClick={() => go(Math.max(0, at - 1))} disabled={at === 0}>Zurück</button>
        {!done && <button type="button" className="btn" onClick={() => go(at + 1)}>{at === steps.length - 1 ? "Fertig" : "Weiter"}</button>}
      </div>
      {canSave && !done && <p className="faint">Antworten zum Anklicken speichern sofort. Texte speichern, sobald du ins nächste Feld klickst oder auf „Speichern“ tippst.</p>}
    </div>
  );
}

function Preview({ s }: { s: Step }) {
  return (
    <ul className="stack" style={{ gap: 6, paddingLeft: 18 }}>
      {(s.rows.length ? s.rows : ["Freie Antworten"]).map((r, i) => <li key={i}>{r}</li>)}
      {s.options.length > 0 && <li className="faint">Auswahl: {s.options.join(" · ")}</li>}
    </ul>
  );
}
