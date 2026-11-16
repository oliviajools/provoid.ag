"use client";

import { useActionState, useState } from "react";
import { createGroup, moveMember, resetPassword, updateGroup, type ResetState } from "./actions";
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

type GroupEdit = { id: string; name: string; school: string; short_name: string; cohort: string; schedule: string; starts_iso: string | null };

export function EditGroupForm({ g }: { g: GroupEdit }) {
  const [state, action] = useActionState(updateGroup, undefined);
  return (
    <form action={action} className="stack" style={{ gap: 12 }}>
      <input type="hidden" name="id" value={g.id} />
      {state?.error && <div className="alert error" role="alert">{state.error}</div>}
      {state?.ok && <div className="alert ok" role="status">{state.ok}</div>}
      <div className="grid-form">
        <div className="field"><label htmlFor={`s-${g.id}`}>Kurzname</label>
          <input id={`s-${g.id}`} name="short_name" defaultValue={g.short_name} placeholder="GymEpp oder Johanneum" maxLength={30} /></div>
        <div className="field"><label htmlFor={`c-${g.id}`}>Jahrgänge</label>
          <input id={`c-${g.id}`} name="cohort" defaultValue={g.cohort} placeholder="Jg. 9/10" maxLength={30} /></div>
        <div className="field"><label htmlFor={`t-${g.id}`}>Termin</label>
          <input id={`t-${g.id}`} name="schedule" defaultValue={g.schedule} placeholder="Mo 12:10" maxLength={40} /></div>
        <div className="field"><label htmlFor={`d-${g.id}`}>Erste Sitzung</label>
          <input id={`d-${g.id}`} name="starts_on" type="date" defaultValue={g.starts_iso ?? ""} /></div>
        <div className="field"><label htmlFor={`n-${g.id}`}>Name der AG</label>
          <input id={`n-${g.id}`} name="name" defaultValue={g.name} required maxLength={80} /></div>
        <div className="field"><label htmlFor={`sc-${g.id}`}>Schule</label>
          <input id={`sc-${g.id}`} name="school" defaultValue={g.school} maxLength={80} /></div>
        <SubmitButton className="btn small" pending="Speichert">Speichern</SubmitButton>
      </div>
    </form>
  );
}

export function MoveMemberForm({ userId, groups }: { userId: string; groups: { id: string; label: string }[] }) {
  const [state, action] = useActionState(moveMember, undefined);
  if (state?.ok) return <span className="faint">{state.ok}</span>;
  return (
    <form action={action} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <input type="hidden" name="user_id" value={userId} />
      <select name="group_id" className="select" style={{ width: "auto" }} aria-label="In andere AG verschieben" defaultValue="">
        <option value="" disabled>In AG verschieben</option>
        {groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
      </select>
      <SubmitButton className="btn ghost small" pending="Verschiebt">OK</SubmitButton>
      {state?.error && <span className="faint" role="alert">{state.error}</span>}
    </form>
  );
}
