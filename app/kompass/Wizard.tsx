"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  CARDS, FEELINGS, FREQUENCY, GOAL_DIRECTIONS, IFTHEN_SUGGESTIONS, PAIRS, SKILLS, THEMES, USAGE,
  type Answers,
} from "@/lib/compass";
import { saveCompass } from "./actions";

type Draft = {
  feelings: string[];
  usage: string[];
  frequency: string;
  cards: Record<string, "yes" | "no">;
  pairs: Record<string, "left" | "both" | "right">;
  skills: Record<string, number>;
  dream: string;
  problem: string;
  goalDirection: string;
  goalRest: string;
  ifthenRest: string;
  share: "name" | "anon" | "no" | "";
};

const EMPTY: Draft = {
  feelings: [], usage: [], frequency: "", cards: {}, pairs: {}, skills: {},
  dream: "", problem: "", goalDirection: "", goalRest: "", ifthenRest: "", share: "",
};

const IFTHEN_PREFIX = "Wenn ich in der AG nicht weiterkomme, dann ";

function fromAnswers(a: Answers): Draft {
  const dir = GOAL_DIRECTIONS.find((d) => d.id === a.goalDirection)!;
  return {
    feelings: a.feelings, usage: a.usage, frequency: a.frequency, cards: a.cards, pairs: a.pairs, skills: a.skills,
    dream: a.dream, problem: a.problem, goalDirection: a.goalDirection,
    goalRest: a.goal.startsWith(dir.prefix) ? a.goal.slice(dir.prefix.length) : a.goal,
    ifthenRest: a.ifthen.startsWith(IFTHEN_PREFIX) ? a.ifthen.slice(IFTHEN_PREFIX.length) : a.ifthen,
    share: a.share,
  };
}

const STAGES = ["Ankommen", "Möglichkeitsraum", "So arbeitest du", "Dein Startpunkt", "Traum und Ziel"];
// Bildschirm -> Etappe (0 = Begrüßung)
const SCREENS: { stage: number }[] = [
  { stage: -1 }, { stage: 0 }, { stage: 0 }, { stage: 1 }, { stage: 2 }, { stage: 3 }, { stage: 4 }, { stage: 4 }, { stage: 4 },
];

function toggle(list: string[], v: string, exclusive?: string) {
  if (list.includes(v)) return list.filter((x) => x !== v);
  if (exclusive && v === exclusive) return [v];
  return [...list.filter((x) => x !== exclusive), v];
}

