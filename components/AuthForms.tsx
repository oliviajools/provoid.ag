"use client";

import Link from "next/link";
import { useActionState } from "react";
import { changePassword, coachLogin, login, register } from "@/app/actions";
import { SubmitButton } from "./SubmitButton";

export function LoginForm() {
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="body" noValidate>
      {state?.error && <div className="alert error" role="alert">{state.error}</div>}
      <div className="field">
        <label htmlFor="code">AG-Code</label>
        <input id="code" name="code" type="text" className="code" autoComplete="off" autoCapitalize="characters"
          placeholder="z. B. EPP2026" defaultValue={state?.fields?.code} required />
      </div>
      <div className="field">
        <label htmlFor="pseudonym">Pseudonym</label>
        <input id="pseudonym" name="pseudonym" type="text" autoComplete="username" autoCapitalize="none"
          defaultValue={state?.fields?.pseudonym} required />
      </div>
      <div className="field">
        <label htmlFor="password">Passwort</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <SubmitButton pending="Wird geprüft">Einloggen</SubmitButton>
      <p className="faint" style={{ textAlign: "center" }}>
        Zum ersten Mal hier? <Link href="/registrieren">Zugang anlegen</Link>
      </p>
    </form>
  );
}

export function RegisterForm({ initialCode = "" }: { initialCode?: string }) {
  const [state, action] = useActionState(register, undefined);
  return (
    <form action={action} className="body" noValidate>
      {state?.error && <div className="alert error" role="alert">{state.error}</div>}
      <div className="field">
        <label htmlFor="code">AG-Code</label>
        <input id="code" name="code" type="text" className="code" autoComplete="off" autoCapitalize="characters"
          defaultValue={state?.fields?.code ?? initialCode} required />
        <span className="hint">Den Code bekommst du in der ersten Session.</span>
      </div>
      <div className="field">
        <label htmlFor="pseudonym">Pseudonym</label>
        <input id="pseudonym" name="pseudonym" type="text" autoComplete="username" autoCapitalize="none"
          defaultValue={state?.fields?.pseudonym} maxLength={20} required />
        <span className="hint">3 bis 20 Zeichen. Bitte nicht dein voller echter Name.</span>
      </div>
      <div className="field">
        <label htmlFor="password">Passwort</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <span className="hint">Mindestens 8 Zeichen.</span>
      </div>
      <div className="field">
        <label htmlFor="password2">Passwort wiederholen</label>
        <input id="password2" name="password2" type="password" autoComplete="new-password" required />
      </div>
      <label className="check">
        <input type="checkbox" name="consent" id="consent" />
        <span>
          Ich habe die <Link href="/datenschutz" target="_blank">Datenschutzhinweise</Link> gelesen. Wenn ich
          jünger als 16 bin, haben meine Eltern der Teilnahme zugestimmt.
        </span>
      </label>
      <SubmitButton pending="Zugang wird angelegt">Zugang anlegen</SubmitButton>
      <p className="faint" style={{ textAlign: "center" }}>
        Schon dabei? <Link href="/">Zum Login</Link>
      </p>
    </form>
  );
}

export function CoachLoginForm() {
  const [state, action] = useActionState(coachLogin, undefined);
  return (
    <form action={action} className="body" noValidate>
      {state?.error && <div className="alert error" role="alert">{state.error}</div>}
      <div className="field">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" type="text" autoComplete="username" autoCapitalize="none" defaultValue={state?.fields?.name} required />
      </div>
      <div className="field">
        <label htmlFor="password">Passwort</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <SubmitButton pending="Wird geprüft">Einloggen</SubmitButton>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="body" noValidate>
      {state?.error && <div className="alert error" role="alert">{state.error}</div>}
      <div className="field">
        <label htmlFor="current">Aktuelles oder vorläufiges Passwort</label>
        <input id="current" name="current" type="password" autoComplete="current-password" required />
      </div>
      <div className="field">
        <label htmlFor="password">Neues Passwort</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <span className="hint">Mindestens 8 Zeichen.</span>
      </div>
      <div className="field">
        <label htmlFor="password2">Neues Passwort wiederholen</label>
        <input id="password2" name="password2" type="password" autoComplete="new-password" required />
      </div>
      <SubmitButton pending="Wird gespeichert">Passwort speichern</SubmitButton>
    </form>
  );
}
