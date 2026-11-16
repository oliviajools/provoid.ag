"use client";

import { useActionState } from "react";
import { saveAttendance } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

type Row = { user_id: string; pseudonym: string; disabled: boolean; status: "present" | "excused" | "absent" | null; source: "auto" | "manual" | null };

const OPTS = [["present", "da", "p"], ["excused", "entsch.", "e"], ["absent", "fehlt", "a"]] as const;

export function AttendanceForm({ sessionId, rows, protocol }: { sessionId: string; rows: Row[]; protocol: string }) {
  const [state, action] = useActionState(saveAttendance, undefined);
  const present = rows.filter((r) => r.status === "present").length;
  return (
    <form action={action} className="stack" style={{ gap: 16 }}>
      <input type="hidden" name="session_id" value={sessionId} />
      {state?.error && <div className="alert error" role="alert">{state.error}</div>}
      {state?.ok && <div className="alert ok" role="status">{state.ok}</div>}
      {rows.length === 0 ? <p className="muted">In dieser AG ist noch niemand registriert.</p> : (
        <>
          <p className="faint">
            {present} von {rows.length} als anwesend vermerkt. „auto“ heißt: Das Gerät war während der Live-Sitzung verbunden. Du kannst jeden Eintrag ändern.
          </p>
          <div className="att-grid">
            {rows.map((r) => (
              <div className="att-row" key={r.user_id}>
                <span>
                  <b>{r.pseudonym}</b>
                  {r.source === "auto" && <span className="faint"> · auto</span>}
                  {r.disabled && <span className="faint"> · pausiert</span>}
                </span>
                <span className="opts" role="radiogroup" aria-label={`Anwesenheit ${r.pseudonym}`}>
                  {OPTS.map(([v, l, c]) => (
                    <label className={c} key={v}>
                      <input type="radio" name={`att:${r.user_id}`} value={v} defaultChecked={r.status === v} />
                      <span>{l}</span>
                    </label>
                  ))}
                </span>
              </div>
            ))}
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" name="rest_absent" /> Alle ohne Eintrag als „fehlt“ speichern
          </label>
        </>
      )}
      <div className="field">
        <label htmlFor={`proto-${sessionId}`}>Protokoll für die Dokumentation</label>
        <textarea id={`proto-${sessionId}`} name="protocol" rows={4} defaultValue={protocol} maxLength={5000}
          placeholder="Was haben wir geschafft? Was fiel aus, was war besonders?" />
      </div>
      <div><SubmitButton className="btn" pending="Speichert">Anwesenheit und Protokoll speichern</SubmitButton></div>
    </form>
  );
}
