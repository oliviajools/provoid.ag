import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { Topbar } from "@/components/Topbar";
import { CoachLoginForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "Coach-Login" };
export const dynamic = "force-dynamic";

export default async function CoachLogin() {
  const user = await getUser();
  if (user?.role === "coach") redirect("/coach");
  return (
    <>
      <Topbar label="Coach" />
      <main>
        <div className="narrow">
          <h2>Coach-Bereich</h2>
          <section className="card">
            <header><h3>Einloggen</h3></header>
            <CoachLoginForm />
          </section>
        </div>
      </main>
    </>
  );
}
