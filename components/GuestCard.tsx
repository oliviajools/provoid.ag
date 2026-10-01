import Link from "next/link";
import type { Guest } from "@/lib/guests";
import { Linkify } from "./MaterialList";

export function GuestCard({ g, next = false, children, sessionHref }: { g: Guest; next?: boolean; children?: React.ReactNode; sessionHref?: string }) {
  return (
    <article className={`guest${next ? " next" : ""}`} id={`gast-${g.id}`}>
      <div className="when" aria-label={g.date_iso ? `Am ${g.weekday} ${g.day}. ${g.month}` : "Termin folgt"}>
        {g.date_iso ? (
          <>
            <span className="m">{g.weekday}</span>
            <span className="d">{g.day}</span>
            <span className="m">{g.month}</span>
            {g.time_label && <span className="t">{g.time_label}</span>}
          </>
        ) : <span className="m">Termin folgt</span>}
      </div>
      <div className="stack" style={{ gap: 10, minWidth: 0 }}>
        <div className="tags">
          {next && <span className="tag outline">Nächster Gast</span>}
          {g.session_number != null && (sessionHref
            ? <Link className="tag" href={sessionHref} style={{ textDecoration: "none" }}>Sitzung {g.session_number}{g.session_title ? `: ${g.session_title}` : ""}</Link>
            : <span className="tag">Sitzung {g.session_number}</span>)}
        </div>
        <h2>{g.name}</h2>
        {g.role && <p className="role">{g.role}</p>}
        {g.topic && <p style={{ fontSize: 18, color: "var(--text)" }}><b>Thema:</b> {g.topic}</p>}
        {g.bio && <p className="bio"><Linkify text={g.bio} /></p>}
        {g.link && <a href={g.link} target="_blank" rel="noreferrer">Mehr erfahren</a>}
        {children}
      </div>
    </article>
  );
}
