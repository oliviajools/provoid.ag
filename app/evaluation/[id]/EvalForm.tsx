"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { A1, OPEN, SCALE, SCENARIOS, TEMPO, type EvalAnswers, type EvalDef } from "@/lib/evaluation";
import { saveEvaluation } from "./actions";

const ABCD = "abcd";

function Choice({ label, opts, value, onPick, small = false }: {
  label: string; opts: readonly string[]; value: number | undefined; onPick: (i: number) => void; small?: boolean;
}) {
  return (
    <div className="lv-opts" role="radiogroup" aria-label={label}>
      {opts.map((o, i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i}
          className={`lv-opt${value === i ? " on" : ""}`} style={small ? { flexBasis: 90, fontSize: 14 } : undefined}
          onClick={() => onPick(i)}>{o}</button>
      ))}
    </div>
  );
}

function Q({ nr, children }: { nr: string | number; children: React.ReactNode }) {
  return (
    <div className="lv-q">
      <div style={{ display: "grid", gridTemplateColumns: "34px 1fr", gap: 6, alignItems: "start" }}>
        <span style={{ color: "var(--accent)", fontWeight: 800 }}>{nr}</span>
        <div className="stack" style={{ gap: 10 }}>{children}</div>
      </div>
    </div>
  );
}

