"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveNote } from "./actions";

type State = "idle" | "dirty" | "saving" | "saved" | "error";

export function NotesEditor({ sessionId, initial, updated }: { sessionId: string; initial: string; updated: string | null }) {
  const [text, setText] = useState(initial);
  const [state, setState] = useState<State>("idle");
  const [at, setAt] = useState<string | null>(updated);
  const last = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async (value: string) => {
    if (value === last.current) { setState((s) => (s === "dirty" ? "saved" : s)); return; }
    setState("saving");
    try {
      const r = await saveNote(sessionId, value);
      if (!r.ok) throw new Error(r.error);
      last.current = value;
      setAt(r.at ?? null);
      setState("saved");
    } catch {
      setState("error");
    }
  }, [sessionId]);

  useEffect(() => {
    if (text === last.current) return;
    setState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(text), 1200);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [text, save]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (text !== last.current) { e.preventDefault(); } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [text]);

  const label =
    state === "saving" ? "Wird gespeichert …" :
    state === "dirty" ? "Nicht gespeichert" :
    state === "error" ? "Speichern fehlgeschlagen. Bitte Verbindung prüfen." :
    at ? `Gespeichert um ${at}` : "Wird automatisch gespeichert";

  return (
    <div className="stack" style={{ gap: 8 }}>
      <label htmlFor="note" className="sr-only">Meine Notizen</label>
      <textarea id="note" value={text} maxLength={30000} onChange={(e) => setText(e.target.value)} onBlur={() => save(text)}
        placeholder={"Was hast du heute gelernt?\nWas willst du nachschauen?\nWelche Idee willst du nicht vergessen?"} />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <span className={`save-state${state === "saved" ? " saved" : ""}`} aria-live="polite" style={state === "error" ? { color: "var(--danger)" } : undefined}>{label}</span>
        <span className="faint">{text.length.toLocaleString("de-DE")} Zeichen</span>
      </div>
    </div>
  );
}
