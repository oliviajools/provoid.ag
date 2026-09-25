import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Topbar } from "@/components/Topbar";
import { Wizard } from "./Wizard";
import type { Answers } from "@/lib/compass";

export const metadata: Metadata = { title: "Dein Kompass" };
export const dynamic = "force-dynamic";

export default async function Kompass({ searchParams }: { searchParams: Promise<{ bearbeiten?: string }> }) {
  const user = await requireUser();
  const { bearbeiten } = await searchParams;
  const existing = (await sql<{ answers: Answers }[]>`
    select answers from compass where user_id = ${user.id} and round = 1`)[0];
  if (existing && bearbeiten === undefined) redirect("/kompass/karte");

  return (
    <>
      <Topbar pseudonym={user.pseudonym} home={user.role === "coach" ? "/coach" : "/start"} />
      <main>
        <div className="container">
          <Wizard
            userKey={user.id}
            pseudonym={user.pseudonym}
            initial={existing?.answers ?? null}
            preview={user.role === "coach"}
          />
        </div>
      </main>
    </>
  );
}
