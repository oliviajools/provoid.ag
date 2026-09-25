import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { Topbar } from "@/components/Topbar";
import { LoginForm } from "@/components/AuthForms";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getUser();
  if (user) redirect(user.role === "coach" ? "/coach" : "/start");

  return (
    <>
      <Topbar />
      <main>
        <div className="container auth">
          <section className="intro">
            <div className="tags">
              <span className="tag">Neuroscience-Startup · Hamburg</span>
              <span className="tag outline">KI-AG</span>
            </div>
            <h1>Bau mit KI, was du dir vorstellen kannst.</h1>
            <p className="lead">
              Deine Plattform für die KI-AG: Finde dein eigenes Ziel, hol dir jede Woche die wichtigsten KI-News,
              bring selbst Quellen ein und bau am Ende ein Projekt, das du dir selbst aussuchst.
            </p>
            <p className="claim">NO BRAIN. <span>NO GAIN.</span></p>
          </section>

          <div className="stack" style={{ gap: 16 }}>
            <section className="card" aria-labelledby="login-title">
              <header><h3 id="login-title">Einloggen</h3></header>
              <LoginForm />
            </section>
            <p className="faint" style={{ textAlign: "right" }}>
              <Link href="/coach/login" style={{ color: "var(--faint)" }}>Login für Coaches</Link>
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
