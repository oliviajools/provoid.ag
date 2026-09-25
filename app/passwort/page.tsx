import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { Topbar } from "@/components/Topbar";
import { ChangePasswordForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "Passwort ändern" };
export const dynamic = "force-dynamic";

export default async function Passwort() {
  const user = await requireUser({ allowPasswordChange: true });
  return (
    <>
      <Topbar pseudonym={user.pseudonym} home={user.role === "coach" ? "/coach" : "/start"} />
      <main>
        <div className="narrow">
          <div className="stack" style={{ gap: 10 }}>
            <h2>Neues Passwort festlegen.</h2>
            <p className="muted">
              {user.must_change_password
                ? "Dein Passwort wurde zurückgesetzt. Leg jetzt ein eigenes fest, das nur du kennst."
                : "Ändere hier dein Passwort."}
            </p>
          </div>
          <section className="card">
            <header><h3>Passwort ändern</h3></header>
            <ChangePasswordForm />
          </section>
        </div>
      </main>
    </>
  );
}
