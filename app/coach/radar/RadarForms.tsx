"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { addFeed, addManual, approve, importNow, reject, testFeedAction, type ActState } from "./actions";

function Msg({ s }: { s: ActState }) {
  if (!s) return null;
  return s.error ? <div className="alert error" role="alert">{s.error}</div> : <div className="alert ok" role="status">{s.ok}</div>;
}

export function ImportButton() {
  const [s, a] = useActionState(importNow, undefined);
  return (
    <form action={a} className="stack" style={{ gap: 8 }}>
      <SubmitButton className="btn" pending="Quellen werden abgerufen">Quellen jetzt abrufen</SubmitButton>
      <Msg s={s} />
    </form>
  );
}

export function QueueActions({ id, kid, ai }: { id: string; kid: boolean; ai: boolean }) {
  const [s1, a1] = useActionState(approve, undefined);
  const [s2, a2] = useActionState(reject, undefined);
  const [rejecting, setRejecting] = useState(false);
  if (s1?.ok || s2?.ok) return <Msg s={s1?.ok ? s1 : s2} />;
  return (
    <>
      <div className="qactions">
        <form action={a1}>
          <input type="hidden" name="id" value={id} />
          <SubmitButton className="btn small" pending={ai ? "KI schreibt die Karte" : "Öffnet"}>{ai ? "Freigeben" : "Karte schreiben"}</SubmitButton>
        </form>
        <Link className="btn ghost small" href={`/coach/radar/${id}`}>Bearbeiten</Link>
        {!rejecting ? (
          <button type="button" className="btn ghost small" onClick={() => setRejecting(true)}>{kid ? "Ablehnen" : "Verwerfen"}</button>
        ) : (
          <form action={a2} className="qactions">
            <input type="hidden" name="id" value={id} />
            {kid && <input type="text" name="reason" placeholder="Kurzes Feedback für die Person (freiwillig)" aria-label="Feedback" maxLength={300} />}
            <SubmitButton className="btn ghost small" pending="…">{kid ? "Ablehnen" : "Verwerfen"}</SubmitButton>
            <button type="button" className="linkish" onClick={() => setRejecting(false)}>Abbrechen</button>
          </form>
        )}
      </div>
      <Msg s={s1 ?? s2} />
    </>
  );
}

export function TestFeedButton({ id }: { id: string }) {
  const [s, a] = useActionState(testFeedAction, undefined);
  return (
    <form action={a} className="stack" style={{ gap: 6 }}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton className="btn ghost small" pending="Teste">Testen</SubmitButton>
      {s && <span className={s.error ? "faint" : "faint"} style={{ color: s.error ? "var(--danger)" : "var(--ok)", maxWidth: 360 }}>{s.error ?? s.ok}</span>}
    </form>
  );
}

export function AddFeedForm() {
  const [s, a] = useActionState(addFeed, undefined);
  return (
    <form action={a} className="stack" style={{ gap: 10 }}>
      <Msg s={s} />
      <div className="grid-form" style={{ gridTemplateColumns: "1fr 2fr auto" }}>
        <div className="field"><label htmlFor="f-name">Name</label><input id="f-name" name="name" type="text" placeholder="z. B. Spektrum" /></div>
        <div className="field"><label htmlFor="f-url">Feed-Adresse (RSS)</label><input id="f-url" name="url" type="text" placeholder="https://…/feed" /></div>
        <SubmitButton className="btn" pending="…">Hinzufügen</SubmitButton>
      </div>
    </form>
  );
}

export function AddManualForm() {
  const [s, a] = useActionState(addManual, undefined);
  return (
    <form action={a} className="stack" style={{ gap: 10 }}>
      <Msg s={s} />
      <div className="grid-form" style={{ gridTemplateColumns: "1fr auto" }}>
        <div className="field"><label htmlFor="m-url">Eigener Link</label><input id="m-url" name="url" type="text" placeholder="https://…" /></div>
        <SubmitButton className="btn" pending="Wird vorbereitet">Karte erstellen</SubmitButton>
      </div>
    </form>
  );
}
