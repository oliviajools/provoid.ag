"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export function Chat({ id, limit, used }: { id: string; limit: number; used: number }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rest, setRest] = useState(Math.max(0, limit - used));
  const ende = useRef<HTMLDivElement>(null);

  useEffect(() => { ende.current?.scrollIntoView({ block: "nearest" }); }, [msgs]);

  async function senden(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setError("");
    const verlauf: Msg[] = [...msgs, { role: "user", content: t }];
    setMsgs([...verlauf, { role: "assistant", content: "" }]);
    setText("");
    setBusy(true);
    try {
      const res = await fetch(`/api/denkpartner/${id}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: verlauf }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Das hat nicht geklappt. Versuch es gleich noch einmal.");
      }
      const r = res.headers.get("x-remaining");
      if (r !== null) setRest(Number(r));
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMsgs([...verlauf, { role: "assistant", content: acc }]);
      }
      if (!acc.trim()) throw new Error("Keine Antwort bekommen. Versuch es gleich noch einmal.");
    } catch (err) {
      setMsgs(verlauf.slice(0, -1));
      setText(t);
      setError(err instanceof Error ? err.message : "Das hat nicht geklappt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card dp-chat">
      <div className="dp-verlauf" aria-live="polite">
        {msgs.length === 0 && (
          <p className="faint">Schreib deine erste Nachricht, zum Beispiel eine Aufgabe aus einer alten Klausur. Keine Namen und keine persönlichen Daten.</p>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`dp-msg ${m.role === "user" ? "ich" : "ki"}`}>
            {m.content || (busy && i === msgs.length - 1 ? <span className="faint">denkt nach …</span> : "")}
          </div>
        ))}
        <div ref={ende} />
      </div>
      {error && <div className="alert error" role="alert" style={{ margin: "0 18px" }}>{error}</div>}
      <form onSubmit={senden} className="dp-eingabe">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={4000}
          placeholder="Deine Nachricht …" aria-label="Deine Nachricht"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.currentTarget.form as HTMLFormElement).requestSubmit(); } }} />
        <div className="dp-eingabe-fuss">
          <span className="faint">Noch {rest} Nachrichten diese Woche</span>
          <div style={{ display: "flex", gap: 8 }}>
            {msgs.length > 0 && <button type="button" className="btn ghost small" onClick={() => { setMsgs([]); setError(""); }} disabled={busy}>Neues Gespräch</button>}
            <button type="submit" className="btn small" disabled={busy || !text.trim() || rest <= 0}>{busy ? "…" : "Senden"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