export function EvalForm({ def, needsAg, preview }: { def: EvalDef; needsAg: boolean; preview: boolean }) {
  const [state, action] = useActionState(saveEvaluation, undefined);
  const [a, setA] = useState<EvalAnswers>({ a1: {}, open: {}, scen: {} });
  const set = (patch: Partial<EvalAnswers>) => setA((x) => ({ ...x, ...patch }));
  const scen = (id: string) => a.scen?.[id] ?? { choice: -1, why: "" };

  if (state?.ok) {
    return (
      <section className="card"><div className="body">
        <h2>Danke!</h2>
        <p className="muted">Deine Antworten sind gespeichert, ohne deinen Namen. Ein Ergebnis aus dieser Runde siehst du in den News der nächsten Sitzung.</p>
      </div></section>
    );
  }

  const fiveScale = ["1", "2", "3", "4", "5"];
  return (
    <form action={action} className="stack" style={{ gap: 26 }}>
      <input type="hidden" name="eval_id" value={def.id} />
      <input type="hidden" name="answers" value={JSON.stringify(a)} />

      <section className="card">
        <header><h3>Dein Code</h3><span className="chip">jedes Mal derselbe</span></header>
        <div className="body">
          <p className="muted" style={{ margin: 0 }}>
            Erste 2 Buchstaben vom Vornamen deiner Mutter (oder einer anderen wichtigen Person), der Tag deines Geburtstags (2 Ziffern)
            und die ersten 2 Buchstaben deines Geburtsorts. Beispiel: Sabine, 7. März, Kiel ergibt <b>SA07KI</b>.
          </p>
          <div className="field" style={{ maxWidth: 240 }}>
            <label htmlFor="code">Code</label>
            <input id="code" name="code" className="code" type="text" maxLength={8} autoComplete="off" placeholder="SA07KI" required />
          </div>
          {needsAg && (
            <div className="field" style={{ maxWidth: 240 }}>
              <label htmlFor="ag">AG-Code</label>
              <input id="ag" name="ag" className="code" type="text" maxLength={20} autoComplete="off" placeholder="steht an der Tafel" />
              <span className="hint">Nur nötig, wenn du nicht eingeloggt bist.</span>
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <header><h3>Teil A · Dein Stand</h3><span className="chip">1 bis 10</span></header>
        <div className="body">
          <p className="faint" style={{ margin: 0 }}>1 = {SCALE[0]} · 5 = {SCALE[4]} · ? = kann ich nicht sagen</p>
          {A1.map((it, i) => (
            <Q nr={i + 1} key={it.id}>
              <b style={{ color: "var(--text)" }}>{it.text}</b>
              <Choice label={it.text} small opts={[...fiveScale, "?"]}
                value={a.a1[it.id] === undefined ? undefined : a.a1[it.id] === 0 ? 5 : a.a1[it.id] - 1}
                onPick={(k) => set({ a1: { ...a.a1, [it.id]: k === 5 ? 0 : k + 1 } })} />
            </Q>
          ))}
        </div>
      </section>

      {def.checks && def.topic && (
        <section className="card">
          <header><h3>Das Thema von heute</h3><span className="chip">11 bis 14</span></header>
          <div className="body">
            <p className="muted" style={{ margin: 0 }}>Thema: {def.topic}</p>
            <Q nr={11}><b style={{ color: "var(--text)" }}>Wie gut hättest du das vor der Sitzung erklären können?</b>
              <Choice label="vorher" small opts={fiveScale} value={a.before ? a.before - 1 : undefined} onPick={(k) => set({ before: k + 1 })} />
              <span className="faint">1 = gar nicht · 5 = sehr gut</span></Q>
            <Q nr={12}><b style={{ color: "var(--text)" }}>Wie gut kannst du das jetzt erklären?</b>
              <Choice label="jetzt" small opts={fiveScale} value={a.now ? a.now - 1 : undefined} onPick={(k) => set({ now: k + 1 })} />
              <span className="faint">1 = gar nicht · 5 = sehr gut</span></Q>
            {def.checks.map((c, ci) => (
              <Q nr={13 + ci} key={ci}><b style={{ color: "var(--text)" }}>Kurzcheck: {c.q}</b>
                <Choice label={c.q} opts={c.opts.map((o, k) => `${ABCD[k]}) ${o}`)} value={a.checks?.[ci] ?? undefined}
                  onPick={(k) => { const arr = [...(a.checks ?? def.checks!.map(() => -1))]; arr[ci] = k; set({ checks: arr }); }} />
              </Q>
            ))}
          </div>
        </section>
      )}

      {def.checks && def.parts && (
        <section className="card">
          <header><h3>Die Sitzung</h3><span className="chip">15 bis 17</span></header>
          <div className="body">
            <Q nr={15}><b style={{ color: "var(--text)" }}>Wie interessant fandest du die Sitzung?</b>
              <Choice label="Interesse" small opts={fiveScale} value={a.interest ? a.interest - 1 : undefined} onPick={(k) => set({ interest: k + 1 })} />
              <span className="faint">1 = gar nicht · 5 = sehr</span></Q>
            <Q nr={16}><b style={{ color: "var(--text)" }}>Wie war das Tempo?</b>
              <Choice label="Tempo" opts={TEMPO} value={a.tempo} onPick={(k) => set({ tempo: k })} /></Q>
            <Q nr={17}><b style={{ color: "var(--text)" }}>Welcher Teil hat dir am meisten gebracht?</b>
              <Choice label="bester Teil" opts={def.parts} value={a.part} onPick={(k) => set({ part: k })} /></Q>
          </div>
        </section>
      )}

      {def.checks && (
        <section className="card">
          <header><h3>Teil B · In deinen Worten</h3><span className="chip">ein bis zwei Sätze</span></header>
          <div className="body">
            {OPEN.map((o, i) => (
              <div className="field" key={o.id}>
                <label htmlFor={o.id} style={{ textTransform: "none", letterSpacing: 0, fontSize: 15, color: "var(--text)" }}>
                  {"ABCD"[i]}. {o.text} <span className="faint">({o.required ? "Pflicht" : "freiwillig"})</span>
                </label>
                <textarea id={o.id} rows={3} maxLength={1500} value={a.open?.[o.id] ?? ""}
                  onChange={(e) => set({ open: { ...a.open, [o.id]: e.target.value } })} />
              </div>
            ))}
          </div>
        </section>
      )}

      {def.scenarios && (
        <section className="card">
          <header><h3>Teil C · Vier Situationen</h3><span className="chip">Was würdest du tun?</span></header>
          <div className="body">
            {SCENARIOS.map((s) => (
              <Q nr={s.id.toUpperCase()} key={s.id}>
                <b style={{ color: "var(--text)" }}>{s.text}</b>
                {s.opts && <Choice label={s.text} opts={s.opts.map((o, k) => `${ABCD[k]}) ${o}`)} value={scen(s.id).choice < 0 ? undefined : scen(s.id).choice}
                  onPick={(k) => set({ scen: { ...a.scen, [s.id]: { ...scen(s.id), choice: k } } })} />}
                <textarea aria-label={`${s.id} Begründung`} rows={3} maxLength={1500} placeholder={s.opts ? "Warum?" : "Deine Antwort"}
                  value={scen(s.id).why} onChange={(e) => set({ scen: { ...a.scen, [s.id]: { ...scen(s.id), why: e.target.value } } })} />
              </Q>
            ))}
          </div>
        </section>
      )}

      {state?.error && <div className="alert error" role="alert">{state.error}</div>}
      {preview
        ? <p className="muted">Vorschau für Coaches: Abschicken ist nur für Teilnehmende möglich.</p>
        : <div><SubmitButton className="btn" pending="Speichert">Abschicken</SubmitButton></div>}
    </form>
  );
}
