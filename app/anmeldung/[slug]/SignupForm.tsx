"use client";

import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import type { SignupState } from "./actions";

type Opt = { id: string; label: string; detail: string; full: boolean };

export function SignupForm({ action, options }: { action: (s: SignupState, f: FormData) => Promise<SignupState>; options: Opt[] }) {
  const [s, a] = useActionState<SignupState, FormData>(action, undefined);

  if (s && "done" in s) {
    return (
      <div className="body">
        <div className="alert ok" role="status" style={{ fontSize: 16 }}>
          {s.waitlist
            ? <>Vielen Dank! <b>{s.child}</b> steht auf der <b>Warteliste</b> für {s.option}. Sobald ein Platz frei wird, melden wir uns unter {s.email}.</>
            : <>Vielen Dank! <b>{s.child}</b> ist für <b>{s.option}</b> angemeldet. Weitere Informationen und den AG-Code für die Lernplattform gibt es beim ersten Termin.</>}
        </div>
        <p className="muted">Sie erhalten keine automatische Bestätigungsmail. Machen Sie gern einen Screenshot dieser Seite. Bei Fragen oder für eine Abmeldung erreichen Sie uns über provoid.de.</p>
      </div>
    );
  }
  const f = (s && "fields" in s ? s.fields : undefined) ?? {};
  const err = s && "error" in s ? s.error : undefined;

  return (
    <form action={a} className="body" noValidate>
      {err && <div className="alert error" role="alert">{err}</div>}

      <fieldset className="fs">
        <legend>Gruppe</legend>
        <div className="options">
          {options.map((o) => (
            <label key={o.id} className="option radio-option">
              <input type="radio" name="option_id" value={o.id} defaultChecked={f.option_id === o.id} />
              <span className="stack" style={{ gap: 2 }}>
                <b>{o.label}{o.full && <span className="chip" style={{ marginLeft: 8 }}>voll, Warteliste</span>}</b>
                <span>{o.detail}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="fs">
        <legend>Ihr Kind</legend>
        <div className="grid-form" style={{ gridTemplateColumns: "1fr 1fr 120px" }}>
          <div className="field"><label htmlFor="child_first">Vorname</label><input id="child_first" name="child_first" type="text" autoComplete="off" defaultValue={f.child_first} maxLength={80} /></div>
          <div className="field"><label htmlFor="child_last">Nachname</label><input id="child_last" name="child_last" type="text" autoComplete="off" defaultValue={f.child_last} maxLength={80} /></div>
          <div className="field"><label htmlFor="class_name">Klasse</label><input id="class_name" name="class_name" type="text" placeholder="z. B. 9b" defaultValue={f.class_name} maxLength={20} /></div>
        </div>
      </fieldset>

      <fieldset className="fs">
        <legend>Erziehungsberechtigte Person</legend>
        <div className="field"><label htmlFor="parent_name">Vor- und Nachname</label><input id="parent_name" name="parent_name" type="text" autoComplete="name" defaultValue={f.parent_name} maxLength={120} /></div>
        <div className="grid-form" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="field"><label htmlFor="email">E-Mail</label><input id="email" name="email" type="text" inputMode="email" autoComplete="email" defaultValue={f.email} maxLength={200} /></div>
          <div className="field"><label htmlFor="phone">Telefon <span className="faint">(freiwillig)</span></label><input id="phone" name="phone" type="text" inputMode="tel" autoComplete="tel" defaultValue={f.phone} maxLength={40} /></div>
        </div>
        <div className="field">
          <label htmlFor="notes">Anmerkungen oder Fragen <span className="faint">(freiwillig)</span></label>
          <textarea id="notes" name="notes" rows={3} maxLength={1000} defaultValue={f.notes} />
        </div>
      </fieldset>

      <fieldset className="fs">
        <legend>Einverständnis</legend>
        <label className="check"><input type="checkbox" name="consent_participation" /><span>Ich melde mein Kind verbindlich für die KI-AG an. Die AG läuft bis Ende Juni 2027. Eine Abmeldung ist jederzeit formlos möglich.</span></label>
        <label className="check"><input type="checkbox" name="consent_platform" /><span>Mein Kind darf die Lernplattform ag.provoid.de nutzen. Es meldet sich dort nur mit einem AG-Code und einem selbst gewählten Pseudonym an, ohne Klarnamen und ohne E-Mail-Adresse.</span></label>
        <label className="check"><input type="checkbox" name="consent_privacy" /><span>Ich habe die <Link href="#datenschutz">Datenschutzhinweise zur Anmeldung</Link> gelesen und bin mit der Verarbeitung der Angaben einverstanden.</span></label>
        <label className="check"><input type="checkbox" name="photo_ok" /><span><b style={{ color: "var(--text)" }}>Freiwillig:</b> Fotos aus der AG, auf denen mein Kind zu erkennen ist, dürfen für die Website der Schule und von PROVOID verwendet werden. Diese Einwilligung kann ich jederzeit widerrufen.</span></label>
      </fieldset>

      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor="website">Website</label><input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <SubmitButton pending="Wird gesendet">Verbindlich anmelden</SubmitButton>
    </form>
  );
}
