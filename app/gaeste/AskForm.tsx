"use client";

import { useActionState, useEffect, useRef } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { askQuestion, type AskState } from "./actions";

export function AskForm({ guestId, name }: { guestId: string; name: string }) {
  const [s, a] = useActionState<AskState, FormData>(askQuestion, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (s?.ok) ref.current?.reset(); }, [s]);
  return (
    <form action={a} ref={ref} className="stack" style={{ gap: 8 }}>
      <input type="hidden" name="guest_id" value={guestId} />
      <label htmlFor={`q-${guestId}`} className="faint" style={{ color: "var(--text)" }}>Was willst du {name} fragen?</label>
      <textarea id={`q-${guestId}`} name="body" rows={2} maxLength={500} placeholder="Deine Frage sieht nur deine Coach. Sie sammelt die Fragen für den Besuch." />
      {s?.error && <div className="alert error" role="alert">{s.error}</div>}
      {s?.ok && <div className="alert ok" role="status">{s.ok}</div>}
      <div><SubmitButton className="btn small" pending="Sendet">Frage schicken</SubmitButton></div>
    </form>
  );
}
