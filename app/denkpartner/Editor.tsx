"use client";

import { useActionState, useMemo, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { FELDER, bauePrompt, mitStandard, type Felder } from "@/lib/denkpartner-prompt";
import { speichern, type SaveState } from "./actions";

type Props = {
  dp?: { id: string; name: string; fach: string; jahrgang: string; felder: Partial<Felder> };
  jahrgangVorschlag?: string;
  offen?: boolean;
};

export function Editor({ dp, jahrgangVorschlag = "", offen = true }: Props) {
  const [s, action] = useActionState<SaveState, FormData>(speichern, undefined);
  const [meta, setMeta] = useState({ name: dp?.name ?? "", fach: dp?.fach ?? "", jahrgang: dp?.jahrgang ?? jahrgangVorschlag });
  const [felder, setFelder] = useState<Felder>(() => mitStandard(dp?.felder ?? {}));
  const [kopiert, setKopiert] = useState(false);
  const prompt = useMemo(() => bauePrompt(felder, meta), [felder, meta]);

  async function kopieren() {
    try { await navigator.clipboard.writeText(prompt); setKopiert(true); setTimeout(() => setKopiert(false), 2500); } catch { /* ignorieren */ }
  }

  const form = (
    <form action={action} className="dp-editor">
      {dp && <input type="hidden" name="id" value={dp.id} />}
      {s?.error && <div className="alert error" role="alert">{s.error}</div>}
      {s?.ok && <div className="alert ok" role="status">{s.ok}</div>}

      <div className="dp-meta">
        <div className="field">
          <label htmlFor="dp-name">Name deines Denkpartners</label>
          <input id="dp-name" type="text" name="name" maxLength={60} required value={meta.name} placeholder="z. B. Bio-Coach Proteine"
            onChange={(e) => setMeta({ ...meta, name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="dp-fach">Fach</label>
          <input id="dp-fach" type="text" name="fach" maxLength={60} value={meta.fach} placeholder="z. B. Biologie"
            onChange={(e) => setMeta({ ...meta, fach: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="dp-jg">Jahrgang</label>
          <input id="dp-jg" type="text" name="jahrgang" maxLength={30} value={meta.jahrgang} placeholder="z. B. 11"
            onChange={(e) => setMeta({ ...meta, jahrgang: e.target.value })} />
        </div>
      </div>

      <div className="dp-felder">
        {FELDER.map((f, i) => (
          <div className={`dp-feld${f.standard ? " fest" : ""}`} key={f.id}>
            <label htmlFor={`dp-${f.id}`}><b className="dp-nr">{i + 1}</b> {f.label}</label>
            <p className="hint">{f.frage}{f.standard ? " Der Vorschlag kann so bleiben." : ""}</p>
            <textarea id={`dp-${f.id}`} name={f.id} rows={f.zeilen} maxLength={f.max} value={felder[f.id]}
              placeholder={f.beispiel ? `Beispiel: ${f.beispiel}` : ""}
              onChange={(e) => setFelder({ ...felder, [f.id]: e.target.value })} />
          </div>
        ))}
      </div>

      <p className="faint">Tipp: Beschreib, was er tun soll, nicht wie er sein soll. Statt „sei hilfreich“ lieber „stell mir pro Nachricht genau eine Frage“.</p>

      <details className="dp-vorschau">
        <summary>Fertige Anweisung ansehen <span className="faint">(die Grundregeln gegen Tricks und der Rahmen der AG kommen automatisch dazu)</span></summary>
        <pre className="dp-prompt">{prompt}</pre>
        <button type="button" className="btn ghost small" onClick={kopieren}>
          {kopiert ? "Kopiert" : "Anweisung kopieren, z. B. für Gemini oder ChatGPT"}
        </button>
      </details>

      <SubmitButton pending="Wird gespeichert" className="btn">{dp ? "Speichern" : "Speichern und testen"}</SubmitButton>
    </form>
  );

  if (offen) return form;
  return (
    <details className="card dp-details">
      <summary>Bausteine anzeigen und ändern</summary>
      <div className="body">{form}</div>
    </details>
  );
}
