"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Now = { sessionId: string; number: number; itemId: string | null; title: string | null; mode: "open" | "reveal" | null } | null;

/**
 * Läuft auf jeder Seite der Teilnehmenden mit. Sobald in der Präsentation eine neue Aufgabe
 * startet, springt das Gerät von selbst zur Sitzung. Auf der Sitzungsseite übernimmt das LivePanel.
 */
export function LiveWatcher() {
  const router = useRouter();
  const path = usePathname();
  const [toast, setToast] = useState<string | null>(null);
  const seen = useRef<{ session?: string; item?: string | null }>({});
  const pathRef = useRef(path);
  pathRef.current = path;

  useEffect(() => {
    try {
      seen.current = JSON.parse(sessionStorage.getItem("ag-live-seen") ?? "{}");
      const t = sessionStorage.getItem("ag-live-toast");
      if (t) { sessionStorage.removeItem("ag-live-toast"); setToast(t); window.setTimeout(() => setToast(null), 4000); }
    } catch { /* egal */ }
    let alive = true, timer: number | undefined;
    async function check() {
      try {
        const r = await fetch("/api/live/now", { cache: "no-store" });
        if (!r.ok) return;
        const { live } = (await r.json()) as { live: Now };
        if (!live) return;
        const target = `/sitzungen/${live.sessionId}`;
        const onTarget = pathRef.current === target;
        const newSession = seen.current.session !== live.sessionId;
        const newItem = !!live.itemId && seen.current.item !== live.itemId;
        if (newSession || newItem) {
          seen.current = { session: live.sessionId, item: live.itemId ?? seen.current.item };
          try { sessionStorage.setItem("ag-live-seen", JSON.stringify(seen.current)); } catch { /* egal */ }
          if (!onTarget) {
            try { sessionStorage.setItem("ag-live-toast", live.title ? `Neue Aufgabe: ${live.title}` : `Sitzung ${live.number} läuft`); } catch { /* egal */ }
            router.push(target);
          }
        }
      } catch { /* nächster Versuch */ }
    }
    function loop() {
      check().finally(() => {
        if (!alive) return;
        timer = window.setTimeout(loop, document.hidden ? 15000 : 3000);
      });
    }
    loop();
    const onVis = () => { if (!document.hidden) check(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; window.clearTimeout(timer); document.removeEventListener("visibilitychange", onVis); };
  }, [router]);

  if (!toast) return null;
  return <div className="live-toast" role="status"><span className="dot" aria-hidden="true" />{toast}</div>;
}
