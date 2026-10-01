"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { saveGuest, type GuestState } from "./actions";

type G = { id?: string; name?: string; role?: string; topic?: string; bio?: string; link?: string; date_iso?: string | null; time_label?: string; session_id?: string | null };

export function GuestForm({ groupId, g = {}, sessions }: { groupId: string; g?: G; sessions: { id: string; label: string }[] }) {
  const [s, a] = useActionState<GuestState, FormData>(saveGuest, undefined);
  return (
    <form action={a} className="body">
      {s?.error && <div className="alert error" role="alert">{s.error}</div>}
      {s?.ok && <div className="alert ok" role="status">{s.ok}</div>}
      <input type="hidden" name="id" value={g.id ?? ""} />
      <input type="hidden" name="group_id" value={groupId} />
      <div className="grid-form" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="field"><label htmlFor="g-name">Name</label><input id="g-name" name="name" type="text" defaultValue={g.name} maxLength={120} placeholder="z. B. Dr. Lena Weber" /></div>
        <div className="field"><label htmlFor="g-role">Rolle oder Organisation</label><input id="g-role" name="role" type="text" defaultValue={g.role} maxLength={160} placeholder="z. B. KI-Forscherin am DESY" /></div>
      </div>
      <div className="field"><label htmlFor="g-topic">Thema des Besuchs</label><input id="g-topic" name="topic" type="text" defaultValue={g.topic} maxLength={200} placeholder="z. B. Wie KI hilft, Teilchen zu finden" /></div>
      <div className="field">
        <label htmlFor="g-bio">Kurzvorstellung</label>
        <textarea id="g-bio" name="bio" rows={4} maxLength={3000} defaultValue={g.bio} placeholder="Wer ist der Gast, was macht er oder sie, warum ist das spannend für euch?" />
      </div>
      <div className="grid-form" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <div className="field"><label htmlFor="g-date">Datum</label><input id="g-date" name="date" type="date" defaultValue={g.date_iso ?? ""} /></div>
        <div className="field"><label htmlFor="g-time">Uhrzeit (freiwillig)</label><input id="g-time" name="time_label" type="text" defaultValue={g.time_label} maxLength={40} placeholder="z. B. 14:30 Uhr" /></div>
        <div className="field"><label htmlFor="g-session">Sitzung</label>
          <select id="g-session" name="session_id" className="select" defaultValue={g.session_id ?? ""}>
            <option value="">keine Zuordnung</option>
            {sessions.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </div>
      </div>
      <div className="field"><label htmlFor="g-link">Link (freiwillig)</label><input id="g-link" name="link" type="text" defaultValue={g.link} maxLength={500} placeholder="https://… Webseite, Profil, Projekt" /></div>
      <div><SubmitButton className="btn" pending="Speichert">{g.id ? "Speichern" : "Gast anlegen"}</SubmitButton></div>
    </form>
  );
}
