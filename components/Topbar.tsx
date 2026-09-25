import Image from "next/image";
import Link from "next/link";
import { logout } from "@/app/actions";

export function Topbar({ pseudonym, home = "/", label = "KI-AG" }: { pseudonym?: string; home?: string; label?: string }) {
  return (
    <header className="topbar">
      <div className="container">
        <Link href={home} className="brand" aria-label="Zur Startseite">
          <Image src="/brain.png" alt="" width={38} height={38} priority />
          <b>PROVOID</b>
          <small>{label}</small>
        </Link>
        {pseudonym && (
          <div className="userbox">
            <span className="who">Eingeloggt als <b style={{ color: "var(--text)" }}>{pseudonym}</b></span>
            <form action={logout}>
              <button className="btn ghost" type="submit">Abmelden</button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
