"use client";

import { useActionState, useEffect, useRef } from "react";
import { submitSource, type SubmitState } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";

export function SubmitForm() {
  const [state, action] = useActionState<SubmitState, FormData>(submitSource, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form action={action} ref={ref} className="body" noValidate>
      {state?.error && <div className="alert error" role="alert">{state.error}</div>}
      {state?.ok && <div className="alert ok" role="status">{state.ok}</div>}
      <div className="field">
        <label htmlFor="url">Link</label>
        <input id="url" name="url" type="text" inputMode="url" autoComplete="off" placeholder="https://…" required />
        <span className="hint">Artikel, Video, TikTok, Podcast: alles erlaubt.</span>
      </div>
      <div className="field">
        <label htmlFor="note">Warum ist das spannend?</label>
        <textarea id="note" name="note" rows={3} maxLength={500} required placeholder="In einem oder zwei Sätzen. Das erscheint mit deinem Namen im Radar." />
      </div>

      <div className="stack" style={{ gap: 10 }}>
        <h3 style={{ fontSize: 16 }}>Dein Quellen-Check</h3>
        <div className="check-q">
          <span>Wer hat das veröffentlicht?</span>
          <input id="who" name="who" type="text" maxLength={120} placeholder="z. B. tagesschau, ein Tech-Blog, ein Influencer, weiß nicht" />
        </div>
        <div className="check-q">
          <span>Von wann ist das?</span>
          <input id="when" name="when" type="text" maxLength={60} placeholder="z. B. gestern, 20.10.2026, weiß nicht" />
        </div>
        <div className="check-q" role="radiogroup" aria-label="Gibt es Belege?">
          <span>Werden Belege genannt, zum Beispiel eine Studie, Zahlen oder Fachleute?</span>
          <div className="chips small">
            {[["ja", "Ja"], ["nein", "Nein"], ["unklar", "Bin mir nicht sicher"]].map(([v, l]) => (
              <label key={v} className="pick radio-pick">
                <input type="radio" name="evidence" value={v} /> {l}
              </label>
            ))}
          </div>
        </div>
      </div>
      <SubmitButton pending="Wird eingereicht">Quelle einreichen</SubmitButton>
    </form>
  );
}
