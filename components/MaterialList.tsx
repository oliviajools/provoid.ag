import { ALLOWED_MIME, formatSize } from "@/lib/sessions";
import { materialAction, renameMaterial } from "@/app/coach/sitzungen/actions";

export type Material = {
  id: string; kind: "file" | "link" | "text"; title: string; url: string; body: string;
  filename: string; mime: string; size: number; complete: boolean;
};

/** Macht Links in einfachem Text klickbar, ohne HTML zu erlauben. */
export function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>"]+)/g);
  return <>{parts.map((p, i) => (/^https?:\/\//.test(p) ? <a key={i} href={p} target="_blank" rel="noreferrer">{p}</a> : p))}</>;
}

function badge(m: Material) {
  if (m.kind === "link") return "Link";
  if (m.kind === "text") return "Text";
  const ext = m.filename.split(".").pop()?.slice(0, 4) ?? "";
  return ext || (ALLOWED_MIME[m.mime] ?? "Datei");
}

export function MaterialList({ items, coach = false }: { items: Material[]; coach?: boolean }) {
  const visible = coach ? items : items.filter((m) => m.complete);
  if (visible.length === 0) {
    return <p className="muted">{coach ? "Noch kein Material. Lade unten Dateien hoch oder füg Links und Texte hinzu." : "Für diese Sitzung gibt es noch kein Material."}</p>;
  }
  return (
    <div className="materials">
      {visible.map((m, i) => (
        <article className="mat" key={m.id}>
          <span className="ico" aria-hidden="true">{badge(m)}</span>
          <div className="stack" style={{ gap: 2, minWidth: 0 }}>
            {m.kind === "file" && (
              <>
                <a className="mt" href={`/api/material/${m.id}`} target="_blank" rel="noreferrer">{m.title || m.filename}</a>
                <span className="md">{ALLOWED_MIME[m.mime] ?? "Datei"} · {formatSize(Number(m.size))}{!m.complete && " · Upload unvollständig"}
                  {m.complete && <> · <a href={`/api/material/${m.id}?download=1`}>herunterladen</a></>}</span>
              </>
            )}
            {m.kind === "link" && (
              <>
                <a className="mt" href={m.url} target="_blank" rel="noreferrer">{m.title}</a>
                <span className="md" style={{ wordBreak: "break-all" }}>{m.url}</span>
                {m.body && <p className="mbody"><Linkify text={m.body} /></p>}
              </>
            )}
            {m.kind === "text" && (
              <>
                <span className="mt">{m.title}</span>
                <p className="mbody"><Linkify text={m.body} /></p>
              </>
            )}
            {coach && (
              <details style={{ marginTop: 6 }}>
                <summary className="faint" style={{ cursor: "pointer" }}>Titel ändern</summary>
                <form action={renameMaterial} className="qactions" style={{ marginTop: 6 }}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="text" name="title" defaultValue={m.title} aria-label="Titel" style={{ maxWidth: 320, padding: "6px 10px", fontSize: 14 }} />
                  <button className="btn ghost small" type="submit">Speichern</button>
                </form>
              </details>
            )}
          </div>
          {coach && (
            <div className="mat-actions">
              {(["up", "down", "delete"] as const).map((op) => (
                (op === "up" && i === 0) || (op === "down" && i === visible.length - 1) ? null : (
                  <form action={materialAction} key={op}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="op" value={op} />
                    <button className="btn ghost small" type="submit" aria-label={op === "up" ? "Nach oben" : op === "down" ? "Nach unten" : "Löschen"}>
                      {op === "up" ? "↑" : op === "down" ? "↓" : "Löschen"}
                    </button>
                  </form>
                )
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
