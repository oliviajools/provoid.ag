import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { requireCoach } from "@/lib/auth";
import { loadSession } from "@/lib/sessions";
import { Presenter } from "./Presenter";

export const metadata: Metadata = { title: "Präsentation" };
export const dynamic = "force-dynamic";

export default async function PresentationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCoach();
  const { id } = await params;
  const s = await loadSession(id);
  if (!s) notFound();
  const [deck] = await sql<{ slides: number }[]>`select slides from session_decks where session_id = ${id}`;
  if (!deck) {
    return (
      <main><div className="container page">
        <p>Für diese Sitzung ist noch kein Foliensatz hochgeladen.</p>
        <Link href={`/coach/sitzungen/${id}#live`}>Zurück zur Sitzung</Link>
      </div></main>
    );
  }
  return <Presenter sessionId={id} number={s.number} title={s.title} published={s.published} />;
}
