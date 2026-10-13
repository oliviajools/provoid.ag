"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { insertTemplate, saveLiveItem, type LiveActState } from "./live-actions";

function Msg({ s }: { s: LiveActState }) {
  if (!s) return null;
  return s.error ? <div className="alert error" role="alert">{s.error}</div> : <div className="alert ok" role="status">{s.ok}</div>;
}

export type ItemDraft = {
  id?: string; title: string; kind: "grid" | "wall" | "text";
  slide: number | null; until_slide: number | null; reveal_slide: number | null;
  rows: string[]; options: string[]; solution: (number | null)[] | null; private: boolean; homework: boolean;
};

const EMPTY: ItemDraft = { title: "", kind: "grid", slide: null, until_slide: null, reveal_slide: null, rows: [], options: [], solution: null, private: false, homework: false };

const ROWS_LABEL = { grid: "Fragen oder Aussagen (eine pro Zeile)", wall: "Spalten der Pinnwand (eine pro Zeile, leer = eine Spalte)", text: "Fragen (eine pro Zeile)" };

export function LiveItemForm({ sessionId, item }: { sessionId: string; item?: ItemDraft }) {
  const it = item ?? EMPTY;
  const [s, a] = useActionState(saveLiveItem, undefined);
  const [kind, setKind] = useState(it.kind);
  const p = it.id ? `e${it.id.slice(0, 6)}` : "new";
  return (
    <form action={a} className="stack" style={{ gap: 14 }}>
      <Msg s={s} />
      <input type="hidden" name="session_id" value={sessionId} />
      {it.id && <input type="hidden" name="id" value={it.id} />}
      <div className="grid-form" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <div className="field"><label htmlFor={`${p}-title`}>Titel</label><input id={`${p}-title`} name="title" type="text" defaultValue={it.title} maxLength={160} placeholder="z. B. Ratespiel: KI oder keine KI?" /></div>
        <div className="field"><label htmlFor={`${p}-kind`}>Art</label>
          <select id={`${p}-kind`} name="kind" className="select" value={kind} onChange={(e) => setKind(e.target.value as ItemDraft["kind"])}>
            <option value="grid">Abstimmung (auch mehrere Aussagen)</option>
            <option value="wall">Pinnwand (freie Zettel)</option>
            <option value="text">Fragen mit Textantwort</option>
          </select></div>
      </div>
      <div className="grid-form" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <div className="field"><label htmlFor={`${p}-slide`}>Startet auf Folie</label><input id={`${p}-slide`} name="slide" type="text" inputMode="numeric" defaultValue={it.slide ?? ""} /></div>
        <div className="field"><label htmlFor={`${p}-until`}>Offen bis Folie <span className="faint">(optional)</span></label><input id={`${p}-until`} name="until_slide" type="text" inputMode="numeric" defaultValue={it.until_slide ?? ""} /></div>
        <div className="field"><label htmlFor={`${p}-reveal`}>Auflösung auf Folie <span className="faint">(optional)</span></label><input id={`${p}-reveal`} name="reveal_slide" type="text" inputMode="numeric" defaultValue={it.reveal_slide ?? ""} /></div>
      </div>
      <div className="grid-form" style={{ gridTemplateColumns: kind === "grid" ? "2fr 1fr 1fr" : "1fr" }}>
        <div className="field"><label htmlFor={`${p}-rows`}>{ROWS_LABEL[kind]}</label>
          <textarea id={`${p}-rows`} name="rows" rows={Math.max(3, Math.min(9, it.rows.length + 1))} defaultValue={it.rows.join("\n")} /></div>
        {kind === "grid" && <>
          <div className="field"><label htmlFor={`${p}-opts`}>Antworten (eine pro Zeile)</label>
            <textarea id={`${p}-opts`} name="options" rows={4} defaultValue={it.options.join("\n") || "Ja\nNein"} /></div>
          <div className="field"><label htmlFor={`${p}-sol`}>Lösung <span className="faint">(optional, je Zeile)</span></label>
            <textarea id={`${p}-sol`} name="solution" rows={4} defaultValue={it.solution ? it.solution.map((i) => (i === null ? "" : it.options[i] ?? "")).join("\n") : ""} /></div>
        </>}
      </div>
      <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
        <label className="check"><input type="checkbox" name="private" defaultChecked={it.private} /><span>Antworten nur für mich, nicht auf der Tafel</span></label>
        <label className="check"><input type="checkbox" name="homework" defaultChecked={it.homework} /><span>Hausaufgabe: bleibt auf der Sitzungsseite offen, bis ich sie schließe</span></label>
      </div>
      <div><SubmitButton className="btn" pending="Speichert">{it.id ? "Speichern" : "Interaktion anlegen"}</SubmitButton></div>
    </form>
  );
}

export function TemplateForm({ sessionId, templates }: { sessionId: string; templates: { id: string; label: string }[] }) {
  const [s, a] = useActionState(insertTemplate, undefined);
  return (
    <form action={a} className="stack" style={{ gap: 12 }}>
      <Msg s={s} />
      <input type="hidden" name="session_id" value={sessionId} />
      <div className="grid-form" style={{ gridTemplateColumns: "1fr auto" }}>
        <div className="field"><label htmlFor="tpl">Vorlage</label>
          <select id="tpl" name="template" className="select">{templates.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
        <SubmitButton className="btn ghost" pending="…">Einfügen</SubmitButton>
      </div>
    </form>
  );
}

export function DeckUpload({ sessionId, has }: { sessionId: string; has: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function upload() {
    const f = ref.current?.files?.[0];
    if (!f) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/deck/${sessionId}?name=${encodeURIComponent(f.name)}`, { method: "POST", body: await f.text(), headers: { "content-type": "text/html" } });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ error: d.error ?? "Hochladen hat nicht geklappt." });
      else setMsg({ ok: d.slides ? `Foliensatz mit ${d.slides} Folien gespeichert.` : "Gespeichert, aber keine Folien erkannt. Die Kopplung braucht einen HTML-Export aus Claude Slides." });
      router.refresh();
    } finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  }
  async function remove() {
    if (!confirm("Foliensatz entfernen? Die Interaktionen bleiben erhalten.")) return;
    await fetch(`/api/deck/${sessionId}`, { method: "DELETE" });
    router.refresh();
  }
  return (
    <div className="stack" style={{ gap: 12 }}>
      {msg && <div className={`alert ${msg.error ? "error" : "ok"}`} role="status">{msg.error ?? msg.ok}</div>}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input ref={ref} type="file" accept=".html,.htm,text/html" onChange={upload} disabled={busy} aria-label="Foliensatz als HTML hochladen" />
        {busy && <span className="faint">Lädt hoch …</span>}
        {has && <button type="button" className="linkish" onClick={remove}>Foliensatz entfernen</button>}
      </div>
    </div>
  );
}
