import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { Topbar } from "@/components/Topbar";
import { RegisterForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "Zugang anlegen" };
export const dynamic = "force-dynamic";

export default async function Register({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  if (await getUser()) redirect("/start");
  const { code = "" } = await searchParams;
  return (
    <>
      <Topbar />
      <main>
        <div className="container auth">
          <section className="intro">
            <div className="tags"><span className="tag outline">Erster Login</span></div>
            <h1>Willkommen in der KI-AG.</h1>
            <p className="lead">
              Du brauchst keine E-Mail-Adresse. Such dir ein Pseudonym aus, unter dem dich die anderen in der AG
              sehen, und ein Passwort, das nur du kennst.
            </p>
            <p className="muted">
              Passwort vergessen? Kein Problem: Deine Coach kann es in der AG zurücksetzen.
            </p>
          </section>
          <section className="card" aria-labelledby="reg-title">
            <header><h3 id="reg-title">Zugang anlegen</h3></header>
            <RegisterForm initialCode={code.toUpperCase().slice(0, 16)} />
          </section>
        </div>
      </main>
    </>
  );
}
