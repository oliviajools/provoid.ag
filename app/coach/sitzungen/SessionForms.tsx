"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { addLink, addText, createSeries, createSession, deleteSession, updateSession, type ActState } from "./actions";

function Msg({ s }: { s: ActState }) {
  if (!s) return null;
  return s.error ? <div className="alert error" role="alert">{s.error}</div> : <div className="alert ok" role="status">{s.ok}</div>;
}

const PHASE_OPTIONS = [["", "ohne Phase"], ["durchschauen", "Durchschauen"], ["einordnen", "Einordnen"], ["bauen", "Bauen"]];

export function NewSessionForm({ groupId }: { groupId: string }) {
  const [s, a] = useActionState(createSession, undefined);
  return (
    <form action={a} className="stack" style={{ gap: 12 }}>
      <Msg s={s} />
      <input type="hidden" name="group_id" value={groupId} />
      <div className="grid-form" style={{ gridTemplateColumns: "2fr 1fr 1fr auto" }}>
        <div className="field"><label htmlFor="n-title">Titel</label><input id="n-title" name="title" type="text" placeholder="z. B. Wie denkt ein Sprachmodell?" /></div>
        <div className="field"><label htmlFor="n-date">Datum</label><input id="n-date" name="date" type="date" /></div>
        <div className="field"><label htmlFor="n-phase">Phase</label>
          <select id="n-phase" name="phase" className="select">{PHASE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <SubmitButton className="btn" pending="…">Anlegen</SubmitButton>
      </div>
    </form>
  );
}

export function SeriesForm({ groupId, defaultFirst }: { groupId: string; defaultFirst: string }) {
  const [s, a] = useActionState(createSeries, undefined);
  return (
    <form action={a} className="stack" style={{ gap: 12 }}>
      <Msg s={s} />
      <input type="hidden" name="group_id" value={groupId} />
      <div className="grid-form" style={{ gridTemplateColumns: "1fr 1fr 1fr auto" }}>
        <div className="field"><label htmlFor="s-first">Erste Sitzung</label><input id="s-first" name="first" type="date" defaultValue={defaultFirst} /></div>
        <div className="field"><label htmlFor="s-count">Anzahl</label><input id="s-count" name="count" type="text" inputMode="numeric" defaultValue="20" /></div>
        <div className="field"><label htmlFor="s-every">Abstand in Tagen</label><input id="s-every" name="every" type="text" inputMode="numeric" defaultValue="7" /></div>
        <SubmitButton className="btn ghost" pending="…">Serie anlegen</SubmitButton>
      </div>
    </form>
  );
}

export function EditSessionForm({ s: sess }: { s: { id: string; number: number; title: string; date_iso: string | null; phase: string | null; summary: string } }) {
  const [s, a] = useActionState(updateSession, undefined);
  return (
    <form action={a} className="body">
      <Msg s={s} />
      <input type="hidden" name="id" value={sess.id} />
      <div className="grid-form" style={{ gridTemplateColumns: "90px 2fr 1fr 1fr" }}>
        <div className="field"><label htmlFor="e-num">Nr.</label><input id="e-num" name="number" type="text" inputMode="numeric" defaultValue={sess.number} /></div>
        <div className="field"><label htmlFor="e-title">Titel</label><input id="e-title" name="title" type="text" defaultValue={sess.title} maxLength={160} /></div>
        <div className="field"><label htmlFor="e-date">Datum</label><input id="e-date" name="date" type="date" defaultValue={sess.date_iso ?? ""} /></div>
        <div className="field"><label htmlFor="e-phase">Phase</label>
          <select id="e-phase" name="phase" className="select" defaultValue={sess.phase ?? ""}>{PHASE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      </div>
      <div className="field">
        <label htmlFor="e-sum">Worum geht es? (sehen die Teilnehmenden)</label>
        <textarea id="e-sum" name="summary" rows={4} maxLength={4000} defaultValue={sess.summary}
          placeholder="Ein paar Sätze zum Inhalt, zu den Zielen oder zur Vorbereitung auf die nächste Sitzung." />
      </div>
      <div><SubmitButton className="btn" pending="Speichert">Speichern</SubmitButton></div>
    </form>
  );
}

export function DeleteSession({ id }: { id: string }) {
  const [armed, setArmed] = useState(false);
  if (!armed) return <button type="button" className="btn ghost small" onClick={() => setArmed(true)}>Sitzung löschen</button>;
  return (
    <form action={deleteSession} className="qactions">
      <input type="hidden" name="id" value={id} />
      <span className="faint" style={{ color: "var(--danger)" }}>Mit allem Material und allen Notizen der Teilnehmenden?</span>
      <button className="btn small" type="submit">Ja, löschen</button>
      <button type="button" className="linkish" onClick={() => setArmed(false)}>Abbrechen</button>
    </form>
  );
}

type Job = { name: string; progress: number; error?: string; done?: boolean };

export function Uploader({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [drag, setDrag] = useState(false);
  const busy = jobs.some((j) => !j.done && !j.error);

  const update = (i: number, patch: Partial<Job>) => setJobs((js) => js.map((j, k) => (k === i ? { ...j, ...patch } : j)));

  async function uploadAll(files: FileList | File[]) {
    const list = Array.from(files);
    const offset = jobs.length;
    setJobs((js) => [...js, ...list.map((f) => ({ name: f.name, progress: 0 }))]);
    for (let n = 0; n < list.length; n++) {
      const f = list[n];
      const i = offset + n;
      try {
        const init = await fetch("/api/material/upload?step=init", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId, filename: f.name, mime: f.type || guessMime(f.name), size: f.size }),
        });
        const ij = await init.json();
        if (!init.ok) throw new Error(ij.error ?? "Upload nicht möglich.");
        const chunk: number = ij.chunkBytes;
        const parts = Math.ceil(f.size / chunk);
        for (let p = 0; p < parts; p++) {
          const blob = f.slice(p * chunk, Math.min(f.size, (p + 1) * chunk));
          let ok = false;
          for (let attempt = 0; attempt < 3 && !ok; attempt++) {
            const r = await fetch(`/api/material/upload?step=chunk&id=${ij.id}&idx=${p}`, { method: "POST", body: blob });
            ok = r.ok;
          }
          if (!ok) {
            await fetch(`/api/material/upload?step=abort&id=${ij.id}`, { method: "POST" });
            throw new Error("Die Verbindung ist abgebrochen. Bitte nochmal versuchen.");
          }
          update(i, { progress: (p + 1) / parts });
        }
        const done = await fetch(`/api/material/upload?step=done&id=${ij.id}`, { method: "POST" });
        if (!done.ok) throw new Error((await done.json()).error ?? "Upload unvollständig.");
        update(i, { done: true, progress: 1 });
      } catch (e) {
        update(i, { error: e instanceof Error ? e.message : "Fehler beim Hochladen." });
      }
    }
    router.refresh();
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div
        className={`dropzone${drag ? " over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) uploadAll(e.dataTransfer.files); }}
      >
        <p><b>Dateien hierher ziehen</b> oder</p>
        <button type="button" className="btn ghost small" onClick={() => input.current?.click()} disabled={busy}>Dateien auswählen</button>
        <p className="faint">PDF, PowerPoint, Word, Excel, Bilder, Audio, Video · bis 50 MB pro Datei</p>
        <input ref={input} type="file" multiple hidden onChange={(e) => { if (e.target.files?.length) uploadAll(e.target.files); e.target.value = ""; }} />
      </div>
      {jobs.map((j, i) => (
        <div className="upjob" key={i}>
          <div className="top"><span>{j.name}</span><span className="faint">{j.error ? "Fehler" : j.done ? "Fertig" : `${Math.round(j.progress * 100)} %`}</span></div>
          {!j.error && <div className="bar-track"><div className="bar-fill" style={{ width: `${j.progress * 100}%` }} /></div>}
          {j.error && <p className="faint" style={{ color: "var(--danger)" }}>{j.error}</p>}
        </div>
      ))}
    </div>
  );
}

function guessMime(name: string) {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return ({ pdf: "application/pdf", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    md: "text/markdown", txt: "text/plain", csv: "text/csv", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", mp3: "audio/mpeg", mp4: "video/mp4",
    key: "", zip: "application/zip" } as Record<string, string>)[ext] ?? "";
}

export function LinkForm({ sessionId }: { sessionId: string }) {
  const [s, a] = useActionState(addLink, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (s?.ok) ref.current?.reset(); }, [s]);
  return (
    <form action={a} ref={ref} className="stack" style={{ gap: 10 }}>
      <Msg s={s} />
      <input type="hidden" name="session_id" value={sessionId} />
      <div className="grid-form" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <div className="field"><label htmlFor="l-url">Link</label><input id="l-url" name="url" type="text" placeholder="https://… (Video, Artikel, Tool)" /></div>
        <div className="field"><label htmlFor="l-title">Titel</label><input id="l-title" name="title" type="text" placeholder="z. B. 3Blue1Brown: Transformer erklärt" /></div>
      </div>
      <div className="field"><label htmlFor="l-body">Kurzer Hinweis (freiwillig)</label><input id="l-body" name="body" type="text" maxLength={1000} placeholder="z. B. Schau ab Minute 4, Untertitel auf Deutsch einstellen" /></div>
      <div><SubmitButton className="btn ghost" pending="…">Link hinzufügen</SubmitButton></div>
    </form>
  );
}

export function TextForm({ sessionId }: { sessionId: string }) {
  const [s, a] = useActionState(addText, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (s?.ok) ref.current?.reset(); }, [s]);
  return (
    <form action={a} ref={ref} className="stack" style={{ gap: 10 }}>
      <Msg s={s} />
      <input type="hidden" name="session_id" value={sessionId} />
      <div className="field"><label htmlFor="t-title">Überschrift</label><input id="t-title" name="title" type="text" placeholder="z. B. Aufgabe bis nächste Woche" /></div>
      <div className="field"><label htmlFor="t-body">Text</label><textarea id="t-body" name="body" rows={5} maxLength={20000} placeholder="Absätze durch Leerzeilen trennen. Links werden automatisch klickbar." /></div>
      <div><SubmitButton className="btn ghost" pending="…">Text hinzufügen</SubmitButton></div>
    </form>
  );
}