export function Wizard({ userKey, pseudonym, initial, preview }:
  { userKey: string; pseudonym: string; initial: Answers | null; preview: boolean }) {
  const storageKey = `kompass-draft-${userKey}`;
  const [d, setD] = useState<Draft>(initial ? fromAnswers(initial) : EMPTY);
  const [screen, setScreen] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [state, action, pending] = useActionState(saveCompass, undefined);
  const topRef = useRef<HTMLDivElement>(null);

  // Zwischenstand im Browser merken, falls jemand die Seite schließt
  useEffect(() => {
    if (!initial) {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const saved = JSON.parse(raw);
          setD({ ...EMPTY, ...saved.d });
          if (typeof saved.screen === "number") setScreen(saved.screen);
        }
      } catch { /* ohne Speicher geht es auch */ }
    }
    setLoaded(true);
  }, [initial, storageKey]);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ d, screen })); } catch { /* egal */ }
  }, [d, screen, loaded, storageKey]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const go = (n: number) => {
    setScreen(n);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const dir = GOAL_DIRECTIONS.find((g) => g.id === d.goalDirection);
  const answers: Answers | null = useMemo(() => {
    if (!dir || !d.frequency || !d.share) return null;
    return {
      feelings: d.feelings as Answers["feelings"], usage: d.usage as Answers["usage"],
      frequency: d.frequency as Answers["frequency"], cards: d.cards, pairs: d.pairs, skills: d.skills,
      dream: d.dream, problem: d.problem, goalDirection: dir.id,
      goal: dir.prefix + d.goalRest.trim(), ifthen: IFTHEN_PREFIX + d.ifthenRest.trim(), share: d.share,
    };
  }, [d, dir]);

  const canNext: boolean[] = [
    true,
    d.feelings.length > 0,
    d.usage.length > 0 && !!d.frequency,
    CARDS.every((c) => d.cards[c.id]),
    PAIRS.every((p) => d.pairs[p.id]),
    SKILLS.every((s) => d.skills[s.id]),
    d.dream.trim().length >= 3,
    !!dir && d.goalRest.trim().length >= 3 && d.ifthenRest.trim().length >= 3,
    !!d.share,
  ];

  const stage = SCREENS[screen].stage;
  const last = screen === SCREENS.length - 1;

  return (
    <div className="wizard" ref={topRef}>
      {stage >= 0 && (
        <div className="wz-progress" aria-label={`Etappe ${stage + 1} von ${STAGES.length}`}>
          <div className="wz-steps">
            {STAGES.map((s, i) => (
              <span key={s} className={i < stage ? "done" : i === stage ? "now" : ""} title={s} />
            ))}
          </div>
          <p className="wz-eyebrow">Etappe {stage + 1} von {STAGES.length} · {STAGES[stage]}</p>
        </div>
      )}

      {screen === 0 && (
        <section className="wz-screen">
          <div className="tags"><span className="tag outline">Dein Kompass</span></div>
          <h1>Wohin willst du mit KI, {pseudonym}?</h1>
          <p className="lead">
            In etwa zwölf Minuten findest du heraus, welche Themen dich packen, wie du am liebsten arbeitest und was du
            bis März erreichen willst. Am Ende bekommst du deine persönliche Kompass-Karte.
          </p>
          <ul className="wz-promises">
            <li><b>Keine falschen Antworten.</b> Es gibt keine Noten und kein Richtig oder Falsch.</li>
            <li><b>Denk groß.</b> Verrückte Ideen sind ausdrücklich erwünscht.</li>
            <li><b>Das bleibt bei dir.</b> Deine Antworten sehen nur du und deine Coach. Was auf die Ideen-Wand kommt, entscheidest du.</li>
          </ul>
          {preview && <div className="alert ok">Coach-Vorschau: Du kannst alles durchklicken, gespeichert wird nichts.</div>}
        </section>
      )}

      {screen === 1 && (
        <section className="wz-screen">
          <h2>Wie fühlt sich das Thema KI für dich gerade an?</h2>
          <p className="muted">Wähl alles aus, was passt.</p>
          <div className="chips">
            {FEELINGS.map((f) => (
              <button key={f} type="button" className={`pick${d.feelings.includes(f) ? " on" : ""}`}
                aria-pressed={d.feelings.includes(f)} onClick={() => set("feelings", toggle(d.feelings, f))}>{f}</button>
            ))}
          </div>
        </section>
      )}

      {screen === 2 && (
        <section className="wz-screen">
          <h2>Wofür nutzt du KI im Moment?</h2>
          <p className="muted">Ehrlich ist hier am hilfreichsten. Es geht nur darum, wo du startest.</p>
          <div className="chips">
            {USAGE.map((u) => (
              <button key={u} type="button" className={`pick${d.usage.includes(u) ? " on" : ""}`}
                aria-pressed={d.usage.includes(u)} onClick={() => set("usage", toggle(d.usage, u, "Gar nicht"))}>{u}</button>
            ))}
          </div>
          <h3 style={{ marginTop: 12 }}>Und wie oft?</h3>
          <div className="segmented" role="radiogroup" aria-label="Wie oft nutzt du KI?">
            {FREQUENCY.map((f) => (
              <button key={f} type="button" role="radio" aria-checked={d.frequency === f}
                className={d.frequency === f ? "on" : ""} onClick={() => set("frequency", f)}>{f}</button>
            ))}
          </div>
        </section>
      )}

      {screen === 3 && <CardStack cards={d.cards} onChange={(c) => set("cards", c)} />}

      {screen === 4 && (
        <section className="wz-screen">
          <h2>Was macht dir mehr Spaß?</h2>
          <p className="muted">Entscheide aus dem Bauch. Wenn du beides magst, nimm die Mitte.</p>
          <div className="pairs">
            {PAIRS.map((p) => (
              <div className="pair" key={p.id} role="radiogroup" aria-label={`${p.left} oder ${p.right}`}>
                {(["left", "both", "right"] as const).map((side) => (
                  <button key={side} type="button" role="radio" aria-checked={d.pairs[p.id] === side}
                    className={`${side}${d.pairs[p.id] === side ? " on" : ""}`}
                    onClick={() => set("pairs", { ...d.pairs, [p.id]: side })}>
                    {side === "left" ? p.left : side === "right" ? p.right : "beides"}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {screen === 5 && (
        <section className="wz-screen">
          <h2>Wo stehst du gerade?</h2>
          <p className="muted">
            1 heißt „stimmt gar nicht“, 5 heißt „stimmt voll“. Ehrlich schlägt gut: Zur Halbzeit und am Ende fragen wir
            nochmal, und dann siehst du, wie weit du gekommen bist.
          </p>
          <div className="skills">
            {SKILLS.map((s) => (
              <div className="skill" key={s.id}>
                <div className="skill-head"><span className="chip">{s.phase}</span><p>{s.label}</p></div>
                <div className="scale" role="radiogroup" aria-label={s.label}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={d.skills[s.id] === n}
                      className={d.skills[s.id] === n ? "on" : ""}
                      onClick={() => set("skills", { ...d.skills, [s.id]: n })}>{n}</button>
                  ))}
                </div>
                <div className="scale-legend"><span>stimmt gar nicht</span><span>stimmt voll</span></div>
              </div>
            ))}
          </div>
        </section>
      )}

      {screen === 6 && (
        <section className="wz-screen">
          <h2>Wenn alles ginge: Was würdest du mit KI bauen?</h2>
          <p className="muted">Keine Grenzen. Kein Budget, keine Technik, die im Weg steht. Verrückt ist ausdrücklich erwünscht.</p>
          <div className="field">
            <label htmlFor="dream">Mein Traumprojekt</label>
            <textarea id="dream" rows={5} maxLength={800} value={d.dream} onChange={(e) => set("dream", e.target.value)}
              placeholder="Zum Beispiel: Eine KI, die beim Fußballtraining sieht, warum mein Schuss immer links vorbeigeht …" />
          </div>
          <div className="field">
            <label htmlFor="problem">Was nervt dich im Alltag, in der Schule oder im Verein? <span className="faint">(freiwillig)</span></label>
            <textarea id="problem" rows={3} maxLength={600} value={d.problem} onChange={(e) => set("problem", e.target.value)}
              placeholder="Gute Projekte starten oft mit einem echten Problem." />
          </div>
        </section>
      )}

      {screen === 7 && (
        <section className="wz-screen">
          <h2>Was willst du bis März schaffen?</h2>
          <p className="muted">Such dir eine Richtung aus und mach den Satz fertig. Du kannst ihn später jederzeit ändern.</p>
          <div className="segmented" role="radiogroup" aria-label="Richtung deines Ziels">
            {GOAL_DIRECTIONS.map((g) => (
              <button key={g.id} type="button" role="radio" aria-checked={d.goalDirection === g.id}
                className={d.goalDirection === g.id ? "on" : ""} onClick={() => set("goalDirection", g.id)}>{g.label}</button>
            ))}
          </div>
          {dir && (
            <div className="field">
              <label htmlFor="goal">Mein Ziel</label>
              <div className="sentence">
                <span>{dir.prefix}</span>
                <textarea id="goal" rows={2} maxLength={240} value={d.goalRest}
                  onChange={(e) => set("goalRest", e.target.value)} placeholder="…" />
              </div>
            </div>
          )}
          <div className="field">
            <label htmlFor="ifthen">Mein Plan für schwierige Momente</label>
            <div className="sentence">
              <span>{IFTHEN_PREFIX}</span>
              <textarea id="ifthen" rows={2} maxLength={240} value={d.ifthenRest}
                onChange={(e) => set("ifthenRest", e.target.value)} placeholder="…" />
            </div>
            <div className="chips small">
              {IFTHEN_SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="pick" onClick={() => set("ifthenRest", s)}>{s}</button>
              ))}
            </div>
          </div>
        </section>
      )}

      {screen === 8 && (
        <section className="wz-screen">
          <h2>Darf dein Traumprojekt auf die Ideen-Wand?</h2>
          <p className="muted">
            Auf der Ideen-Wand sehen alle aus deiner AG die Traumprojekte. So findet ihr Leute mit ähnlichen Ideen. Alles
            andere aus dem Kompass bleibt privat.
          </p>
          <div className="options">
            {([
              ["name", "Ja, mit meinem Pseudonym", `Die anderen sehen: „${pseudonym}“ und dein Traumprojekt.`],
              ["anon", "Ja, aber anonym", "Die Idee erscheint ohne Namen."],
              ["no", "Nein, lieber nicht", "Dein Traumprojekt sehen nur du und deine Coach."],
            ] as const).map(([v, t, s]) => (
              <button key={v} type="button" role="radio" aria-checked={d.share === v}
                className={`option${d.share === v ? " on" : ""}`} onClick={() => set("share", v)}>
                <b>{t}</b><span>{s}</span>
              </button>
            ))}
          </div>
          {state?.error && <div className="alert error" role="alert">{state.error}</div>}
        </section>
      )}

      {screen !== 3 && (
        <div className="wz-nav">
          {screen > 0 ? <button type="button" className="btn ghost" onClick={() => go(screen - 1)}>Zurück</button> : <span />}
          {!last && (
            <button type="button" className="btn" disabled={!canNext[screen]} onClick={() => go(screen + 1)}>
              {screen === 0 ? "Los geht's" : "Weiter"}
            </button>
          )}
          {last && (
            <form action={(fd) => { try { localStorage.removeItem(storageKey); } catch {} ; return action(fd); }}>
              <input type="hidden" name="answers" value={answers ? JSON.stringify(answers) : ""} />
              <button className="btn" type="submit" disabled={!canNext[screen] || !answers || pending || preview}>
                {pending ? "Wird gespeichert" : preview ? "Vorschau: nicht speicherbar" : "Kompass-Karte erstellen"}
              </button>
            </form>
          )}
        </div>
      )}
      {screen === 3 && (
        <div className="wz-nav">
          <button type="button" className="btn ghost" onClick={() => go(2)}>Zurück</button>
          <button type="button" className="btn" disabled={!canNext[3]} onClick={() => go(4)}>Weiter</button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Karten zum Wischen ---------------- */

function CardStack({ cards, onChange }:
  { cards: Record<string, "yes" | "no">; onChange: (c: Record<string, "yes" | "no">) => void }) {
  const idx = CARDS.findIndex((c) => !cards[c.id]);
  const done = idx === -1;
  const card = done ? null : CARDS[idx];
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<"yes" | "no" | null>(null);
  const start = useRef<number | null>(null);

  const decide = (v: "yes" | "no") => {
    if (!card || leaving) return;
    setLeaving(v);
    setTimeout(() => {
      onChange({ ...cards, [card.id]: v });
      setLeaving(null);
      setDx(0);
    }, 220);
  };
  const undo = () => {
    const answered = CARDS.filter((c) => cards[c.id]);
    const lastCard = answered[answered.length - 1];
    if (!lastCard) return;
    const next = { ...cards };
    delete next[lastCard.id];
    onChange(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") decide("yes");
      if (e.key === "ArrowLeft") decide("no");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const yesCount = CARDS.filter((c) => cards[c.id] === "yes").length;
  const offset = leaving === "yes" ? 600 : leaving === "no" ? -600 : dx;

  return (
    <section className="wz-screen">
      <h2>Das haben Jugendliche wirklich mit KI gebaut.</h2>
      <p className="muted">
        Alles echte Projekte, die meisten aus Deutschland. Würdest du so etwas auch bauen wollen? Wisch nach rechts für
        Ja, nach links für Nein, oder nutz die Knöpfe.
      </p>

      {!done && card && (
        <>
          <div className="cardstack-count">Karte {idx + 1} von {CARDS.length}</div>
          <div className="cardstack">
            {CARDS[idx + 1] && <div className="pcard behind" aria-hidden="true" />}
            <article
              className={`pcard t-${card.theme}${dx > 60 ? " hint-yes" : dx < -60 ? " hint-no" : ""}`}
              style={{
                transform: `translateX(${offset}px) rotate(${offset / 22}deg)`,
                transition: start.current === null ? "transform .22s ease" : "none",
                opacity: leaving ? 0 : 1,
              }}
              onPointerDown={(e) => { start.current = e.clientX; e.currentTarget.setPointerCapture?.(e.pointerId); }}
              onPointerMove={(e) => { if (start.current !== null) setDx(e.clientX - start.current); }}
              onPointerUp={() => {
                const moved = dx;
                start.current = null;
                if (moved > 100) decide("yes"); else if (moved < -100) decide("no"); else setDx(0);
              }}
              onPointerCancel={() => { start.current = null; setDx(0); }}
            >
              <span className="theme">{THEMES[card.theme]}</span>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
              <footer>
                <span>{card.who}</span>
                <span className="faint">{card.where}</span>
                <a className="src" href={card.source} target="_blank" rel="noreferrer"
                  onPointerDown={(e) => e.stopPropagation()}>Quelle ansehen</a>
              </footer>
              <span className="stamp yes">Würde ich bauen</span>
              <span className="stamp no">Eher nicht</span>
            </article>
          </div>
          <div className="stack-actions">
            <button type="button" className="btn ghost" onClick={() => decide("no")}>Eher nicht</button>
            <button type="button" className="btn" onClick={() => decide("yes")}>Würde ich bauen</button>
          </div>
          {idx > 0 && <button type="button" className="linkish" onClick={undo}>Letzte Karte zurücknehmen</button>}
        </>
      )}

      {done && (
        <div className="card" style={{ marginTop: 8 }}>
          <div className="body">
            <h3>Alle {CARDS.length} Karten geschafft.</h3>
            <p className="muted">
              {yesCount === 0
                ? "Keine Karte hat dich gepackt? Völlig okay. Dann ist dein Traumprojekt vielleicht etwas, das es noch gar nicht gibt."
                : `${yesCount} ${yesCount === 1 ? "Projekt würdest" : "Projekte würdest"} du selbst bauen wollen. Daraus ergeben sich deine Themenfelder.`}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="btn ghost small" onClick={undo}>Letzte Karte zurücknehmen</button>
              <button type="button" className="btn ghost small" onClick={() => onChange({})}>Alle Karten neu wischen</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
