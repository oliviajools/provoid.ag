import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/Topbar";
import { loadForm } from "@/lib/signups";
import { submitSignup } from "./actions";
import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const f = await loadForm((await params).slug);
  return { title: f ? `${f.title} · ${f.school}` : "Anmeldung" };
}

export default async function Anmeldung({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f = await loadForm(slug);
  if (!f) notFound();
  const action = submitSignup.bind(null, slug);

  return (
    <>
      <Topbar />
      <main>
        <div className="container auth" style={{ alignItems: "start" }}>
          <section className="intro">
            <div className="tags"><span className="tag">{f.school}</span><span className="tag outline">KI-AG 2026/27</span></div>
            <h1>{f.title}</h1>
            <p className="lead" style={{ display: "block" }}>{f.intro}</p>
            <ul className="wz-promises">
              {f.options.map((o) => <li key={o.id}><b>{o.label}</b><br />{o.detail}</li>)}
            </ul>
            <p className="muted">Kein Vorwissen nötig.</p>
            <section id="datenschutz" className="prose" style={{ fontSize: 14, gap: 8 }}>
              <h2 style={{ fontSize: 18, marginTop: 8 }}>Datenschutzhinweise zur Anmeldung</h2>
              <p>Verantwortlich ist PROVOID, Olivia Bahr, Eppendorfer Landstraße 15, Hamburg. Wir verwenden Ihre Angaben ausschließlich, um die AG zu organisieren und Sie bei Bedarf zu kontaktieren. Die Daten liegen auf einem Server in Deutschland und werden nicht an Dritte weitergegeben, außer an die Schule, soweit sie für die Organisation nötig sind. Nach Ende der AG löschen wir sie. Sie können jederzeit Auskunft, Berichtigung oder Löschung verlangen und Ihre Einwilligung widerrufen.</p>
            </section>
          </section>
          <section className="card" style={{ maxWidth: 560 }} aria-labelledby="form-title">
            <header><h3 id="form-title">{f.open ? "Anmeldeformular" : "Anmeldung geschlossen"}</h3></header>
            {f.open
              ? <SignupForm action={action} options={f.options.map((o) => ({ id: o.id, label: o.label, detail: o.detail }))} />
              : <div className="body"><p className="muted">Die Anmeldung ist derzeit geschlossen. Bei Fragen erreichen Sie uns über provoid.de.</p></div>}
          </section>
        </div>
      </main>
    </>
  );
}
