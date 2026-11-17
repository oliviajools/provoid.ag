import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canView, loadSession } from "@/lib/sessions";
import { loadItems, myAnswers } from "@/lib/live";
import { Topbar } from "@/components/Topbar";
import { Pfad, type Step } from "./Pfad";

export const metadata: Metadata = { title: "Aufgaben" };
export const dynamic = "force-dynamic";

/** Aufgabenpfad: die Jugendlichen klicken sich im eigenen Tempo durch die Aufgaben der Sitzung. */
export default async function Aufgaben({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const s = await loadSession(id);
  if (!s || !canView(user, s)) notFound();
  const items = (await loadItems(id)).filter((i) => i.self_paced);
  const steps: Step[] = await Promise.all(items.map(async (i) => ({
    id: i.id, title: i.title, kind: i.kind, rows: i.rows, options: i.options, solution: i.solution,
    private: i.private, info: i.info, closed: i.closed, mode: "open" as const, result: null,
    mine: user.role === "student" ? await myAnswers(i.id, user.id) : [],
  })));
  return (
    <>
      <Topbar pseudonym={user.pseudonym} home={user.role === "coach" ? "/coach" : "/start"} label="Aufgaben" />
      <main>
        <div className="container page" style={{ gap: 24, maxWidth: 860 }}>
          <Link href={`/sitzungen/${id}`}>Zurück zur Sitzung</Link>
          {user.role === "coach" && <div className="alert ok">Vorschau als Coach: Antworten werden nur von Teilnehmenden gespeichert.</div>}
          {steps.length === 0
            ? <p className="muted">Für diese Sitzung gibt es keinen Aufgabenpfad.</p>
            : <Pfad sessionId={id} title={s.title || `Sitzung ${s.number}`} steps={steps} canSave={user.role === "student"} />}
        </div>
      </main>
    </>
  );
}
