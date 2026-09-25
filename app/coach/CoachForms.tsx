"use client";

import { useActionState, useState } from "react";
import { createGroup, resetPassword, type ResetState } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export function CreateGroupForm() {
  const [state, action] = useActionState(createGroup, undefined);
  return (
    <form action={action} className="body">
      {state?.error && <div className="alert error" role="alert">{state.error}</div>}
      {state?.ok && <div className="alert ok" role="status">{state.ok}</div>}
      <div className="grid-form">
        <div className="field">
          <label htmlFor="g-name">Name der AG</label>
          <input id="g-name" name="name" type="text" placeholder="KI-AG 2026/27" required />
        </div>
        <div className="field">
          <label htmlFor="g-school">Schule</label>
          <input id="g-school" name="school" type="text" placeholder="Name der Schule" />
        </div>
        <div className="field">
          <label htmlFor="g-code">AG-Code (optional)</label>
          <input id="g-code" name="code" type="text" className="code" placeholder="automatisch" maxLength={16} />
        </div>
        <div className="field">
          <label htmlFor="g-start">Erste Session</label>
          <input id="g-start" name="starts_on" type="date" />
        </div>
        <SubmitButton className="btn" pending="Wird angelegt">AG anlegen</SubmitButton>
      </div>
    </form>
  );
}

export function ResetPasswordButton({ userId }: { userId: string }) {
  const [state, action] = useActionState<ResetState, FormData>(resetPassword, undefined);
  const [armed, setArmed] = useState(false);

  if (state && "password" in state) {
    return (
      <span>
        Vorläufiges Passwort: <span className="temp">{state.password}</span>
        <br /><span className="faint">Einmal anzeigen, dann muss {state.pseudonym} ein eigenes festlegen.</span>
      </span>
    );
  }
  if (!armed) {
    return <button type="button" className="btn ghost small" onClick={() => setArmed(true)}>Passwort zurücksetzen</button>;
  }
  return (
    <form action={action} style={{ display: "inline-flex", gap: 8 }}>
      <input type="hidden" name="user_id" value={userId} />
      <SubmitButton className="btn small" pending="Setze zurück">Ja, zurücksetzen</SubmitButton>
      <button type="button" className="btn ghost small" onClick={() => setArmed(false)}>Abbrechen</button>
    </form>
  );
}
