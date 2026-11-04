import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { Topbar } from "@/components/Topbar";
import { EVALS } from "@/lib/evaluation";
import { EvalForm } from "./EvalForm";

export const metadata: Metadata = { title: "Evaluation" };
export const dynamic = "force-dynamic";

/** Anonymer Bogen. Funktioniert eingeloggt (AG kommt aus dem Konto) und ohne Login (mit AG-Code). */
export default async function Evaluation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const def = EVALS[id];
  if (!def) notFound();
  const user = await getUser();
  return (
    <>
      {/* Eigenes Label: So springt das Gerät während einer Live-Sitzung nicht weg, solange der Bogen offen ist. */}
      <Topbar pseudonym={user?.pseudonym} home={user?.role === "coach" ? "/coach" : user ? "/start" : "/"} label="Evaluation" />
      <main>
        <div className="container page" style={{ gap: 28, maxWidth: 860 }}>
          <section className="stack" style={{ gap: 12 }}>
            <div className="tags"><span className="tag outline">Anonym</span><span className="tag">{def.label}</span></div>
            <h1>{def.id === "kompass" ? "Wo stehst du gerade?" : "Wie war’s heute für dich?"}</h1>
            <p className="muted">
              Dein Name wird nicht gespeichert, auch nicht, wenn du eingeloggt bist. Gespeichert werden nur deine Antworten,
              dein Code und das Datum. So sieht niemand, wer was geantwortet hat. Ehrlich ist wichtiger als gut.
            </p>
          </section>
          <EvalForm def={def} needsAg={!user || user.role !== "student"} preview={user?.role === "coach"} />
        </div>
      </main>
    </>
  );
}
