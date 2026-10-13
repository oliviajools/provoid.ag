"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LiveResults, type BoardActive, type BoardResult } from "@/components/LiveResults";

type Board = { slide: number | null; stored: number | null; online: number; published: boolean; active: BoardActive | null; result?: BoardResult };

export function Presenter({ sessionId, number, title, published }: { sessionId: string; number: number; title: string; published: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slide, setSlide] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [board, setBoard] = useState<Board | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [bar, setBar] = useState(true);
  const [stopped, setStopped] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const idle = useRef<number | undefined>(undefined);

  // Foliensatz laden
  useEffect(() => {
    fetch(`/api/deck/${sessionId}`).then(async (r) => {
      if (!r.ok) throw new Error();
      setHtml(await r.text());
    }).catch(() => setError("Der Foliensatz konnte nicht geladen werden."));
  }, [sessionId]);

  const focusDeck = () => window.setTimeout(() => frame.current?.contentWindow?.focus(), 0);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
    focusDeck();
  }, []);

  const onKey = useCallback((k: string) => {
    if (k === "e") setShowResults((v) => !v);
    if (k === "f") toggleFullscreen();
  }, [toggleFullscreen]);

  // Nachrichten aus dem Foliensatz
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!frame.current || e.source !== frame.current.contentWindow || !e.data) return;
      if (e.data.type === "provoid-deck") {
        setSlide(Number(e.data.slide) || 1);
        setTotal(Number(e.data.total) || 0);
      }
      if (e.data.type === "provoid-key") onKey(String(e.data.key));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onKey]);

  // Tasten, wenn die Steuerleiste den Fokus hat
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "e" || e.key === "E") { e.preventDefault(); onKey("e"); }
      if (e.key === "f" || e.key === "F") { e.preventDefault(); onKey("f"); }
      if (["ArrowRight", "ArrowLeft", "PageDown", "PageUp", " "].includes(e.key) && slide !== null) {
        e.preventDefault();
        const next = e.key === "ArrowLeft" || e.key === "PageUp" ? slide - 1 : slide + 1;
        if (next >= 1 && (!total || next <= total)) frame.current?.contentWindow?.postMessage({ type: "provoid-goto", slide: next }, "*");
        focusDeck();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKey, slide, total]);

  // Aktuelle Folie an die Plattform melden (mit Wiederholung, falls die Verbindung hakt)
  useEffect(() => {
    if (slide === null || stopped) return;
    let alive = true;
    let retry: number | undefined;
    async function post() {
      try {
        const r = await fetch(`/api/live/${sessionId}/slide`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slide }) });
        if (!alive) return;
        if (r.ok) { setSyncError(null); return; }
        const d = await r.json().catch(() => ({}));
        setSyncError(`${d.error ?? "Fehler"} (${r.status})`);
      } catch {
        if (alive) setSyncError("Keine Internetverbindung");
      }
      if (alive) retry = window.setTimeout(post, 3000);
    }
    const t = window.setTimeout(post, 100);
    const keep = window.setInterval(post, 60 * 1000);
    return () => { alive = false; window.clearTimeout(t); window.clearTimeout(retry); window.clearInterval(keep); };
  }, [slide, sessionId, stopped]);

  // Ergebnisse der aktuellen Interaktion abfragen
  useEffect(() => {
    if (slide === null) return;
    let alive = true;
    async function load() {
      try {
        const r = await fetch(`/api/live/${sessionId}/board?slide=${slide}`, { cache: "no-store" });
        if (!r.ok && alive) setSyncError(`Ergebnisse nicht abrufbar (${r.status})`);
        if (r.ok && alive) setBoard(await r.json());
      } catch { /* nächster Versuch */ }
    }
    load();
    const t = window.setInterval(load, 2000);
    return () => { alive = false; window.clearInterval(t); };
  }, [slide, sessionId]);

  // Ergebnisse automatisch auf Auflösungsfolien, sonst beim Folienwechsel schließen
  useEffect(() => { setShowResults(false); }, [slide]);
  useEffect(() => { if (board?.active?.mode === "reveal" && board.slide === slide) setShowResults(true); }, [board?.active?.id, board?.active?.mode, board?.slide, slide]);

  function wake() {
    setBar(true);
    window.clearTimeout(idle.current);
    idle.current = window.setTimeout(() => setBar(false), 2500);
  }
  useEffect(() => { wake(); return () => window.clearTimeout(idle.current); }, []);

  async function stop() {
    setStopped(true);
    await fetch(`/api/live/${sessionId}/slide`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slide: null }) }).catch(() => {});
  }

  const active = board?.active ?? null;
  const problem = stopped ? null
    : syncError ? `Tablets bekommen die Folie nicht: ${syncError}`
    : board && !board.published ? "Sitzung ist nicht veröffentlicht: Die Tablets sehen nichts." : null;
  const count = board?.result ? (board.result.kind === "wall" ? board.result.entries.length : board.result.respondents) : 0;
  const countLabel = board?.result?.kind === "wall" ? (count === 1 ? "Zettel" : "Zettel") : count === 1 ? "Antwort" : "Antworten";

  return (
    <div className="presenter" onMouseMove={wake}>
      {error && <div className="presenter-msg">{error} <Link href={`/coach/sitzungen/${sessionId}#live`}>Zurück</Link></div>}
      {!html && !error && <div className="presenter-msg">Foliensatz wird geladen …</div>}
      {html && (
        <iframe
          ref={frame}
          className="presenter-deck"
          title={`Folien Sitzung ${number}`}
          sandbox="allow-scripts"
          srcDoc={html}
          onLoad={focusDeck}
        />
      )}

      {problem && <div className="presenter-problem" role="alert">{problem}</div>}

      {active && !stopped && (
        <button type="button" className="presenter-badge" onClick={() => { setShowResults((v) => !v); focusDeck(); }}>
          <span className="dot" aria-hidden="true" />
          <span><b>{active.mode === "reveal" ? "Auflösung" : "Jetzt mitmachen"}</b> · ag.provoid.de › Sitzung {number}</span>
          <span className="n">{count} {countLabel}</span>
          {board && <span className="faint">{board.online} {board.online === 1 ? "Gerät" : "Geräte"} verbunden</span>}
        </button>
      )}

      {showResults && active && board?.result && (
        <div className="presenter-results" onClick={() => { setShowResults(false); focusDeck(); }}>
          <div className="inner" onClick={(e) => e.stopPropagation()}>
            <LiveResults active={active} result={board.result} big />
            <p className="faint" style={{ marginTop: 18 }}>E oder Klick daneben schließt die Ergebnisse.</p>
          </div>
        </div>
      )}

      <div className={`presenter-bar${bar ? " on" : ""}`}>
        <span className="faint">Sitzung {number}{title ? `: ${title}` : ""}</span>
        <span className="chip">{slide ?? "?"} / {total || "?"}</span>
        {!published && <span className="chip mine">nicht veröffentlicht</span>}
        {stopped ? <span className="chip">live beendet</span> : <span className="chip live">live</span>}
        {board && <span className={`chip${board.online ? " live" : ""}`}>{board.online} {board.online === 1 ? "Gerät" : "Geräte"} verbunden</span>}
        <span style={{ flex: 1 }} />
        <button type="button" className="btn ghost small" onClick={() => { setShowResults((v) => !v); focusDeck(); }} disabled={!active}>Ergebnisse (E)</button>
        <button type="button" className="btn ghost small" onClick={toggleFullscreen}>Vollbild (F)</button>
        {!stopped && <button type="button" className="btn ghost small" onClick={stop}>Live beenden</button>}
        <Link className="btn ghost small" href={`/coach/sitzungen/${sessionId}#live`}>Schließen</Link>
      </div>
    </div>
  );
}
