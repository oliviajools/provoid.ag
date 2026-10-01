"use client";

import { useActionState, useEffect, useRef } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { addWish, type WishState } from "./actions";

export function WishForm() {
  const [s, a] = useActionState<WishState, FormData>(addWish, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (s?.ok) ref.current?.reset(); }, [s]);
  return (
    <form action={a} ref={ref} className="body">
      {s?.error && <div className="alert error" role="alert">{s.error}</div>}
      {s?.ok && <div className="alert ok" role="status">{s.ok}</div>}
      <div className="field">
        <label htmlFor="w-title">Thema</label>
        <input id="w-title" name="title" type="text" maxLength={120} placeholder="z. B. Wie erkennt man Deepfakes?" />
      </div>
      <div className="field">
        <label htmlFor="w-details">Was genau interessiert dich daran? <span className="faint">(freiwillig)</span></label>
        <textarea id="w-details" name="details" rows={3} maxLength={600} placeholder="Eine Frage, ein Beispiel, ein Video, das du gesehen hast …" />
      </div>
      <label className="check"><input type="checkbox" name="anonymous" id="w-anon" /><span>Ohne meinen Namen anzeigen</span></label>
      <SubmitButton pending="Wird eingetragen">Thema eintragen</SubmitButton>
    </form>
  );
}
